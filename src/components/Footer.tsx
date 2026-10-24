import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-top-grid">
          <div className="footer-brand-col">
            <div className="brand-logo" style={{ color: '#FFFFFF' }}>
              <div className="brand-icon">
                <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="currentColor"/></svg>
              </div>
              <span>Veloce</span>
              <span className="brand-tag" style={{ background: 'rgba(255,255,255,0.1)', color: '#60A5FA' }}>Transient</span>
            </div>
            <p>
              The enterprise transient business and corporate travel sourcing platform empowering suppliers, hotel groups, and venues to win more corporate bids.
            </p>
          </div>

          <div>
            <h3 className="footer-col-title">Solutions</h3>
            <ul className="footer-links-list">
              <li><a className="footer-link" href="#growth-discovery">Corporate Travel Sourcing</a></li>
              <li><a className="footer-link" href="#workflow-rfp">RFP Bid Management</a></li>
              <li><a className="footer-link" href="#distribution-accuracy">Rate Distribution</a></li>
              <li><a className="footer-link" href="#evaluation-analytics">Compset Benchmarking</a></li>
            </ul>
          </div>

          <div>
            <h3 className="footer-col-title">Platform</h3>
            <ul className="footer-links-list">
              <li><a className="footer-link" href="#capabilities">VeloceIQ™ Rate Engine</a></li>
              <li><a className="footer-link" href="#capabilities">Channel Syndicator</a></li>
              <li><a className="footer-link" href="#capabilities">Parity Sentinel</a></li>
            </ul>
          </div>

          <div>
            <h3 className="footer-col-title">Resources</h3>
            <ul className="footer-links-list">
              <li><a className="footer-link" href="#trust">Customer Case Studies</a></li>
              <li><a className="footer-link" href="#trust">2026 Corporate Index</a></li>
              <li><a className="footer-link" href="#trust">Knowledge Base</a></li>
            </ul>
          </div>

          <div>
            <h3 className="footer-col-title">Company</h3>
            <ul className="footer-links-list">
              <li><a className="footer-link" href="#trust">About Veloce</a></li>
              <li><a className="footer-link" href="#trust">Trust &amp; Security</a></li>
              <li><a className="footer-link" href="#demo-form">Contact Sales</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div>© 2026 Veloce Hospitality Technologies Inc. All rights reserved.</div>
          <div className="footer-legal-links">
            <a href="#privacy">Privacy Notice</a>
            <a href="#terms">Terms of Service</a>
            <a href="#trust">Security &amp; Compliance</a>
            <a href="#accessibility">Accessibility Statement</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
