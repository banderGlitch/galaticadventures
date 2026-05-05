import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import {
  BufferAttribute,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  type BufferGeometry,
} from "three";
import { useGame } from "./store";
import { useEvents } from "./events";
import { checkShipCollision, checkShipNearMiss } from "./physics";
import { ShipPosition } from "./refs";
import { emitWreckage } from "./wreckageBus";
import { hapticImpact, hapticNotification } from "../telegram/sdk";

const NEAR_MISS_VALUE = 10;

const POOL = 40;

/**
 * Halo edge color palette. Cyan/magenta/violet are the loud "neon" rocks.
 * The slates are intentionally muted so most rocks read as physical objects
 * with only a faint edge — that contrast makes the bright ones pop.
 */
const HALO_PALETTE = [
  "#22d3ee", // cyan
  "#f0abfc", // magenta
  "#a78bfa", // violet
  "#475569", // slate (subdued)
  "#94a3b8", // light slate (subdued)
  "#22d3ee",
  "#f0abfc",
];

const SPAWN_Z = -180;
const DESPAWN_Z = 12;
const SPAWN_HALF_W = 6.5;
const SPAWN_HALF_H = 4.5;

const VERTEX_JITTER = 0.28; // max world-units displacement on a unit icosahedron — higher = more shattered/jagged silhouettes

type SizeTier = { min: number; max: number };
const TIER_SMALL: SizeTier = { min: 0.4, max: 0.6 };
const TIER_NORMAL: SizeTier = { min: 0.6, max: 1.05 };
const TIER_BOULDER: SizeTier = { min: 1.3, max: 1.8 };

function pickTier(): SizeTier {
  const r = Math.random();
  if (r < 0.1) return TIER_BOULDER;
  if (r < 0.4) return TIER_SMALL;
  return TIER_NORMAL;
}

type Datum = {
  x: number;
  y: number;
  z: number;
  vz: number;
  radius: number;
  spinX: number;
  spinY: number;
  alive: boolean;
  /** Set true on the frame this asteroid crosses the ship plane, so the
   *  near-miss bonus fires at most once per asteroid. Reset on respawn. */
  passed: boolean;
};

function makeDatum(): Datum {
  return {
    x: 0,
    y: 0,
    z: SPAWN_Z,
    vz: 0,
    radius: 1,
    spinX: 0,
    spinY: 0,
    alive: false,
    passed: false,
  };
}

function respawn(d: Datum, difficulty: number): void {
  const tier = pickTier();
  d.x = (Math.random() * 2 - 1) * SPAWN_HALF_W;
  d.y = (Math.random() * 2 - 1) * SPAWN_HALF_H;
  d.z = SPAWN_Z - Math.random() * 60;
  d.radius = tier.min + Math.random() * (tier.max - tier.min);
  // Big boulders move a bit slower so they read as massive instead of unfair.
  const massPenalty = tier === TIER_BOULDER ? 0.7 : 1;
  d.vz = (28 + Math.random() * 20 + difficulty * 65) * massPenalty;
  d.spinX = (Math.random() - 0.5) * 2.5;
  d.spinY = (Math.random() - 0.5) * 2.5;
  d.alive = true;
  d.passed = false;
}

