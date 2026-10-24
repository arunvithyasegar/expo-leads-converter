import React from 'react';
import { CapabilityFeature } from '../data/features';
import { ProductVisual } from './ProductVisual';

interface FeatureSectionProps {
  feature: CapabilityFeature;
  altBg?: boolean;
}

export const FeatureSection: React.FC<FeatureSectionProps> = ({ feature, altBg }) => {
  const isReverse = feature.align === 'text-right';

  return (
    <section className={`capability-section ${altBg ? 'alt-bg' : ''}`} id={feature.id}>
      <div className="container">
        <div className={`capability-grid ${isReverse ? 'reverse' : ''}`}>
          <div className="capability-content">
            <div className="capability-eyebrow">{feature.eyebrow}</div>
            <h2 className="capability-title">{feature.heading}</h2>
            <p className="capability-desc">{feature.description}</p>
            <ul className="benefit-list">
              {feature.benefits.map((b, i) => (
                <li key={i} className="benefit-item">
                  <svg className="benefit-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <a href={feature.ctaLink} className="capability-cta-link">
              <span>{feature.ctaText}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
          </div>

          <div className="capability-visual">
            <ProductVisual type={feature.mockupType} />
          </div>
        </div>
      </div>
    </section>
  );
};
