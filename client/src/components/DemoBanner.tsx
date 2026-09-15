import React from 'react';
import { isDemoMode, resetDemoData } from '../services/index.js';

interface DemoBannerProps {
  onReset: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ onReset }) => {
  if (!isDemoMode) return null;

  const handleReset = () => {
    if (window.confirm('Reset the simulated funnel, experiment and billing data back to the seed dataset?')) {
      resetDemoData();
      onReset();
    }
  };

  return (
    <div className="demo-banner" role="status">
      <span>
        Demo mode: this runs entirely in your browser on seed data and never calls a real server or Stripe account.{' '}
        <a href="https://github.com/Taan1el/craftfunnel" target="_blank" rel="noreferrer">
          View source on GitHub
        </a>{' '}
        to run the full stack locally.
      </span>
      <button type="button" className="btn btn-secondary btn-xs" onClick={handleReset}>
        Reset demo data
      </button>
    </div>
  );
};
