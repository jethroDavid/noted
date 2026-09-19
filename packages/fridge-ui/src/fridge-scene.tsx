"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  memo,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { FRIDGE_MODELS, type FridgeModelId } from "./models";
import type { OrthographicCamera } from "three";

function SceneContents({ modelId }: { modelId: FridgeModelId }) {
  const Model = FRIDGE_MODELS[modelId].Model;
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    // A fixed world frame keeps the HTML surface aligned at every viewport size.
    const orthographic = camera as OrthographicCamera;
    // Three.js owns this mutable camera; synchronize its projection after resize.
    // eslint-disable-next-line react-hooks/immutability
    orthographic.zoom = size.height / 10;
    orthographic.updateProjectionMatrix();
    invalidate();
  }, [camera, size.height, invalidate]);
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[-4, 6, 8]} intensity={2.7} color="#fff6df" />
      <directionalLight position={[5, 1, 3]} intensity={0.6} color="#e1e7df" />
      <Model />
    </>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onUnavailable();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const subscribeToBrowser = () => () => {};

function FridgeScene({
  modelId,
  onUnavailable,
}: {
  modelId: FridgeModelId;
  onUnavailable: () => void;
}) {
  const isBrowser = useSyncExternalStore(
    subscribeToBrowser,
    () => true,
    () => false,
  );

  const available = useMemo<boolean | null>(() => {
    if (!isBrowser) return null;
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      if (!context) return false;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  }, [isBrowser]);

  useEffect(() => {
    if (available === false) onUnavailable();
  }, [available, onUnavailable]);

  if (available !== true) return null;

  return (
    <SceneBoundary onUnavailable={onUnavailable}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 12], zoom: 60, near: 0.1, far: 30 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ alpha: true, antialias: true }}
        fallback={<span>3D rendering is unavailable.</span>}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", onUnavailable, {
            once: true,
          });
        }}
      >
        <SceneContents modelId={modelId} />
      </Canvas>
    </SceneBoundary>
  );
}

export default memo(FridgeScene);
