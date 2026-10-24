import React from 'react';

export const CTASection: React.FC = () => {
  return (
    <section className="closing-cta-section" id="convert">
      <div className="container">
        <div className="closing-cta-content">
          <h2 className="closing-cta-headline">Ready to grow your corporate travel business?</h2>
          <p className="closing-cta-desc">
            Discover why over 42,000 properties worldwide trust Veloce to win higher-margin business travel agreements and automate RFP operations.
          </p>
          <div className="closing-cta-actions">
            <a href="#demo-form" className="btn btn-white">Request a Consultation →</a>
            <a href="#demo-form" className="btn btn-outline-white">Watch 6-Min Tour</a>
          </div>
        </div>
      </div>
    </section>
  );
};
