import React, { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Vector3, BackSide, SRGBColorSpace } from 'three';
import * as THREE from 'three';

/**
 * Converts latitude/longitude (degrees) → 3D unit vector on a sphere of radius r.
 * Shrunk to 1.36 to match the slightly smaller earth radius (1.35).
 */
export function latLonToVector3(lat, lon, r = 1.36) {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
     (r * Math.cos(phi)),
     (r * Math.sin(phi) * Math.sin(theta))
  );
}

/* ─── Inner Earth — Loads cute 2D maps and switches based on theme ─────── */
function EarthInner({ groupRef, prefersReducedMotion, autoRotate, autoRotateSpeed, interactionState, theme = 'dark' }) {
  // Load both textures
  const [dayTexture, nightTexture] = useLoader(TextureLoader, [
    '/cute-earth-day.jpg',
    '/cute-earth-night.jpg'
  ]);
  
  // Enhance saturation slightly for that cute vibrant look
  dayTexture.colorSpace = SRGBColorSpace;
  nightTexture.colorSpace = SRGBColorSpace;

  const currentTexture = theme === 'dark' ? nightTexture : dayTexture;
  const outlineColor = theme === 'dark' ? '#0B1220' : '#D5DEE6';

  // Smoothly blend rotation
  useFrame(() => {
    if (!groupRef?.current) return;
    const s = interactionState?.current;
    const isInteracting = s?.isDragging || s?.interacting;
    if (autoRotate && !isInteracting && !prefersReducedMotion) {
      groupRef.current.rotation.y += autoRotateSpeed;
    }
  });

  return (
    <>
      {/* Main sphere — Basic material for flat 2D cartoon look (radius shrunk to 1.35) */}
      <mesh>
        <sphereGeometry args={[1.35, 64, 64]} />
        <meshBasicMaterial map={currentTexture} />
      </mesh>

      {/* Cute cartoon outline (thick stroke behind the sphere) */}
      <mesh>
        <sphereGeometry args={[1.39, 64, 64]} />
        <meshBasicMaterial
          color={outlineColor}
          side={BackSide}
        />
      </mesh>
    </>
  );
}

/**
 * Earth — forwarded ref is the parent GROUP so markers rotate with it.
 */
export const Earth = React.forwardRef(function Earth(
  { autoRotate = true, autoRotateSpeed = 0.0008, interactionState, prefersReducedMotion = false, theme = 'dark' },
  ref
) {
  return (
    <EarthInner
      groupRef={ref}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      interactionState={interactionState}
      prefersReducedMotion={prefersReducedMotion}
      theme={theme}
    />
  );
});

export default Earth;
