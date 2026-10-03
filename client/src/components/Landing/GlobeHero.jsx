import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { GlobeScene, LOCATIONS } from './GlobeScene';
import { SpeakerCharacter } from './SpeakerCharacter';
import { SpeechBubble } from './SpeechBubble';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

const SCENES = [
  {
    id: 'opening',
    tag: 'Global Communication',
    location: 'Universal',
    title: 'The world speaks in thousands of languages.',
    narrative:
      'Human connection should never stop at linguistic borders. SAMVADA unifies global conversations in real time so everyone speaks naturally and understands instantly.',
    region: 'none',
    capability: 'Neural Audio Mesh',
    metric: '50+ Languages',
  },
  {
    id: 'india',
    tag: 'Voice Origin',
    location: 'Mumbai · 18.9° N',
    title: 'A conversation begins with "नमस्ते".',
    narrative:
      'Ananya speaks Hindi from Mumbai. Her voice is instantly captured and analyzed with authentic tone and emotion, ready to travel the globe in fractions of a second.',
    region: 'India',
    capability: 'Whisper v3 Turbo',
    metric: '< 220ms Latency',
  },
  {
    id: 'japan',
    tag: 'Live Reception',
    location: 'Tokyo · 35.6° N',
    title: 'Tokyo listens in natural Japanese.',
    narrative:
      'Across 6,700 kilometers, Yuki hears Ananya’s exact meaning delivered in natural Japanese speech synthesis, preserving speaking cadence without awkward delays.',
    region: 'Japan',
    capability: 'Speech-to-Speech',
    metric: 'Zero Cadence Loss',
  },
  {
    id: 'france',
    tag: 'Multi-Way Mesh',
    location: 'Paris · 48.8° N',
    title: 'Paris joins the global circle.',
    narrative:
      'Chloé responds in French with "Bonjour." Dual-channel audio and synchronized multilingual subtitles keep the entire cross-border conversation in harmony.',
    region: 'France',
    capability: 'WebRTC Dual Stream',
    metric: 'Lossless Audio',
  },
  {
    id: 'world',
    tag: 'Every Border Crossed',
    location: 'Worldwide',
    title: 'One world. Boundless conversation.',
    narrative:
      'Enterprise meetings, global summits, and human moments — united by real-time speech models so no meaning or human warmth is ever lost in translation.',
    region: 'all',
    capability: 'End-to-End Pipeline',
    metric: 'Global Mesh Active',
  },
];

