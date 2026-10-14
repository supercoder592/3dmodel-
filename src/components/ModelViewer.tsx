"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export interface ViewerSettings {
  wireframe: boolean;
  autoRotate: boolean;
  background: "dark" | "light";
}

export default function ModelViewer({ url, settings, resetKey }: { url: string | null; settings: ViewerSettings; resetKey: number }) {
  const bg = settings.background === "dark" ? "#0e1117" : "#f3f4f8";
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => setLoadError(null), [url]);
  return (
    <div className="relative h-full w-full">
      <Canvas
        key={resetKey}
        shadows
        dpr={[1, 2]}
        camera={{ position: [2.5, 1.8, 2.5], fov: 45, near: 0.01, far: 100 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ background: bg }}
      >
        <color attach="background" args={[bg]} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} />
        <Suspense fallback={null}>
          <Environment preset="city" />
          {url ? (
            <ViewerErrorBoundary key={url} onError={setLoadError}>
              <Model url={url} wireframe={settings.wireframe} />
            </ViewerErrorBoundary>
          ) : (
            <Placeholder />
          )}
          <ContactShadows position={[0, -0.001, 0]} opacity={0.5} scale={6} blur={2.2} far={2} />
        </Suspense>
        <gridHelper args={[10, 20, "#2a3040", "#1b2029"]} position={[0, -0.002, 0]} />
        <OrbitControls makeDefault enableDamping autoRotate={settings.autoRotate} autoRotateSpeed={1.2} minDistance={0.3} maxDistance={20} />
      </Canvas>
      <LoadingOverlay />
      {loadError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--panel)", color: "var(--danger)", border: "1px solid var(--border)" }}>
            模型載入失敗：{loadError}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(18,21,28,.85)", color: "var(--muted)", border: "1px solid var(--border)" }}>
        <div className="spinner h-6 w-6 rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
        載入模型… {Math.round(progress)}%
      </div>
    </div>
  );
}

function Model({ url, wireframe }: { url: string; wireframe: boolean }) {
  const { scene } = useGLTF(url);
  const { camera, controls } = useThree();

  // Clone so toggling wireframe never mutates drei's cached asset.
  const object = useMemo(() => {
    // SkeletonUtils handles skinned meshes (plain .clone() leaves bones pointing at the original).
    const clone = cloneSkeleton(scene);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.material = Array.isArray(mesh.material) ? mats.map((m) => m.clone()) : mats[0].clone();
      }
    });
    return clone;
  }, [scene]);

  // Normalise: scale to ~2 units and sit the model on the ground, centred.
  const { scale, offset } = useMemo(() => {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return { scale: 1, offset: new THREE.Vector3() };
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.8 / maxDim;
    const center = box.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return { scale, offset };
  }, [object]);

  useEffect(() => {
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
    });
  }, [object, wireframe]);

  useEffect(() => {
    camera.position.set(2.5, 1.8, 2.5);
    const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    c?.target?.set(0, 0.7, 0);
    c?.update?.();
  }, [object, camera, controls]);

  return <primitive object={object} scale={scale} position={offset} />;
}

function Placeholder() {
  return (
    <group position={[0, 0.5, 0]}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshStandardMaterial color="#2b3344" roughness={0.35} metalness={0.4} wireframe />
      </mesh>
    </group>
  );
}


class ViewerErrorBoundary extends Component<{ children: ReactNode; onError: (msg: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    this.props.onError(err instanceof Error ? err.message : String(err));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
