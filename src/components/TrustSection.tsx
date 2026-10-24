import React from 'react';
import { TRUST_PILLARS } from '../data/features';

export const TrustSection: React.FC = () => {
  return (
    <section className="trust-section" id="trust">
      <div className="container">
        <div className="section-header-centered">
          <div className="eyebrow">
            <span className="eyebrow-dot" aria-hidden="true"></span>
            <span>ENTERPRISE RELIABILITY</span>
          </div>
          <h2 className="section-headline">Why Veloce Transient?</h2>
          <p className="section-subheadline">
            The world's leading hotel chains, luxury independent resorts, and destination networks choose Veloce for mission-critical transient business.
          </p>
        </div>

        <div className="trust-pillars-grid">
          {TRUST_PILLARS.map((pillar, idx) => (
            <div key={idx} className="trust-card">
              <div className="trust-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
              </div>
              <h3 className="trust-card-title">{pillar.title}</h3>
              <p className="trust-card-desc">{pillar.description}</p>
            </div>
          ))}
        </div>

        <div className="trust-proof-strip">
          <div className="quote-block">
            &ldquo;Veloce Transient transformed how our portfolio responds to global travel bids. We increased our Fortune 500 corporate account win-rate by 38% while eliminating manual GDS rate loading errors entirely.&rdquo;
            <div className="quote-author">
              <div>
                <div className="author-meta-name">Elena Rostova</div>
                <div className="author-meta-role">Senior Vice President, Global Revenue &amp; Distribution &bull; Pinnacle Hospitality Group</div>
              </div>
            </div>
          </div>

          <div className="cert-badges-row">
            <div className="cert-badge">SOC 2 Type II</div>
            <div className="cert-badge">ISO 27001</div>
            <div className="cert-badge">GDPR / CCPA</div>
            <div className="cert-badge">99.99% Cloud SLA</div>
          </div>
        </div>
      </div>
    </section>
  );
};
