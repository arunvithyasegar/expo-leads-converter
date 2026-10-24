import React from 'react';
import { HERO_DATA } from '../data/features';
import { LeadForm } from './LeadForm';

export const HeroSection: React.FC = () => {
  return (
    <section className="hero-section" id="hero">
      <div className="container">
        <div className="hero-grid">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true"></span>
              <span>{HERO_DATA.eyebrow}</span>
            </div>

            <h1 className="hero-headline">
              Veloce Transient: <br />
              <span className="gradient-text">Where Global Travel Buyers Source &amp; Book</span>
            </h1>

            <p className="hero-description">{HERO_DATA.subheadline}</p>

            <div className="hero-cta-group">
              <a href="#demo-form" className="btn btn-primary">{HERO_DATA.primaryCta} →</a>
              <button className="btn-video" type="button">
                <span className="play-icon-circle" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </span>
                <span>{HERO_DATA.secondaryCta} (6 min)</span>
              </button>
            </div>

            <div className="hero-stats-row">
              {HERO_DATA.stats.map((st, i) => (
                <div key={i} className="stat-item">
                  <div className="stat-val">{st.value}</div>
                  <div className="stat-label">{st.label}</div>
                </div>
              ))}
            </div>
          </div>

          <LeadForm />
        </div>
      </div>
    </section>
  );
};
