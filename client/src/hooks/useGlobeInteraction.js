import { useEffect, useRef, useCallback } from 'react';

/**
 * useGlobeInteraction
 * Handles mouse and touch drag-to-rotate for the Three.js globe mesh.
 * Includes inertia on release and auto-resume of idle rotation.
 *
 * @param {React.MutableRefObject} globeRef   - ref to the THREE.Mesh (globe)
 * @param {Object} options
 * @param {boolean} options.autoRotate        - enable idle auto-rotation
 * @param {number}  options.autoRotateSpeed   - radians per frame
 * @param {boolean} options.disabled          - pause all interaction
 */
export function useGlobeInteraction(globeRef, {
  autoRotate = true,
  autoRotateSpeed = 0.0008,
  disabled = false,
} = {}) {
  const state = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    velocityX: 0,
    velocityY: 0,
    interacting: false,
    resumeTimer: null,
  });

  const applyInertia = useCallback(() => {
    const s = state.current;
    if (!globeRef.current || s.isDragging) return;

    s.velocityX *= 0.92;
    s.velocityY *= 0.92;

    globeRef.current.rotation.y += s.velocityX;
    globeRef.current.rotation.x += s.velocityY;

    // Clamp X rotation to avoid flipping
    globeRef.current.rotation.x = Math.max(
      -Math.PI / 4,
      Math.min(Math.PI / 4, globeRef.current.rotation.x)
    );

    if (Math.abs(s.velocityX) > 0.0001 || Math.abs(s.velocityY) > 0.0001) {
      requestAnimationFrame(applyInertia);
    } else {
      s.interacting = false;
    }
  }, [globeRef]);

  useEffect(() => {
    if (disabled) return;

    const s = state.current;

    const onPointerDown = (e) => {
      s.isDragging = true;
      s.interacting = true;
      s.lastX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      s.lastY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      s.velocityX = 0;
      s.velocityY = 0;
      clearTimeout(s.resumeTimer);
    };

    const onPointerMove = (e) => {
      if (!s.isDragging || !globeRef.current) return;

      const x = e.clientX ?? e.touches?.[0]?.clientX ?? s.lastX;
      const y = e.clientY ?? e.touches?.[0]?.clientY ?? s.lastY;
      const dx = (x - s.lastX) * 0.005;
      const dy = (y - s.lastY) * 0.004;

      globeRef.current.rotation.y += dx;
      globeRef.current.rotation.x += dy;
      globeRef.current.rotation.x = Math.max(
        -Math.PI / 4,
        Math.min(Math.PI / 4, globeRef.current.rotation.x)
      );

      s.velocityX = dx;
      s.velocityY = dy;
      s.lastX = x;
      s.lastY = y;
    };

    const onPointerUp = () => {
      if (!s.isDragging) return;
      s.isDragging = false;
      requestAnimationFrame(applyInertia);

      // Resume auto-rotation after 2 seconds of idle
      s.resumeTimer = setTimeout(() => {
        s.interacting = false;
      }, 2000);
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      clearTimeout(s.resumeTimer);
    };
  }, [disabled, globeRef, applyInertia]);

  // Return the state ref so the animation loop can read interacting flag
  return state;
}

export default useGlobeInteraction;
