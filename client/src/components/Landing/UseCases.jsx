import React from 'react';
import { Badge } from '../ui';

const USE_CASES = [
  {
    tag: 'Enterprise Teams',
    title: 'Distributed Software Engineering',
    desc: ['Global sprint standups', 'Zero misunderstandings'],
  },
  {
    tag: 'Cross-Border Healthcare',
    title: 'Telemedicine & Humanitarian Aid',
    desc: ['Real-time specialist consultations', 'Reduces diagnostic errors'],
  },
  {
    tag: 'Higher Education',
    title: 'International Universities & Symposia',
    desc: ['Global academic lectures', 'Native language listening'],
  },
  {
    tag: 'Talent & Commerce',
    title: 'Global Hiring & Cross-Border Sales',
    desc: ['Hire based on merit', 'Close deals with clarity'],
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="sam-landing-section">
      <div className="sam-landing-container">
        <div className="sam-landing-section-header">
          <span className="sam-landing-section-tag">Empowering Global Dialogue</span>
          <h2 className="sam-landing-section-title">
            Engineered For Every Cross-Lingual Interaction
          </h2>
          <p className="sam-landing-section-desc">
            See how teams, institutions, and clinics bridge communication gaps with Samvada.
          </p>
        </div>

        <div className="sam-usecases-grid">
          {USE_CASES.map((uc, idx) => (
            <div key={idx} className="sam-usecase-card">
              <div className="sam-usecase-header">
                <Badge variant={idx % 2 === 0 ? 'mint' : 'blue'} size="sm">
                  {uc.tag}
                </Badge>
              </div>
              <h3 className="sam-usecase-title">{uc.title}</h3>
              <ul className="sam-usecase-desc list-none p-0 m-0 space-y-2 mt-3">
                {uc.desc.map((point, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className={idx % 2 === 0 ? 'text-[var(--accent)] font-bold mt-[2px]' : 'text-[var(--color-accent-secondary)] font-bold mt-[2px]'}>•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default UseCases;
