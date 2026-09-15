import React, { useState, useEffect, useCallback } from 'react';
import type {
  Customer,
  Experiment,
  FunnelStepMetric,
  GrowthMetrics,
  PaymentLedgerEntry,
} from '../../shared/types';
import { api, isDemoMode } from './services/index.js';
import { MetricsOverview } from './components/MetricsOverview';
import { FunnelVisualizer } from './components/FunnelVisualizer';
import { ExperimentCards } from './components/ExperimentCards';
import { WebhookSimulator } from './components/WebhookSimulator';
import { LedgerTable } from './components/LedgerTable';
import { CustomerDrawer } from './components/CustomerDrawer';
import { DemoBanner } from './components/DemoBanner';
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

      <MetricsOverview
        metrics={metrics}
        loading={loading}
        onRefresh={loadData}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
      />

      {loadError && (
        <div className="alert-box alert-warning" role="alert">
          {loadError}{' '}
          <button type="button" className="link-btn" onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {initialLoading ? (
        <div className="loading-state" role="status">
          Loading CraftFunnel dashboard...
        </div>
      ) : (
        <main className="main-content">
          <div className="content-tabs-bar">
            <div className="tabs-nav" role="tablist" aria-label="Dashboard sections">
              <button
                id="tab-growth"
                className={`tab-btn ${activeTab === 'growth' ? 'active' : ''}`}
                onClick={() => setActiveTab('growth')}
                role="tab"
                aria-selected={activeTab === 'growth'}
                aria-controls="panel-growth"
              >
                📊 Funnel & A/B Experiments
              </button>
              <button
                id="tab-billing"
                className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
                onClick={() => setActiveTab('billing')}
                role="tab"
                aria-selected={activeTab === 'billing'}
                aria-controls="panel-billing"
              >
                💳 Stripe Webhooks & Ledger ({ledgerEntries.length})
              </button>
              <button
                id="tab-customers"
                className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
                onClick={() => setActiveTab('customers')}
                role="tab"
                aria-selected={activeTab === 'customers'}
                aria-controls="panel-customers"
              >
                👥 Customers & Lifecycle ({customers.length})
              </button>
            </div>
          </div>

          {activeTab === 'growth' && (
            <div id="panel-growth" role="tabpanel" aria-labelledby="tab-growth">
              <FunnelVisualizer steps={funnelSteps} />
              <ExperimentCards experiments={experiments} onRefresh={loadData} />
            </div>
          )}

          {activeTab === 'billing' && (
            <div id="panel-billing" role="tabpanel" aria-labelledby="tab-billing">
              <WebhookSimulator customers={customers} onReconciliationComplete={loadData} />
              <LedgerTable entries={ledgerEntries} />
            </div>
          )}

          {activeTab === 'customers' && (
            <div id="panel-customers" role="tabpanel" aria-labelledby="tab-customers" className="customers-section">
              <div className="list-toolbar">
                <label htmlFor="customer-search" className="visually-hidden">
                  Search customers by name or email
                </label>
                <input
                  id="customer-search"
                  type="search"
                  placeholder="Search customers by name or email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="form-input search-input"
                />
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>MRR</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-empty">
                          No customers yet.
                        </td>
                      </tr>
                    ) : filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-empty">
                          No customers match your search criteria.
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
                          <td>
                            <strong>{cust.name}</strong>
                          </td>
                          <td className="font-mono text-xs">{cust.email}</td>
                          <td>
                            <span className={`badge badge-${cust.status}`}>{cust.status.toUpperCase()}</span>
                          </td>
                          <td>
                            <span className="font-bold text-success">€{(cust.mrr_cents / 100).toFixed(2)}</span>
                          </td>
                          <td className="text-xs text-muted">{new Date(cust.created_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer(cust);
                              }}
                              aria-label={`Inspect customer ${cust.name}`}
                            >
                              Inspect Profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      )}

      <CustomerDrawer customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
};
