import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * useGlobeScroll
 * Drives scroll-synced globe rotation, scene transitions, and active marker changes.
 *
 * @param {Object} params
 * @param {React.MutableRefObject} params.globeRef  - ref to the Three.js Globe mesh
 * @param {Function} params.setActiveRegion         - setState for active location name
 * @param {Function} params.setScrollProgress       - setState for 0–1 scroll progress
 * @param {boolean}  params.prefersReducedMotion    - skip heavy animation
 */
export function useGlobeScroll({
  globeRef,
  setActiveRegion,
  setScrollProgress,
  prefersReducedMotion = false,
}) {
  const triggerRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#globe-story-trigger',
          start: 'top top',
          end: '+=3000',
          scrub: 1.2,
          pin: true,
          pinSpacing: true,
          onUpdate: (self) => {
            setScrollProgress?.(self.progress);
            const p = self.progress;
            if (p < 0.2) {
              setActiveRegion?.('none');
            } else if (p < 0.45) {
              setActiveRegion?.('India');
            } else if (p < 0.7) {
              setActiveRegion?.('Japan');
            } else if (p < 0.9) {
              setActiveRegion?.('France');
            } else {
              setActiveRegion?.('all');
            }
          },
        },
      });

      if (globeRef?.current) {
        tl.to(
          globeRef.current.rotation,
          {
            y: Math.PI * 2,
            ease: 'none',
          },
          0
        );
      }
    });

    return () => ctx.revert();
  }, [globeRef, setActiveRegion, setScrollProgress, prefersReducedMotion]);

  return triggerRef;
}

export default useGlobeScroll;