export function GlobeHero({ prefersReducedMotion = false, theme = 'dark' }) {
  const [activeRegion, setActiveRegion] = useState('none');
  
  // Ref to hold target 3D transform for the globe group
  // Hero: x = 1.5 (right side). Story: x = 0 (center)
  const globeTransform = useRef({ x: 1.5, y: 0, scale: 1 });
  
  const heroRef = useRef(null);
  const sectionsRef = useRef([]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    // Trigger for Hero -> Story transition
    // Moves globe from right (hero) to center (story)
    const heroTrigger = ScrollTrigger.create({
      trigger: heroRef.current,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        // self.progress goes 0 to 1 as hero scrolls up
        // Move from x=1.5 (right, hero) to x=0 (center, story)
        globeTransform.current.x = 1.5 - (self.progress * 1.5);
      },
    });

    // Triggers for story scenes (Pin them so user must stop and read)
    const sceneTriggers = SCENES.map((scene, i) => {
      const el = sectionsRef.current[i];
      if (!el) return null;

      return ScrollTrigger.create({
        trigger: el,
        start: 'center center',
        end: '+=800', // Pin for 800px of scrolling
        pin: true,
        onEnter: () => {
          setActiveRegion(scene.region);
          globeTransform.current.x = 0;
        },
        onEnterBack: () => {
          setActiveRegion(scene.region);
          globeTransform.current.x = 0;
        },
      });
    }).filter(Boolean);

    // Fade out the globe after the last scene
    const globeWrapper = document.getElementById('globe-fixed-wrapper');
    const fadeOutTrigger = ScrollTrigger.create({
      trigger: sectionsRef.current[SCENES.length - 1],
      start: 'bottom top',
      end: '+=500',
      scrub: true,
      animation: gsap.to(globeWrapper, { opacity: 0, ease: 'none' }),
    });

    return () => {
      heroTrigger.kill();
      sceneTriggers.forEach(t => t.kill());
      fadeOutTrigger.kill();
    };
  }, [prefersReducedMotion]);

  const isLight = theme === 'light';

  return (
    <div 
      className={`globe-story-layout relative transition-colors duration-500 overflow-hidden ${
        isLight 
          ? 'bg-[#F5F7F8] text-[#172332]' 
          : 'bg-[#0B1220] text-[#F4F5F3]'
      }`}
    >
      
      {/* ── ATMOSPHERIC / DAYLIGHT SKY SCENE (Only shown in Light Mode) ── */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
          isLight ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Soft daylight upper-atmosphere cloud & haze silhouettes */}
        <svg className="absolute top-[10%] left-[6%] w-56 h-36 text-[#D5DEE6]/40" viewBox="0 0 200 80" fill="currentColor">
          <ellipse cx="60" cy="50" rx="55" ry="25" />
          <ellipse cx="110" cy="42" rx="45" ry="30" />
          <ellipse cx="150" cy="52" rx="40" ry="22" />
        </svg>
        <svg className="absolute top-[32%] right-[10%] w-68 h-40 text-[#E9EEF2]/60" viewBox="0 0 200 80" fill="currentColor">
          <ellipse cx="70" cy="45" rx="60" ry="28" />
          <ellipse cx="130" cy="40" rx="50" ry="32" />
        </svg>
        <svg className="absolute top-[68%] left-[22%] w-48 h-30 text-[#D5DEE6]/30" viewBox="0 0 200 80" fill="currentColor">
          <ellipse cx="80" cy="50" rx="50" ry="22" />
          <ellipse cx="130" cy="45" rx="45" ry="25" />
        </svg>
        {/* Subtle steel-blue atmospheric dot grid */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(79, 127, 168, 0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} 
        />
      </div>

      {/* ── FIXED BACKGROUND GLOBE LAYER ── */}
      <div id="globe-fixed-wrapper" className="fixed inset-0 z-0 pointer-events-auto">
        <GlobeScene
          activeRegion={activeRegion}
          prefersReducedMotion={prefersReducedMotion}
          globeTransform={globeTransform}
          theme={theme}
        />
        
        {/* Fixed container for character overlays aligned with the centered globe */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <CharacterOverlays activeRegion={activeRegion} globeTransform={globeTransform} />
        </div>
      </div>

      {/* ── SCROLLABLE FOREGROUND ── */}
      <div className="relative z-10 pointer-events-none">

        {/* 1. HERO SECTION (Text left, Globe right) */}
        <section 
          ref={heroRef}
          className="min-h-screen flex items-center px-[5%] lg:px-[10%]"
        >
          {/* Shift text slightly up to align with the visual weight of the globe */}
          <div className="max-w-[600px] pointer-events-auto -translate-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)] text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              AI Speech-to-Speech
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-semibold text-[var(--text-primary)] leading-[1.05] tracking-tight mb-6" style={{ fontFamily: 'var(--lm-font-display)' }}>
              Different Languages.<br/>
              <span className="text-[var(--accent)]">A Closer World.</span>
            </h1>
            
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-10 max-w-[500px]">
              SAMVADA translates your voice in real time — so every participant speaks and hears their own language with sub-second latency and natural cadence.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-12">
              <Link to="/register" className="sam-btn sam-btn--primary sam-btn--lg" id="hero-cta-primary">
                <span>Start a Conversation</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
              <a href="#features" className="sam-btn sam-btn--secondary sam-btn--lg" id="hero-cta-secondary">
                <span>Explore SAMVADA</span>
              </a>
            </div>
          </div>
        </section>

        {/* 2. SCROLL STORY SECTION (Globe in middle, text right-bottom, sleek redesigned card) */}
        <section className="relative w-full pt-[10vh] pb-[15vh]">
          {SCENES.map((scene, i) => (
            <div
              key={scene.id}
              ref={el => { sectionsRef.current[i] = el; }}
              className="h-screen flex flex-col justify-end items-end px-[5%] lg:px-[8%] pb-[7vh] pointer-events-auto"
            >
              <div className="w-full max-w-[340px] sm:max-w-[380px] text-left bg-[var(--surface)]/90 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-[var(--border)] shadow-xl transition-all duration-300 hover:border-[var(--border-strong)] group">
                
                {/* Header Tag & Location */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-[var(--surface-elevated)] text-[var(--accent)] border border-[var(--border)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    {scene.tag}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {scene.location}
                  </span>
                </div>

                {/* Heading */}
                <h3
                  className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] leading-snug mb-2.5 tracking-tight"
                  style={{ fontFamily: 'var(--lm-font-display)' }}
                >
                  {scene.title}
                </h3>

                {/* Engaging Narrative (No robotic bullet points) */}
                <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed m-0 font-normal">
                  {scene.narrative}
                </p>

                {/* Technical Capability Footer */}
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)] font-mono flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    {scene.capability}
                  </span>
                  <span className="text-[var(--accent)] font-mono font-medium">{scene.metric}</span>
                </div>

              </div>
            </div>
          ))}
        </section>
        
        {/* Spacer before next section */}
        <div className="h-[20vh]" />
      </div>
    </div>
  );
}

