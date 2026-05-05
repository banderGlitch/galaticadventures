import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import {
  BufferAttribute,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  type BufferGeometry,
  type MeshBasicMaterial,
  Vector3,
} from "three";
import { onWreckage } from "./wreckageBus";

/* ─────────────────────────  tuning  ───────────────────────── */

const SHRAPNEL_COUNT = 14;
const SHRAPNEL_LIFE = 0.75; // seconds
const FLASH_LIFE = 0.28;
const SHOCKWAVE_LIFE = 0.55;
const SHAKE_LIFE = 0.38;
const SHAKE_MAX = 0.18; // world-units of camera jitter at peak

/* ─────────────────────  jitter helpers  ───────────────────── */

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

/* ───────────────────  per-particle records  ──────────────────── */

type Shrapnel = {
  alive: boolean;
  age: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  scale: number;
};

type Singleton = {
  alive: boolean;
  age: number;
  x: number;
  y: number;
  z: number;
};

function makeShrapnel(): Shrapnel {
  return {
    alive: false, age: 0,
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    spinX: 0, spinY: 0, spinZ: 0,
    scale: 1,
  };
}

function makeSingleton(): Singleton {
  return { alive: false, age: 0, x: 0, y: 0, z: 0 };
}

/* ─────────────────────────  component  ───────────────────────── */

