import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToVector3 } from './Earth';

/**
 * CommunicationArc
 * Draws a curved 3D arc between two lat/lon positions on the Earth,
 * with an animated glowing particle traveling along the path.
 *
 * @param {Object}  props
 * @param {Object}  props.from   - { latitude, longitude }
 * @param {Object}  props.to     - { latitude, longitude }
 * @param {boolean} props.active
 * @param {string}  props.color
 */
export function CommunicationArc({
  from,
  to,
  active = false,
  color = '#4F7FA8',
}) {
  const particleRef = useRef();
  const lineRef = useRef();

  const { curve, points } = useMemo(() => {
    const startVec = latLonToVector3(from.latitude, from.longitude, 1.52);
    const endVec   = latLonToVector3(to.latitude, to.longitude, 1.52);

    // Control point pulled outward from Earth center for the arc bow
    const mid = startVec.clone().add(endVec).multiplyScalar(0.5);
    const dist = startVec.distanceTo(endVec);
    const ctrl = mid.clone().normalize().multiplyScalar(1.52 + dist * 0.6);

    const curve = new THREE.QuadraticBezierCurve3(startVec, ctrl, endVec);
    const pts = curve.getPoints(64);
    return { curve, points: pts };
  }, [from, to]);

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  const c = useMemo(() => new THREE.Color(color), [color]);

  useFrame(({ clock }) => {
    if (!particleRef.current || !active) return;
    const t = (clock.getElapsedTime() * 0.35) % 1;
    const pos = curve.getPoint(t);
    particleRef.current.position.copy(pos);
    particleRef.current.material.opacity = active ? 0.9 : 0;
  });

  if (!active) return null;

  return (
    <group>
      {/* Arc line */}
      <line ref={lineRef} geometry={lineGeometry}>
        <lineBasicMaterial
          color={c}
          transparent
          opacity={0.35}
          linewidth={1}
        />
      </line>

      {/* Traveling particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

export default CommunicationArc;
