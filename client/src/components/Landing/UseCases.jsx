import React from 'react';
import { Badge } from '../ui';

const USE_CASES = [
  {
    tag: 'Enterprise Teams',
    title: 'Distributed Software Engineering',
    desc: 'Conduct sprint standups, architecture planning, and technical post-mortems across dispersed hubs in the US, Europe, Japan, and India without misunderstandings.',
  },
  {
    tag: 'Cross-Border Healthcare',
    title: 'Telemedicine & Humanitarian Aid',
    desc: 'Medical specialists accurately consult with non-native speaking patients in real time, dramatically reducing diagnostic errors during emergency treatments.',
  },
  {
    tag: 'Higher Education',
    title: 'International Universities & Symposia',
    desc: 'Enable students worldwide to attend academic lectures in English, Spanish, or German while listening and taking live notes in their native language.',
  },
  {
    tag: 'Talent & Commerce',
    title: 'Global Hiring & Cross-Border Sales',
    desc: 'Evaluate top worldwide engineering and executive talent based on merit rather than English fluency, closing high-value commercial agreements with clarity.',
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
              <p className="sam-usecase-desc">{uc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default UseCases;
