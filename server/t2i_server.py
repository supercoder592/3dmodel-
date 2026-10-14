"""
Tiny text-to-image sidecar for the self-hosted pipeline.

Exposes the AUTOMATIC1111-compatible endpoint the web app talks to:
    POST /sdapi/v1/txt2img  {prompt, negative_prompt, steps, width, height, cfg_scale, seed}
    -> {"images": ["<base64 png>"]}
    GET  /health

Default model is SDXL-Turbo (fast, ~7 GB VRAM in fp16). Override with T2I_MODEL,
e.g. "black-forest-labs/FLUX.1-schnell" (better prompt following, needs ~24 GB)
or "stabilityai/stable-diffusion-xl-base-1.0".

If you already run AUTOMATIC1111 / Forge / SD.Next with --api, you don't need
this file at all: point T2I_URL at that server instead.
"""
import base64
import io
import os
import threading

import torch
from fastapi import FastAPI
from pydantic import BaseModel

MODEL = os.environ.get("T2I_MODEL", "stabilityai/sdxl-turbo")
DEVICE = os.environ.get("T2I_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

app = FastAPI(title="t2i-sidecar")
_lock = threading.Lock()
_pipe = None


def get_pipe():
    global _pipe
    if _pipe is None:
        from diffusers import AutoPipelineForText2Image

        pipe = AutoPipelineForText2Image.from_pretrained(MODEL, torch_dtype=DTYPE, variant="fp16" if DTYPE == torch.float16 else None)
        pipe = pipe.to(DEVICE)
        if DEVICE == "cuda" and os.environ.get("T2I_LOW_VRAM") == "1":
            pipe.enable_model_cpu_offload()
        _pipe = pipe
    return _pipe


class Txt2Img(BaseModel):
    prompt: str
    negative_prompt: str = ""
    steps: int = 4
    width: int = 768
    height: int = 768
    cfg_scale: float = 1.0
    seed: int | None = None
    batch_size: int = 1


@app.get("/health")
def health():
    return {"status": "healthy", "model": MODEL, "device": DEVICE, "loaded": _pipe is not None}


@app.post("/sdapi/v1/txt2img")
def txt2img(req: Txt2Img):
    pipe = get_pipe()
    gen = torch.Generator(device=DEVICE).manual_seed(req.seed) if req.seed is not None else None
    kwargs = dict(
        prompt=req.prompt,
        num_inference_steps=max(1, req.steps),
        guidance_scale=req.cfg_scale,
        width=req.width - req.width % 8,
        height=req.height - req.height % 8,
        generator=gen,
    )
    # Turbo / schnell models ignore negative prompts (guidance 0/1); others use it.
    if req.cfg_scale > 1 and req.negative_prompt:
        kwargs["negative_prompt"] = req.negative_prompt
    with _lock:  # one generation at a time on the GPU
        image = pipe(**kwargs).images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return {"images": [base64.b64encode(buf.getvalue()).decode()]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("T2I_HOST", "0.0.0.0"), port=int(os.environ.get("T2I_PORT", "7860")))