/* ── Character + speech-bubble overlays ─────────── */
function CharacterOverlays({ activeRegion, globeTransform }) {
  // We use a ref to sync the DOM element's X position with the globe's 3D X position
  const containerRef = useRef();

  useEffect(() => {
    // A simple rAF loop to sync the overlay wrapper with the scroll-driven globe position
    let animationFrame;
    const sync = () => {
      if (containerRef.current && globeTransform?.current) {
        // Very rough mapping: 3D X=1.5 translates to roughly 25% screen width offset
        const xOffset = globeTransform.current.x * 20;
        containerRef.current.style.transform = `translateX(${xOffset}vw)`;
      }
      animationFrame = requestAnimationFrame(sync);
    };
    sync();
    return () => cancelAnimationFrame(animationFrame);
  }, [globeTransform]);

  // Positions around the central 3D globe:
  // - France (Chloé): Upper-Left
  // - Japan (Yuki): Lower-Left (distinct from France, completely separate from India!)
  // - India (Ananya): Upper-Right
  // In the 'all' scene at the end, all 3 are simultaneously visible without any collision!
  const REGION_CONFIG = {
    France: {
      positionClass: '-left-4 sm:-left-8 top-[8%]',
      alignClass: 'items-start',
      direction: 'left',
    },
    Japan: {
      positionClass: '-left-4 sm:-left-8 top-[52%]',
      alignClass: 'items-start',
      direction: 'left',
    },
    India: {
      positionClass: '-right-4 sm:-right-8 top-[8%]',
      alignClass: 'items-end',
      direction: 'right',
    },
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[620px] aspect-square transition-transform duration-75">
      {['India', 'Japan', 'France'].map((region) => {
        const loc = LOCATIONS[region];
        const config = REGION_CONFIG[region];
        const isActive = activeRegion === region || activeRegion === 'all';
        return (
          <div
            key={region}
            className={`absolute inset-0 pointer-events-none transition-all duration-500 ${
              isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <div className={`absolute flex flex-col ${config.alignClass} gap-2.5 ${config.positionClass}`}>
              <SpeechBubble
                text={loc.text}
                language={loc.language}
                active={isActive}
                color={loc.color}
                direction={config.direction}
              />
              <SpeakerCharacter region={region} active={isActive} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default GlobeHero;
