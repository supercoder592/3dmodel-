#!/usr/bin/env bash
# One-time setup for the self-hosted Hunyuan3D 2.1 API server (Linux + NVIDIA GPU).
# Mirrors the official README: https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
#
#   bash server/setup_hunyuan.sh            # installs into ./server/Hunyuan3D-2.1
#
# Needs: git, python3.10, CUDA 12.x driver, ~30 GB disk for weights, 10 GB VRAM (shape only)
# or ~29 GB VRAM for shape + PBR texture (use HUNYUAN_TEXTURE=0 on smaller cards).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d Hunyuan3D-2.1 ]; then
  git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1.git
fi
cd Hunyuan3D-2.1

if [ ! -d .venv ]; then
  python3.10 -m venv .venv || python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip

# Versions the upstream project is tested with.
pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt

# Texture pipeline native extensions (needs nvcc / CUDA toolkit).
( cd hy3dpaint/custom_rasterizer && pip install -e . )
( cd hy3dpaint/DifferentiableRenderer && bash compile_mesh_painter.sh )

mkdir -p hy3dpaint/ckpt
[ -f hy3dpaint/ckpt/RealESRGAN_x4plus.pth ] || \
  wget -q --show-progress https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -P hy3dpaint/ckpt

# Text-to-image sidecar deps live in the same venv.
pip install -r ../requirements-t2i.txt

echo
echo "Done. Start everything with:  bash server/start.sh"
echo "Model weights (~several GB) download from Hugging Face on first run."
