import React, { useRef, Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Earth } from './Earth';
import { EarthMarker } from './EarthMarker';
import { CommunicationArc } from './CommunicationArc';
import { StarField } from './StarField';
import { useGlobeInteraction } from '../../hooks/useGlobeInteraction';
import gsap from 'gsap';
/** Geographic locations used across the landing page */
export const LOCATIONS = {
  India: {
    name:      'India',
    language:  'Hindi',
    latitude:  19.07,
    longitude: 72.87,
    text:      'नमस्ते!',
    color:     '#ff8c42',
    flag:      '🇮🇳',
  },
  Japan: {
    name:      'Japan',
    language:  'Japanese',
    latitude:  35.68,
    longitude: 139.69,
    text:      'こんにちは!',
    color:     '#e63946',
    flag:      '🇯🇵',
  },
  France: {
    name:      'France',
    language:  'French',
    latitude:  48.86,
    longitude: 2.35,
    text:      'Bonjour!',
    color:     '#4e9af1',
    flag:      '🇫🇷',
  },
};

const ARC_PAIRS = [
  { from: LOCATIONS.India,  to: LOCATIONS.Japan,  activeRegions: ['Japan',  'all'] },
  { from: LOCATIONS.India,  to: LOCATIONS.France, activeRegions: ['France', 'all'] },
  { from: LOCATIONS.Japan,  to: LOCATIONS.France, activeRegions: ['all'] },
];

/**
 * GlobeScene — the R3F Canvas with cartoon Earth, markers, arcs and stars.
 * groupRef drives rotation (shared between Earth.useFrame and child meshes).
 */
export function GlobeScene({
  activeRegion     = 'none',
  prefersReducedMotion = false,
  globeTransform,
  className        = '',
  theme            = 'dark',
}) {
  const groupRef = useRef();

  const interactionState = useGlobeInteraction(groupRef, {
    autoRotate:      true,
    autoRotateSpeed: 0.0006,
    disabled:        prefersReducedMotion,
  });

  return (
    <div
      className={`globe-scene-canvas ${className}`}
      style={{ width: '100%', height: '100%', cursor: 'grab' }}
      aria-label="Interactive 3D globe showing global language connections"
      role="img"
    >
      <Canvas
        dpr={[1, prefersReducedMotion ? 1 : 1.5]}
        gl={{
          antialias:            true,
          alpha:                true,
          toneMapping:          THREE.ACESFilmicToneMapping,
          // Higher exposure = brighter overall scene (key for cartoon look)
          toneMappingExposure:  1.6,
        }}
        camera={{ position: [0, 0, 4.2], fov: 45, near: 0.1, far: 100 }}
        style={{ background: 'transparent' }}
      >
        {/*
          ── LIGHTING (cartoon-tuned) ──────────────────────────────
          Strong ambient so night side stays bright.
          Single warm directional key light for the toon gradient to kick in.
          Blue fill from the front-left for the atmosphere mood.
        */}
        <ambientLight intensity={1.2} color={0xffffff} />
        <directionalLight
          position={[4, 2, 5]}
          intensity={2.8}
          color={0xfff5d0}
        />
        <directionalLight
          position={[-3, 0, 2]}
          intensity={0.6}
          color={0x88ccff}
        />

        {/* Stars */}
        {!prefersReducedMotion && <StarField count={500} radius={35} theme={theme} />}

        {/* Globe group — Suspense while texture loads */}
        <Suspense fallback={null}>
          {/*
            Initial Y rotation so Europe / Africa faces camera at load.
            -0.7 rad ≈ -40°, which centres the Atlantic.
            Shifted down very slightly via position.
          */}
          <group ref={groupRef} rotation-y={-0.7} position={[0, -0.1, 0]}>
            {/* Earth drives groupRef.current.rotation.y in useFrame */}
            <Earth
              ref={groupRef}
              autoRotate={activeRegion === 'none' || activeRegion === 'all'}
              autoRotateSpeed={0.0006}
              interactionState={interactionState}
              prefersReducedMotion={prefersReducedMotion}
              theme={theme}
            />

            {/* Location markers — children of group so they rotate with Earth */}
            {Object.values(LOCATIONS).map((loc) => (
              <EarthMarker
                key={loc.name}
                latitude={loc.latitude}
                longitude={loc.longitude}
                name={loc.name}
                color={loc.color}
                active={activeRegion === loc.name || activeRegion === 'all'}
              />
            ))}

            {/* Communication arcs */}
            {ARC_PAIRS.map((pair, i) => (
              <CommunicationArc
                key={i}
                from={pair.from}
                to={pair.to}
                active={pair.activeRegions.includes(activeRegion)}
                color={theme === 'light' ? '#3F6F96' : '#4F7FA8'}
              />
            ))}
          </group>
          <GlobeRotationAnimator activeRegion={activeRegion} groupRef={groupRef} prefersReducedMotion={prefersReducedMotion} />
        </Suspense>
        {/* Camera animation rig for scroll effects */}
        {globeTransform && <GlobeRig globeTransform={globeTransform} />}
      </Canvas>
    </div>
  );
}

function GlobeRig({ globeTransform }) {
  useFrame(({ camera }) => {
    if (globeTransform?.current) {
      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        -globeTransform.current.x,
        0.05
      );
    }
  });
  return null;
}
function GlobeRotationAnimator({ activeRegion, groupRef, prefersReducedMotion }) {
  useEffect(() => {
    if (!groupRef.current || prefersReducedMotion) return;

    if (activeRegion !== 'none' && activeRegion !== 'all') {
      const loc = LOCATIONS[activeRegion];
      if (loc) {
        // -90 degrees offset because texture (0,0) starts at +X, and we want it to face +Z
        const targetY = -loc.longitude * (Math.PI / 180) - (Math.PI / 2);
        const targetX = loc.latitude * (Math.PI / 180);

        gsap.to(groupRef.current.rotation, {
          x: targetX,
          y: targetY,
          duration: 1.5,
          ease: 'power2.inOut',
        });
      }
    } else {
      // Return X to 0, let Earth autoRotate handle Y
      gsap.to(groupRef.current.rotation, {
        x: 0,
        duration: 1.5,
        ease: 'power2.inOut',
      });
    }
  }, [activeRegion, prefersReducedMotion, groupRef]);

  return null;
}

export default GlobeScene;
