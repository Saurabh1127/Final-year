import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToVector3 } from './Earth';

/**
 * EarthMarker
 * Places a glowing dot + pulse ring at a geographic lat/lon position on the Earth.
 * The marker rotates with the Earth (it's a child of the Earth group OR positioned
 * in world space — here we compute it directly from lat/lon and attach it inside
 * the same Earth mesh group so it auto-follows globe rotation).
 *
 * @param {Object} props
 * @param {number}  props.latitude
 * @param {number}  props.longitude
 * @param {string}  props.name
 * @param {boolean} props.active
 * @param {string}  props.color     - hex or css color
 */
export function EarthMarker({ latitude, longitude, name, active = false, color = '#4F7FA8' }) {
  const pulseRef = useRef();
  const dotRef = useRef();

  const position = useMemo(
    () => latLonToVector3(latitude, longitude, 1.52),
    [latitude, longitude]
  );

  const c = useMemo(() => new THREE.Color(color), [color]);

  useFrame(({ clock }) => {
    if (!pulseRef.current || !active) return;
    const t = clock.getElapsedTime();
    const scale = 1 + Math.sin(t * 2) * 0.5;
    pulseRef.current.scale.setScalar(scale);
    pulseRef.current.material.opacity = active ? 0.4 - scale * 0.12 : 0;

    if (dotRef.current) {
      const glow = 0.7 + Math.sin(t * 3) * 0.3;
      dotRef.current.material.emissiveIntensity = glow;
    }
  });

  return (
    <group position={position}>
      {/* Outer pulse ring */}
      <mesh ref={pulseRef}>
        <ringGeometry args={[0.025, 0.038, 32]} />
        <meshBasicMaterial
          color={c}
          transparent
          opacity={active ? 0.4 : 0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Core glowing dot */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.014, 16, 16]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={active ? 1.5 : 0.4}
          roughness={0}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}

export default EarthMarker;
