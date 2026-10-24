import React, { useState, useEffect } from 'react';

export const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clockDate, setClockDate] = useState('24-Oct-2026');
  const [clockTime, setClockTime] = useState('13:46:55');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const updateClock = () => {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setClockDate(`${day}-${month}-${year}`);
      setClockTime(`${hours}:${minutes}:${seconds}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <aside className="announcement-bar">
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="badge">2026 Index</span>
          <span>See how Veloce Transient drives 4.2x higher corporate RFP conversion rates.</span>
          <a href="#demo-form">Watch 8-minute interactive demo →</a>
        </div>
      </aside>

      <header className={`site-header ${scrolled ? 'scrolled' : ''}`} role="banner">
        <div className="container header-inner">
          <a href="/business-travel-solutions" className="brand-logo">
            <div className="brand-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="currentColor"/></svg>
            </div>
            <span>Veloce</span>
            <span className="brand-tag">Transient</span>
          </a>

          <nav className="desktop-nav" role="navigation" aria-label="Main Navigation">
            <div className="nav-item">
              <button className="nav-trigger" type="button" aria-expanded="false">
                <span>Solutions</span>
                <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
            <div className="nav-item">
              <button className="nav-trigger" type="button" aria-expanded="false">
                <span>Products</span>
                <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
            <div className="nav-item">
              <a href="#trust" className="nav-trigger"><span>Resources</span></a>
            </div>
            <div className="nav-item">
              <a href="#trust" className="nav-trigger"><span>About</span></a>
            </div>
          </nav>

          <div className="header-actions">
            <div className="irctc-header-clock" title="Official Live Indian Standard Time (IST)">
              <span className="irctc-live-dot" aria-hidden="true"></span>
              <span className="irctc-clock-date">{clockDate}</span>
              <span className="irctc-clock-divider">|</span>
              <span className="irctc-clock-time">{clockTime}</span>
              <span className="irctc-clock-tz">IST</span>
            </div>
            <a href="/" className="nav-link-subtle">ETM Desk</a>
            <a href="#demo-form" className="btn btn-primary">Book a Demo</a>
            <button 
              className="mobile-toggle" 
              type="button" 
              aria-label="Toggle Navigation" 
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
