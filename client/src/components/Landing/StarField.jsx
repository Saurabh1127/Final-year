import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * StarField
 * Lightweight Three.js particle system for the space background.
 * Uses a BufferGeometry Points system — no expensive shader passes.
 */
export function StarField({ count = 800, radius = 40, theme = 'dark' }) {
  const pointsRef = useRef();

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz  = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random position on a large sphere shell around the camera
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(Math.random() * 2 - 1);
      const r     = radius + Math.random() * 10;

      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      sz[i] = Math.random() * 1.5 + 0.3;
    }
    return [pos, sz];
  }, [count, radius]);

  const starMaterial = useMemo(() => new THREE.PointsMaterial({
    color: theme === 'dark' ? 0xffffff : 0x0f172a,
    size: 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: theme === 'dark' ? 0.7 : 0.3,
  }), [theme]);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.005;
    }
  });

  if (theme === 'light') return null;

  return (
    <points ref={pointsRef} material={starMaterial}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
    </points>
  );
}

export default StarField;