export default function Wreckage() {
  const camera = useThree((s) => s.camera);
  const cameraBase = useRef<Vector3 | null>(null);
  const shakeUntil = useRef(0);

  const flashRef = useRef<Mesh | null>(null);
  const shockRef = useRef<Mesh | null>(null);
  const flash = useRef<Singleton>(makeSingleton());
  const shock = useRef<Singleton>(makeSingleton());

  const shrapnelRefs = useRef<Array<Group | null>>(Array(SHRAPNEL_COUNT).fill(null));
  const shrapnelData = useRef<Shrapnel[]>(
    Array.from({ length: SHRAPNEL_COUNT }, makeShrapnel),
  );

  // Pre-baked unique chunk geometries; disposed on unmount to avoid GPU
  // memory leaks under HMR. Detail=0 (20 tris) keeps each chunk feeling
  // chunky and crystalline rather than smooth.
  const geometries = useMemo(() => {
    return Array.from({ length: SHRAPNEL_COUNT }, (_, i) => {
      const g = new IcosahedronGeometry(0.28, 0);
      // Seed offset so chunks don't accidentally mirror the asteroid pool.
      jitterGeometry(g, i + 1009, 0.16);
      return g;
    });
  }, []);

  useEffect(() => {
    return () => {
      for (const g of geometries) g.dispose();
    };
  }, [geometries]);

  /* ── trigger ────────────────────────────────────────────── */

  useEffect(() => {
    const off = onWreckage((x, y, z) => {
      flash.current.alive = true;
      flash.current.age = 0;
      flash.current.x = x; flash.current.y = y; flash.current.z = z;

      shock.current.alive = true;
      shock.current.age = 0;
      shock.current.x = x; shock.current.y = y; shock.current.z = z;

      // Fan shrapnel out in roughly the XY plane with a slight bias toward
      // the camera (+Z). Random angular jitter prevents the perfectly
      // symmetric flower we'd get from `(i / N) * 2π` alone.
      for (let i = 0; i < SHRAPNEL_COUNT; i++) {
        const angle = (i / SHRAPNEL_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = 5 + Math.random() * 7;
        const d = shrapnelData.current[i];
        d.alive = true;
        d.age = 0;
        d.x = x; d.y = y; d.z = z;
        d.vx = Math.cos(angle) * speed;
        d.vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 2.5;
        // Slight +Z bias so chunks fly toward camera and read as 3D depth.
        d.vz = 1.5 + Math.random() * 5;
        d.spinX = (Math.random() - 0.5) * 14;
        d.spinY = (Math.random() - 0.5) * 14;
        d.spinZ = (Math.random() - 0.5) * 14;
        d.scale = 0.7 + Math.random() * 0.7;
      }

      shakeUntil.current = performance.now() + SHAKE_LIFE * 1000;
    });
    return off;
  }, []);

  /* ── per-frame ──────────────────────────────────────────── */

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 0.05);

    // Lazy-capture the camera's resting position once so we can shake
    // around it and restore exactly where it started.
    if (!cameraBase.current) {
      cameraBase.current = camera.position.clone();
    }

    /* ─ camera shake ─ */
    const remainingMs = shakeUntil.current - performance.now();
    if (remainingMs > 0) {
      const t = remainingMs / (SHAKE_LIFE * 1000); // 1 → 0
      const intensity = SHAKE_MAX * t * t; // ease-out
      camera.position.set(
        cameraBase.current.x + (Math.random() - 0.5) * 2 * intensity,
        cameraBase.current.y + (Math.random() - 0.5) * 2 * intensity,
        cameraBase.current.z,
      );
    } else if (
      cameraBase.current &&
      (camera.position.x !== cameraBase.current.x ||
        camera.position.y !== cameraBase.current.y)
    ) {
      camera.position.copy(cameraBase.current);
    }

    /* ─ flash ─ */
    if (flash.current.alive && flashRef.current) {
      flash.current.age += delta;
      const t = flash.current.age / FLASH_LIFE;
      if (t >= 1) {
        flash.current.alive = false;
        flashRef.current.visible = false;
      } else {
        flashRef.current.visible = true;
        flashRef.current.position.set(flash.current.x, flash.current.y, flash.current.z);
        const s = 0.45 + 3.6 * t;
        flashRef.current.scale.setScalar(s);
        const mat = flashRef.current.material as MeshBasicMaterial;
        mat.opacity = (1 - t) * (1 - t);
      }
    }

    /* ─ shockwave ─ */
    if (shock.current.alive && shockRef.current) {
      shock.current.age += delta;
      const t = shock.current.age / SHOCKWAVE_LIFE;
      if (t >= 1) {
        shock.current.alive = false;
        shockRef.current.visible = false;
      } else {
        shockRef.current.visible = true;
        shockRef.current.position.set(shock.current.x, shock.current.y, shock.current.z);
        // Ring grows fast at first then eases out — feels like a
        // pressure wave instead of a uniformly expanding circle.
        const ease = 1 - (1 - t) * (1 - t);
        const s = 0.3 + 5.2 * ease;
        shockRef.current.scale.setScalar(s);
        const mat = shockRef.current.material as MeshBasicMaterial;
        mat.opacity = (1 - t) * 0.85;
      }
    }

    /* ─ shrapnel chunks ─ */
    for (let i = 0; i < SHRAPNEL_COUNT; i++) {
      const d = shrapnelData.current[i];
      const g = shrapnelRefs.current[i];
      if (!g) continue;

      if (!d.alive) {
        g.visible = false;
        continue;
      }

      d.age += delta;
      const t = d.age / SHRAPNEL_LIFE;
      if (t >= 1) {
        d.alive = false;
        g.visible = false;
        continue;
      }

      d.x += d.vx * delta;
      d.y += d.vy * delta;
      d.z += d.vz * delta;
      // Light air-drag so shrapnel decelerates instead of flying off the
      // screen perfectly straight.
      d.vx *= 0.97;
      d.vy *= 0.97;
      d.vz *= 0.97;

      g.visible = true;
      g.position.set(d.x, d.y, d.z);
      g.rotation.x += d.spinX * delta;
      g.rotation.y += d.spinY * delta;
      g.rotation.z += d.spinZ * delta;

      const fade = (1 - t) * (1 - t);
      g.scale.setScalar(d.scale * fade);
    }
  });

  /* ── render ─────────────────────────────────────────────── */

  return (
    <>
      {/* White-hot flash sphere — bloom turns this into a real light burst */}
      <mesh ref={flashRef} visible={false}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Cyan shockwave ring (default torus orientation faces the camera) */}
      <mesh ref={shockRef} visible={false}>
        <torusGeometry args={[0.6, 0.06, 10, 64]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Shrapnel pool — same material recipe as the asteroids so the
          chunks read as broken pieces of the rock + ship. */}
      {Array.from({ length: SHRAPNEL_COUNT }, (_, i) => (
        <group
          key={i}
          ref={(r) => {
            shrapnelRefs.current[i] = r;
          }}
          visible={false}
        >
          <mesh geometry={geometries[i]}>
            <meshStandardMaterial
              color="#4a4f5b"
              flatShading
              roughness={0.92}
              metalness={0.08}
              emissive="#1a2333"
              emissiveIntensity={0.6}
            />
            <Edges
              color={i % 2 === 0 ? "#22d3ee" : "#f0abfc"}
              threshold={1}
              scale={1.001}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