/**
 * Tiny seedable PRNG (mulberry32). We need deterministic per-pool-slot jitter
 * so HMR or remounts don't reshuffle every rock's silhouette.
 */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitterGeometry(geo: BufferGeometry, seed: number, amount: number): void {
  const pos = geo.attributes.position as BufferAttribute;
  const rng = mulberry32(seed * 7919 + 1);
  for (let i = 0; i < pos.count; i++) {
    const dx = (rng() - 0.5) * 2 * amount;
    const dy = (rng() - 0.5) * 2 * amount;
    const dz = (rng() - 0.5) * 2 * amount;
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

export default function AsteroidField() {
  /** Outer group: position + scale only. Trail is a child here so it stays
   *  aligned with the velocity direction regardless of how the rock spins. */
  const groupRefs = useRef<Array<Group | null>>(Array(POOL).fill(null));
  /** Inner group: receives the per-frame spinX/spinY rotation. The rock mesh
   *  lives here. */
  const spinRefs = useRef<Array<Group | null>>(Array(POOL).fill(null));
  const data = useRef<Datum[]>(Array.from({ length: POOL }, makeDatum));
  const lastSpawn = useRef(0);
  const wasPlaying = useRef(false);

  /** Pre-baked unique geometry per pool slot. Generated once; disposed on
   *  unmount to avoid GPU memory leaks under HMR. */
  const geometries = useMemo(() => {
    return Array.from({ length: POOL }, (_, i) => {
      // detail=1 gives 80 triangles per asteroid (~5x the original); enough
      // surface for flat-shading to look like a real faceted rock without
      // looking expensive on mobile.
      const g = new IcosahedronGeometry(1, 1);
      jitterGeometry(g, i + 1, VERTEX_JITTER);
      return g;
    });
  }, []);

  useEffect(() => {
    return () => {
      for (const g of geometries) g.dispose();
    };
  }, [geometries]);

  useFrame((state, deltaRaw) => {
    const delta = Math.min(deltaRaw, 0.05);
    const phase = useGame.getState().phase;

    if (phase !== "playing") {
      if (wasPlaying.current) {
        for (const d of data.current) d.alive = false;
        for (const g of groupRefs.current) {
          if (g) g.visible = false;
        }
        wasPlaying.current = false;
      }
      return;
    }

    if (!wasPlaying.current) {
      lastSpawn.current = state.clock.elapsedTime;
      wasPlaying.current = true;
    }

    const elapsed = (performance.now() - useGame.getState().startedAt) / 1000;
    const difficulty = Math.min(1, elapsed / 60);
    const spawnInterval = Math.max(0.1, 0.5 - difficulty * 0.42);

    if (state.clock.elapsedTime - lastSpawn.current > spawnInterval) {
      const idx = data.current.findIndex((d) => !d.alive);
      if (idx >= 0) {
        respawn(data.current[idx], difficulty);
        lastSpawn.current = state.clock.elapsedTime;
      }
    }

    let collided = false;
    let impactX = 0;
    let impactY = 0;
    let impactZ = 0;
    let nearMisses = 0;

    for (let i = 0; i < POOL; i++) {
      const d = data.current[i];
      const g = groupRefs.current[i];
      const spin = spinRefs.current[i];
      if (!g || !spin) continue;

      if (!d.alive) {
        g.visible = false;
        continue;
      }

      const prevZ = d.z;
      d.z += d.vz * delta;
      g.visible = true;
      g.position.set(d.x, d.y, d.z);
      g.scale.setScalar(d.radius);
      // Rotation lives on the inner spin group so the trail (sibling) stays
      // pointed along the velocity direction.
      spin.rotation.x += d.spinX * delta;
      spin.rotation.y += d.spinY * delta;

      if (d.z > DESPAWN_Z) {
        d.alive = false;
        g.visible = false;
        continue;
      }

      if (!collided && d.z > -1.5 && d.z < 1.5) {
        if (checkShipCollision(d.x, d.y, d.radius)) {
          collided = true;
          // Place the explosion at the midpoint between rock and ship so it
          // reads as a real impact instead of a detonation buried inside
          // either object.
          impactX = (d.x + ShipPosition.x) * 0.5;
          impactY = (d.y + ShipPosition.y) * 0.5;
          impactZ = d.z * 0.5;
        }
      }

      if (!d.passed && prevZ < 0 && d.z >= 0) {
        d.passed = true;
        if (!collided && checkShipNearMiss(d.x, d.y, d.radius)) {
          nearMisses += 1;
        }
      }
    }

    if (collided) {
      // Heavy impact haptic + error notification: heavy alone is not always
      // wired on every Telegram client, so notification is the safety net.
      hapticImpact("heavy");
      hapticNotification("error");
      emitWreckage(impactX, impactY, impactZ);
      useGame.getState().endRun();
    } else if (nearMisses > 0) {
      useGame.getState().addScore(nearMisses * NEAR_MISS_VALUE);
      hapticImpact("light");
      for (let i = 0; i < nearMisses; i++) {
        useEvents.getState().push("miss", NEAR_MISS_VALUE);
      }
    }
  });

  const asteroids = useMemo(
    () =>
      Array.from({ length: POOL }, (_, i) => {
        const haloColor = HALO_PALETTE[i % HALO_PALETTE.length];
        return (
          <group
            key={i}
            ref={(g) => {
              groupRefs.current[i] = g;
            }}
            visible={false}
          >
            {/* Inner group receives all spin so the rock tumbles, but the
                trail (sibling below) stays aligned with the velocity. */}
            <group
              ref={(g) => {
                spinRefs.current[i] = g;
              }}
            >
              {/* Solid faceted rock body. The scene's cyan + magenta point
                  lights tint the grey faces for free, giving the rock a neon
                  ambience without any new lights or shaders. */}
              <mesh geometry={geometries[i]}>
                <meshStandardMaterial
                  color="#4a4f5b"
                  flatShading
                  roughness={0.92}
                  metalness={0.08}
                  emissive="#1a2333"
                  emissiveIntensity={0.5}
                />
                {/* Real edge wireframe via drei's <Edges> — scoped to the
                    parent mesh's geometry, threshold=1° so every facet edge
                    on the icosahedron renders. */}
                <Edges color={haloColor} threshold={1} scale={1.001} />
              </mesh>
            </group>

            {/* Motion trail: hollow translucent cone behind the rock. The
                asteroid moves in +z, so its trail extends in -z (away from
                the camera, where it came from). Rotation -π/2 around X
                points the cone's tip to -z; offsetting the cone center to
                z = -height/2 lands the wide base at the rock and the narrow
                tip 2.4 units behind. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.2]}>
              <coneGeometry args={[1.0, 2.4, 10, 1, true]} />
              <meshBasicMaterial
                color="#22d3ee"
                transparent
                opacity={0.22}
                depthWrite={false}
                side={DoubleSide}
              />
            </mesh>
          </group>
        );
      }),
    [geometries],
  );

  return <group>{asteroids}</group>;
}
