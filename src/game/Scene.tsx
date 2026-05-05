import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import Ship from "./Ship";
import AsteroidField from "./AsteroidField";
import CoinField from "./CoinField";
import GameLoop from "./GameLoop";
import Wreckage from "./Wreckage";
import { getPerfTier } from "../lib/perfTier";

// Resolved once per session; users override via ?perf=low|high.
const PERF_TIER = getPerfTier();
const BLOOM_ENABLED = PERF_TIER === "high";

export default function Scene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.5, 8], fov: 60, near: 0.1, far: 400 }}
      // Bloom does its own averaging across mipmap levels, so canvas-level MSAA
      // is largely wasted when it is on. On low-tier devices we lean on the
      // canvas's built-in AA instead.
      gl={{ antialias: !BLOOM_ENABLED, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#04060f"]} />
      <fog attach="fog" args={["#04060f", 60, 220]} />

      <ambientLight intensity={0.35} />
      <pointLight position={[5, 5, 8]} intensity={1.4} color="#22d3ee" distance={40} />
      <pointLight position={[-5, -5, 6]} intensity={1.0} color="#f0abfc" distance={40} />

      <Suspense fallback={null}>
        <Stars
          radius={140}
          depth={80}
          count={2200}
          factor={4}
          saturation={0.4}
          fade
          speed={0.4}
        />
        <Ship />
        <AsteroidField />
        <CoinField />
        <Wreckage />
        <GameLoop />

        {BLOOM_ENABLED && (
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={1.1}
              luminanceThreshold={0.32}
              luminanceSmoothing={0.06}
              mipmapBlur
              radius={0.7}
            />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
