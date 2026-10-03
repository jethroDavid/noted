"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { SRGBColorSpace, TextureLoader, Vector2 } from "three";
import type { ShaderMaterial } from "three";

export interface MemoryMotion {
  reveal: number;
  pull: number;
  time: number;
  pointerX: number;
  pointerY: number;
}

interface MemoryPortalProps {
  imageSrc: string;
  variant?: "portal" | "room";
  motion: RefObject<MemoryMotion>;
  onReady: (render: (() => void) | null) => void;
  onUnavailable: () => void;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uImage;
  uniform float uTime;
  uniform float uReveal;
  uniform float uPull;
  uniform float uAspect;
  uniform float uImageAspect;
  uniform float uRoom;
  uniform vec2 uPointer;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }
  float flow(vec2 p) {
    return noise(p) * 0.57 + noise(p * 2.03 + 8.7) * 0.28 + noise(p * 4.01 + 3.2) * 0.15;
  }
  void main() {
    vec2 q = vUv - 0.5;
    float memory = smoothstep(0.02, 0.95, uPull);
    float t = uTime * 0.085 + memory * 1.8;
    vec2 drift = vec2(flow(vUv * 2.4 + vec2(t, -t)),
      flow(vUv * 2.7 - vec2(t * 0.7, t) + 7.0)) - 0.5;
    vec2 liquid = vec2(flow(vUv * 3.3 + drift * memory * 2.0 + vec2(t, -t * 0.6)),
      flow(vUv * 3.1 + drift * memory * 2.0 + vec2(-t * 0.5, t) + 7.0)) - 0.5;

    // Uneven currents bend the room before drawing it inward.
    float angle = memory * (drift.x * 1.2 + sin(q.y * 7.0 + t) * 0.12);
    mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 warped = turn * q;
    warped.x += sin(q.y * 9.0 + t * 1.7) * 0.045 * memory;
    warped.y += sin(q.x * 8.0 - t * 1.3) * 0.035 * memory;
    warped *= 1.0 + memory * sin(length(q) * 12.0 - t * 2.0) * 0.16;
    float zoom = 1.0 + 1.35 * pow(uPull, 1.4);
    vec2 fit = vec2(min(uAspect / uImageAspect, 1.0), min(uImageAspect / uAspect, 1.0));
    vec2 imageUv = warped * fit / zoom + 0.5;
    imageUv += liquid * (0.017 + 0.009 * uRoom + 0.15 * memory);
    imageUv += uPointer * 0.012 * (1.0 - uPull);
    imageUv += q * dot(q, q) * 0.04 * (1.0 - uPull);

    vec2 ray = normalize(q + vec2(0.0001)) * (0.0005 + 0.009 * memory);
    vec3 color = texture2D(uImage, imageUv).rgb * 0.40;
    color += texture2D(uImage, imageUv + ray).rgb * 0.20;
    color += texture2D(uImage, imageUv - ray).rgb * 0.20;
    color += texture2D(uImage, imageUv + ray * 2.0).rgb * 0.10;
    color += texture2D(uImage, imageUv - ray * 2.0).rgb * 0.10;
    // A displaced echo lingers as if two versions of the memory overlap.
    vec2 echo = drift * memory * 0.085;
    color = mix(color, texture2D(uImage, imageUv + echo).rgb, memory * 0.18);
    vec2 dispersion = normalize(q + vec2(0.0001)) * memory * 0.006;
    color.r = mix(color.r, texture2D(uImage, imageUv + dispersion + echo * 0.3).r, memory * 0.42);
    color.b = mix(color.b, texture2D(uImage, imageUv - dispersion).b, memory * 0.42);

    float mist = flow(vUv * 4.4 + vec2(t * 0.7, -t * 0.4));
    float distance = length(q * vec2(1.0, 1.3));
    float radius = mix(mix(0.35, 0.63, uRoom), 0.88, uPull) * mix(0.55, 1.0, uReveal);
    float alpha = 1.0 - smoothstep(radius - 0.14, radius + 0.16,
      distance + (mist - 0.5) * (0.11 + memory * 0.28));
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    alpha *= smoothstep(0.0, 0.08 + (mist - 0.5) * 0.05, edge);
    alpha *= uReveal;
    color += (hash(vUv * 1200.0 + floor(uTime * 2.0)) - 0.5) * 0.006;
    color += uPull * 0.045;

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function MemoryPlane({
  imageSrc,
  variant = "portal",
  motion,
  onReady,
  onUnavailable,
}: MemoryPortalProps) {
  const source = useLoader(TextureLoader, imageSrc);
  const material = useRef<ShaderMaterial>(null);
  const reportedReady = useRef(false);
  const { invalidate, size, gl } = useThree();
  const texture = useMemo(() => {
    const image = source.clone();
    image.colorSpace = SRGBColorSpace;
    image.needsUpdate = true;
    return image;
  }, [source]);
  const uniforms = useMemo(
    () => ({
      uImage: { value: texture },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uPull: { value: 0 },
      uAspect: { value: 1.5 },
      uImageAspect: {
        value:
          (texture.image as HTMLImageElement).width /
          (texture.image as HTMLImageElement).height,
      },
      uRoom: { value: variant === "room" ? 1 : 0 },
      uPointer: { value: new Vector2() },
    }),
    [texture, variant],
  );

  useEffect(() => {
    reportedReady.current = false;
    invalidate();
    const lost = () => {
      reportedReady.current = false;
      onReady(null);
      onUnavailable();
    };
    const restored = () => {
      reportedReady.current = false;
      invalidate();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", lost);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
      reportedReady.current = false;
      onReady(null);
    };
  }, [gl, invalidate, onReady, onUnavailable]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (!material.current) return;
    const values = material.current.uniforms;
    values.uTime!.value = motion.current.time;
    values.uReveal!.value = motion.current.reveal;
    values.uPull!.value = motion.current.pull;
    values.uAspect!.value = size.width / size.height;
    (values.uPointer!.value as Vector2).set(
      motion.current.pointerX,
      motion.current.pointerY,
    );
  });

  return (
    <mesh
      frustumCulled={false}
      onAfterRender={() => {
        if (reportedReady.current) return;
        reportedReady.current = true;
        onReady(invalidate);
      }}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export default function MemoryPortal(props: MemoryPortalProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
      fallback={null}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <MemoryPlane {...props} />
      </Suspense>
    </Canvas>
  );
}
