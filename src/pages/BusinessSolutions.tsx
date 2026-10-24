import React from 'react';
import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { FeatureSection } from '../components/FeatureSection';
import { TrustSection } from '../components/TrustSection';
import { CTASection } from '../components/CTASection';
import { Footer } from '../components/Footer';
import { CAPABILITIES_DATA } from '../data/features';
import '../styles/tokens.css';

export const BusinessSolutions: React.FC = () => {
  return (
    <div className="b2b-app-wrapper">
      <Header />
      <main id="main-content">
        <HeroSection />
        <div id="capabilities">
          {CAPABILITIES_DATA.map((feat, idx) => (
            <FeatureSection 
              key={feat.id} 
              feature={feat} 
              altBg={idx % 2 === 1} 
            />
          ))}
        </div>
        <TrustSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default BusinessSolutions;
