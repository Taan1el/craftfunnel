import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, CreditCard, Users, Search } from 'lucide-react';
import type {
  Customer,
  Experiment,
  FunnelStepMetric,
  GrowthMetrics,
  PaymentLedgerEntry,
} from '../../shared/types';
import { api, isDemoMode } from './services/index.js';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { FunnelVisualizer } from './components/FunnelVisualizer';
import { ExperimentCards } from './components/ExperimentCards';
import { WebhookSimulator } from './components/WebhookSimulator';
import { LedgerTable } from './components/LedgerTable';
import { CustomerDrawer } from './components/CustomerDrawer';
import { DemoBanner } from './components/DemoBanner';
import { pluralize } from './utils/pluralize.js';
import './App.css';

export const App: React.FC = () => {
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [funnelSteps, setFunnelSteps] = useState<FunnelStepMetric[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<PaymentLedgerEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [activeTab, setActiveTab] = useState<'growth' | 'billing' | 'customers'>('growth');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [m, f, exp, led, cust] = await Promise.all([
        api.getMetrics(),
        api.getFunnel(),
        api.getExperiments(),
        api.getLedger(),
        api.getCustomers(),
      ]);

      setMetrics(m);
      setFunnelSteps(f);
      setExperiments(exp);
      setLedgerEntries(led);
      setCustomers(cust);
      setLoadError(null);
    } catch (err) {
      console.error('Failed to load CraftFunnel data:', err);
      setLoadError('Could not load dashboard data. The API may be unreachable.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => {
      setLoading(false);
      setInitialLoading(false);
    });
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleDemoReset = useCallback(() => {
    setSelectedCustomer(null);
    loadData();
  }, [loadData]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="app-container">
      {isDemoMode && <DemoBanner onReset={handleDemoReset} />}

      <Header
        onRefresh={loadData}
        loading={loading}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
      />

      {loadError && (
        <div className="alert alert-error" role="alert" style={{ maxWidth: 1200, margin: '1rem auto 0', width: '100%' }}>
          <span className="alert-message">{loadError}</span>
          <button type="button" className="link-btn" onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {initialLoading ? (
        <div className="loading-state" role="status">
          Loading CraftFunnel dashboard.
        </div>
      ) : (
        <main className="app-main">
          <StatsBar metrics={metrics} />

          <div>
            <div className="tabs-nav" role="tablist" aria-label="Dashboard sections">
              <button
                id="tab-growth"
                className={`tab-btn ${activeTab === 'growth' ? 'active' : ''}`}
                onClick={() => setActiveTab('growth')}
                role="tab"
                aria-selected={activeTab === 'growth'}
                aria-controls="panel-growth"
              >
                <BarChart3 size={16} aria-hidden="true" />
                Funnel &amp; experiments
              </button>
              <button
                id="tab-billing"
                className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveTab('billing')}
                role="tab"
                aria-selected={activeTab === 'billing'}
                aria-controls="panel-billing"
              >
                <CreditCard size={16} aria-hidden="true" />
                Billing ({ledgerEntries.length})
              </button>
              <button
                id="tab-customers"
                className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
                onClick={() => setActiveTab('customers')}
                role="tab"
                aria-selected={activeTab === 'customers'}
                aria-controls="panel-customers"
              >
                <Users size={16} aria-hidden="true" />
                {customers.length} {pluralize(customers.length, 'customer')}
              </button>
            </div>

            {activeTab === 'growth' && (
              <div id="panel-growth" role="tabpanel" aria-labelledby="tab-growth" className="tab-panel">
                <FunnelVisualizer steps={funnelSteps} />
                <ExperimentCards experiments={experiments} onRefresh={loadData} />
              </div>
            )}

            {activeTab === 'billing' && (
              <div id="panel-billing" role="tabpanel" aria-labelledby="tab-billing" className="tab-panel">
                <div className="billing-split">
                  <WebhookSimulator customers={customers} onReconciliationComplete={loadData} />
                  <LedgerTable entries={ledgerEntries} />
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div id="panel-customers" role="tabpanel" aria-labelledby="tab-customers" className="tab-panel">
                <div className="section-header">
                  <h2 className="section-heading">Customers</h2>
                  <p className="section-description">
                    {customers.length} {pluralize(customers.length, 'customer')} in the lifecycle. Select a row to inspect a
                    profile.
                  </p>
                </div>

                <div className="list-toolbar">
                  <div className="search-field">
                    <Search size={16} aria-hidden="true" />
                    <label htmlFor="customer-search" className="sr-only">
                      Search customers by name or email
                    </label>
                    <input
                      id="customer-search"
                      type="search"
                      placeholder="Search by name or email"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>MRR</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="table-empty">
                            No customers yet.
                          </td>
                        </tr>
                      ) : filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="table-empty">
                            No customers match "{customerSearch}".
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((cust) => (
                          <tr
                            key={cust.id}
                            className="clickable-row"
                            onClick={() => setSelectedCustomer(cust)}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedCustomer(cust);
                              }
                            }}
                          >
                            <td>{cust.name}</td>
                            <td className="mono" style={{ fontSize: 13 }}>
                              {cust.email}
                            </td>
                            <td>
                              <span className="badge">{cust.status}</span>
                            </td>
                            <td className={`amount-cell ${cust.mrr_cents > 0 ? 'is-positive' : ''}`}>
                              &euro;{(cust.mrr_cents / 100).toFixed(2)}
                            </td>
                            <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                              {new Date(cust.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      <footer className="app-footer">
        <span>MIT licensed</span>
        <a href="https://github.com/Taan1el/craftfunnel" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>

      <CustomerDrawer customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
};
