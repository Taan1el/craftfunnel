import React, { useState, useEffect, useCallback } from 'react';
import type {
  Customer,
  Experiment,
  FunnelStepMetric,
  GrowthMetrics,
  PaymentLedgerEntry,
} from '../../shared/types';
import { api } from './services/api';
import { MetricsOverview } from './components/MetricsOverview';
import { FunnelVisualizer } from './components/FunnelVisualizer';
import { ExperimentCards } from './components/ExperimentCards';
import { WebhookSimulator } from './components/WebhookSimulator';
import { LedgerTable } from './components/LedgerTable';
import { CustomerDrawer } from './components/CustomerDrawer';
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
    } catch (err) {
      console.error('Failed to load CraftFunnel data:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="app-container">
      <MetricsOverview
        metrics={metrics}
        loading={loading}
        onRefresh={loadData}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
      />

      <main className="main-content">
        <div className="content-tabs-bar">
          <div className="tabs-nav" role="tablist">
            <button
              className={`tab-btn ${activeTab === 'growth' ? 'active' : ''}`}
              onClick={() => setActiveTab('growth')}
              role="tab"
              aria-selected={activeTab === 'growth'}
            >
              📊 Funnel & A/B Experiments
            </button>
            <button
              className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
              onClick={() => setActiveTab('billing')}
              role="tab"
              aria-selected={activeTab === 'billing'}
            >
              💳 Stripe Webhooks & Ledger ({ledgerEntries.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => setActiveTab('customers')}
              role="tab"
              aria-selected={activeTab === 'customers'}
            >
              👥 Customers & Lifecycle ({customers.length})
            </button>
          </div>
        </div>

        {activeTab === 'growth' && (
          <>
            <FunnelVisualizer steps={funnelSteps} />
            <ExperimentCards experiments={experiments} onRefresh={loadData} />
          </>
        )}

        {activeTab === 'billing' && (
          <>
            <WebhookSimulator
              customers={customers}
              onReconciliationComplete={loadData}
            />
            <LedgerTable entries={ledgerEntries} />
          </>
        )}

        {activeTab === 'customers' && (
          <div className="customers-section">
            <div className="list-toolbar">
              <input
                type="search"
                placeholder="Search customers by name or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="form-input search-input"
                aria-label="Search customers"
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
                  {filteredCustomers.length === 0 ? (
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
                          if (e.key === 'Enter') setSelectedCustomer(cust);
                        }}
                      >
                        <td>
                          <strong>{cust.name}</strong>
                        </td>
                        <td className="font-mono text-xs">{cust.email}</td>
                        <td>
                          <span className={`badge badge-${cust.status}`}>
                            {cust.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="font-bold text-success">
                            €{(cust.mrr_cents / 100).toFixed(2)}
                          </span>
                        </td>
                        <td className="text-xs text-muted">
                          {new Date(cust.created_at).toLocaleDateString()}
                        </td>
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

      <CustomerDrawer
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </div>
  );
};
