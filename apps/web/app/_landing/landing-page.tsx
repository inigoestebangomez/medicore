import { HeroSection } from './hero-section';
import { FeaturesSection } from './features-section';
import { CtaSection } from './cta-section';
import { FooterSection } from './footer-section';

export function LandingPage() {
  return (
    <main className="min-h-screen bg-surface-low">
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}