import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { useGame } from "./store";
import { useEvents } from "./events";
import { checkPickup } from "./physics";
import { ShipPosition } from "./refs";
import { hapticImpact } from "../telegram/sdk";

const POOL = 12;
const BURST_POOL = 4;

const SPAWN_Z = -180;
const DESPAWN_Z = 12;
const SPAWN_HALF_W = 5.5;
const SPAWN_HALF_H = 3.0;

const COIN_VALUE = 50;
const PICKUP_RADIUS = 0.95;

const MAGNET_RADIUS_XY = 1.4;
const MAGNET_RADIUS_Z = 5.0;
const MAGNET_PULL = 6;

const BURST_DURATION = 0.35;
const BURST_MIN_SCALE = 0.35;
const BURST_MAX_SCALE = 2.6;

type Coin = {
  x: number;
  y: number;
  z: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  alive: boolean;
};

type Burst = {
  x: number;
  y: number;
  z: number;
  startedAt: number;
  alive: boolean;
};

function makeCoin(): Coin {
  return {
    x: 0,
    y: 0,
    z: SPAWN_Z,
    vz: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    alive: false,
  };
}

function makeBurst(): Burst {
  return { x: 0, y: 0, z: 0, startedAt: 0, alive: false };
}

function respawn(c: Coin, difficulty: number): void {
  c.x = (Math.random() * 2 - 1) * SPAWN_HALF_W;
  c.y = (Math.random() * 2 - 1) * SPAWN_HALF_H;
  c.z = SPAWN_Z - Math.random() * 40;
  c.vz = 32 + Math.random() * 12 + difficulty * 50;
  c.spinX = 0.4;
  c.spinY = 0.6;
  // fast spin around the ring's axis so it reads as a flat coin
  c.spinZ = 3 + Math.random() * 1.5;
  c.alive = true;
}

export default function CoinField() {
  const groupRefs = useRef<Array<Group | null>>(Array(POOL).fill(null));
  const data = useRef<Coin[]>(Array.from({ length: POOL }, makeCoin));

  const burstRefs = useRef<Array<Mesh | null>>(Array(BURST_POOL).fill(null));
  const bursts = useRef<Burst[]>(Array.from({ length: BURST_POOL }, makeBurst));

  const lastSpawn = useRef(0);
  const wasPlaying = useRef(false);

  function spawnBurst(elapsed: number, x: number, y: number, z: number) {
    const idx = bursts.current.findIndex((b) => !b.alive);
    if (idx < 0) return;
    const b = bursts.current[idx];
    b.alive = true;
    b.startedAt = elapsed;
    b.x = x;
    b.y = y;
    b.z = z;
  }

  useFrame((state, deltaRaw) => {
    const delta = Math.min(deltaRaw, 0.05);
    const phase = useGame.getState().phase;

    // Always tick bursts so a coin grabbed in the last frame still finishes
    // its expansion when the game ends.
    for (let i = 0; i < BURST_POOL; i++) {
      const b = bursts.current[i];
      const m = burstRefs.current[i];
      if (!m) continue;
      if (!b.alive) {
        m.visible = false;
        continue;
      }
      const t = (state.clock.elapsedTime - b.startedAt) / BURST_DURATION;
      if (t >= 1) {
        b.alive = false;
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(b.x, b.y, b.z);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      const scale = BURST_MIN_SCALE + eased * (BURST_MAX_SCALE - BURST_MIN_SCALE);
      m.scale.setScalar(scale);
      const mat = m.material as MeshBasicMaterial;
      mat.opacity = 1 - t;
    }

    if (phase !== "playing") {
      if (wasPlaying.current) {
        for (const c of data.current) c.alive = false;
        for (const g of groupRefs.current) {
          if (g) g.visible = false;
        }
        wasPlaying.current = false;
      }
      return;
    }

    if (!wasPlaying.current) {
      // First coin appears in ~1 s, not 3 s, so the player gets early reward.
      lastSpawn.current = state.clock.elapsedTime - 1.5;
      wasPlaying.current = true;
    }

    const elapsed = (performance.now() - useGame.getState().startedAt) / 1000;
    const difficulty = Math.min(1, elapsed / 60);
    const interval = Math.max(1.4, 3.0 - difficulty * 1.3);

    if (state.clock.elapsedTime - lastSpawn.current > interval) {
      const idx = data.current.findIndex((c) => !c.alive);
      if (idx >= 0) {
        respawn(data.current[idx], difficulty);
        lastSpawn.current = state.clock.elapsedTime;
      }
    }

    let collected = 0;

    for (let i = 0; i < POOL; i++) {
      const c = data.current[i];
      const g = groupRefs.current[i];
      if (!g) continue;

      if (!c.alive) {
        g.visible = false;
        continue;
      }

      c.z += c.vz * delta;

      // Magnetic attraction: when the coin is near the ship plane and roughly
      // aligned in XY, gently steer it toward the ship. Strength fades with
      // distance in z, so coins far away keep their original trajectory.
      const dz = c.z;
      if (dz > -MAGNET_RADIUS_Z && dz < MAGNET_RADIUS_Z) {
        const dx = ShipPosition.x - c.x;
        const dy = ShipPosition.y - c.y;
        const distXY = Math.sqrt(dx * dx + dy * dy);
        if (distXY > 0.001 && distXY < MAGNET_RADIUS_XY) {
          const zFactor = 1 - Math.abs(dz) / MAGNET_RADIUS_Z;
          const pull = MAGNET_PULL * zFactor * delta;
          c.x += dx * pull;
          c.y += dy * pull;
        }
      }

      g.visible = true;
      g.position.set(c.x, c.y, c.z);
      g.rotation.x += c.spinX * delta;
      g.rotation.y += c.spinY * delta;
      g.rotation.z += c.spinZ * delta;

      if (c.z > DESPAWN_Z) {
        c.alive = false;
        g.visible = false;
        continue;
      }

      if (c.z > -1.5 && c.z < 1.5 && checkPickup(c.x, c.y, PICKUP_RADIUS)) {
        c.alive = false;
        g.visible = false;
        spawnBurst(state.clock.elapsedTime, c.x, c.y, c.z);
        collected += 1;
      }
    }

    if (collected > 0) {
      useGame.getState().addScore(collected * COIN_VALUE);
      hapticImpact("light");
      for (let i = 0; i < collected; i++) {
        useEvents.getState().push("coin", COIN_VALUE);
      }
    }
  });

  const coinMeshes = useMemo(
    () =>
      Array.from({ length: POOL }, (_, i) => (
        <group
          key={`coin-${i}`}
          ref={(g) => {
            groupRefs.current[i] = g;
          }}
          visible={false}
        >
          <mesh>
            <torusGeometry args={[0.32, 0.11, 12, 28]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshBasicMaterial color="#fff7d6" />
          </mesh>
        </group>
      )),
    [],
  );

  const burstMeshes = useMemo(
    () =>
      Array.from({ length: BURST_POOL }, (_, i) => (
        <mesh
          key={`burst-${i}`}
          ref={(m) => {
            burstRefs.current[i] = m;
          }}
          visible={false}
        >
          <torusGeometry args={[0.4, 0.04, 8, 28]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={1} />
        </mesh>
      )),
    [],
  );

  return (
    <>
      <group>{coinMeshes}</group>
      <group>{burstMeshes}</group>
    </>
  );
}
