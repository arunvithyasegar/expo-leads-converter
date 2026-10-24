import React from 'react';

interface ProductVisualProps {
  type: 'radar-discovery' | 'bid-workflow' | 'channel-matrix' | 'analytics-benchmarking';
}

export const ProductVisual: React.FC<ProductVisualProps> = ({ type }) => {
  if (type === 'radar-discovery') {
    return (
      <div className="mockup-container">
        <div className="mockup-header">
          <div className="mockup-window-dots">
            <span className="window-dot dot-red"></span>
            <span className="window-dot dot-yellow"></span>
            <span className="window-dot dot-green"></span>
          </div>
          <div className="mockup-title-bar">Corporate Tender Radar &bull; Live Market Sourcing</div>
          <div className="mockup-badge">84 New Tenders</div>
        </div>
        <div className="mockup-body">
          <div className="radar-metrics">
            <div className="radar-stat-box">
              <div className="radar-stat-label">Active Tenders</div>
              <div className="radar-stat-val">142</div>
            </div>
            <div className="radar-stat-box">
              <div className="radar-stat-label">Est. Room Nights</div>
              <div className="radar-stat-val">28,400</div>
            </div>
            <div className="radar-stat-box">
              <div className="radar-stat-label">Target Revenue</div>
              <div className="radar-stat-val">$6.2M</div>
            </div>
          </div>

          <div className="rfp-card-list">
            <div className="rfp-item-card">
              <div className="rfp-company-meta">
                <div className="company-avatar" style={{ background: '#2563EB' }}>AX</div>
                <div>
                  <div className="company-name">Apex Global Technologies</div>
                  <div className="company-sub">Tier 1 Technology &bull; 4,200 annual room nights</div>
                </div>
              </div>
              <div className="match-score-badge">98% Fit Score</div>
            </div>
            <div className="rfp-item-card">
              <div className="rfp-company-meta">
                <div className="company-avatar" style={{ background: '#7C3AED' }}>NV</div>
                <div>
                  <div className="company-name">Novartis Life Sciences</div>
                  <div className="company-sub">Pharmaceutical &bull; 6,800 annual room nights</div>
                </div>
              </div>
              <div className="match-score-badge">94% Fit Score</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'bid-workflow') {
    return (
      <div className="mockup-container">
        <div className="mockup-header">
          <div className="mockup-window-dots">
            <span className="window-dot dot-red"></span>
            <span className="window-dot dot-yellow"></span>
            <span className="window-dot dot-green"></span>
          </div>
          <div className="mockup-title-bar">VeloceIQ™ Bid Command Center</div>
          <div className="mockup-badge" style={{ background: '#DCFCE7', color: '#166534' }}>Auto-Sync Enabled</div>
        </div>
        <div className="mockup-body">
          <div className="bid-table-wrap">
            <table className="bid-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Room Type</th>
                  <th>Bid Rate</th>
                  <th>Yield Margin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Deloitte Global</strong></td>
                  <td>Deluxe King</td>
                  <td className="rate-badge">$265 / nt</td>
                  <td style={{ color: '#059669', fontWeight: 700 }}>+14.8%</td>
                  <td><span className="status-pill status-approved">Approved</span></td>
                </tr>
                <tr>
                  <td><strong>Amazon AWS</strong></td>
                  <td>Exec Suite</td>
                  <td className="rate-badge">$310 / nt</td>
                  <td style={{ color: '#059669', fontWeight: 700 }}>+18.2%</td>
                  <td><span className="status-pill status-negotiating">Counter Bid</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'channel-matrix') {
    return (
      <div className="mockup-container">
        <div className="mockup-header">
          <div className="mockup-window-dots">
            <span className="window-dot dot-red"></span>
            <span className="window-dot dot-yellow"></span>
            <span className="window-dot dot-green"></span>
          </div>
          <div className="mockup-title-bar">Multi-Channel Distribution Matrix</div>
          <div className="mockup-badge">Parity 100%</div>
        </div>
        <div className="mockup-body">
          <div className="channel-syndication-grid">
            <div className="channel-node-card">
              <div className="node-header">
                <span className="node-name">Sabre GDS</span>
                <span className="node-status-dot"></span>
              </div>
              <div className="node-metric">Sync: 120ms &bull; 9,420 Rates Active</div>
              <div className="node-bar"><div className="node-progress" style={{ width: '100%' }}></div></div>
            </div>
            <div className="channel-node-card">
              <div className="node-header">
                <span className="node-name">Amadeus GDS</span>
                <span className="node-status-dot"></span>
              </div>
              <div className="node-metric">Sync: 140ms &bull; 8,810 Rates Active</div>
              <div className="node-bar"><div className="node-progress" style={{ width: '100%' }}></div></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mockup-container">
      <div className="mockup-header">
        <div className="mockup-window-dots">
          <span className="window-dot dot-red"></span>
          <span className="window-dot dot-yellow"></span>
          <span className="window-dot dot-green"></span>
        </div>
        <div className="mockup-title-bar">Executive Compset Index &bull; Market Analytics</div>
        <div className="mockup-badge" style={{ background: '#E0E7FF', color: '#3730A3' }}>Index: 114.2</div>
      </div>
      <div className="mockup-body">
        <div className="analytics-header-row">
          <div className="chart-title">Negotiated ADR vs Compset Average (USD)</div>
        </div>
        <div className="chart-bars-wrap">
          <div className="chart-col">
            <div className="bar-group">
              <div className="bar bar-property" style={{ height: '70px' }}></div>
              <div className="bar bar-compset" style={{ height: '60px' }}></div>
            </div>
            <span className="col-label">Q1 2026</span>
          </div>
          <div className="chart-col">
            <div className="bar-group">
              <div className="bar bar-property" style={{ height: '98px' }}></div>
              <div className="bar bar-compset" style={{ height: '80px' }}></div>
            </div>
            <span className="col-label">Q3 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};
