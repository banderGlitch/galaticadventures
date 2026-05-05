import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh } from "three";
import { ShipPosition, ShipTarget } from "./refs";
import { useGame } from "./store";

export default function Ship() {
  const root = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const trail = useRef<Mesh>(null);

  useFrame((_, deltaRaw) => {
    if (!root.current || !inner.current) return;

    // Hide the ship during the explosion + game-over screens. The wreckage
    // pool takes over visually; if we kept rendering the ship at its
    // pre-impact pose it would feel unbroken.
    const phase = useGame.getState().phase;
    const visible = phase === "idle" || phase === "playing";
    root.current.visible = visible;
    if (!visible) return;

    const delta = Math.min(deltaRaw, 0.05); // clamp huge frames after tab-throttle
    const lerp = Math.min(1, delta * 9);

    ShipPosition.x += (ShipTarget.x - ShipPosition.x) * lerp;
    ShipPosition.y += (ShipTarget.y - ShipPosition.y) * lerp;

    root.current.position.set(ShipPosition.x, ShipPosition.y, 0);

    const dx = ShipTarget.x - ShipPosition.x;
    const dy = ShipTarget.y - ShipPosition.y;
    root.current.rotation.z = -dx * 0.35;
    root.current.rotation.x = dy * 0.3;

    inner.current.position.y = Math.sin(performance.now() * 0.003) * 0.05;

    if (trail.current) {
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.012);
      trail.current.scale.set(pulse, 1, pulse);
    }
  });

  return (
    <group ref={root}>
      <group ref={inner}>
        {/* Hull: cone tip points away from camera (forward / -z) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow={false}>
          <coneGeometry args={[0.42, 1.2, 16]} />
          <meshStandardMaterial
            color="#0b1024"
            emissive="#f0abfc"
            emissiveIntensity={0.55}
            metalness={0.4}
            roughness={0.4}
          />
        </mesh>

        {/* Cyan rim around the hull */}
        <mesh>
          <torusGeometry args={[0.55, 0.045, 8, 32]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>

        {/* Bright core dot at the nose */}
        <mesh position={[0, 0, -0.65]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Engine glow trail behind the ship */}
        <mesh ref={trail} position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 0.6, 12, 1, true]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.55} />
        </mesh>
      </group>
    </group>
  );
}
