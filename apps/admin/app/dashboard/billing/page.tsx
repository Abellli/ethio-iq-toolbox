'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Topbar } from '@/components/topbar';
import { getWallet, listTransactions, requestTopup } from '@/lib/api';
import type { Wallet, Transaction } from '@/lib/api';

function formatCents(cents: number) {
  return `${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`;
}

const STATUS_STYLES: Record<Transaction['status'], string> = {
  pending: 'bg-chart-amber/15 text-chart-amber',
  completed: 'bg-primary-tint text-primary',
  failed: 'bg-chart-coral/15 text-chart-coral',
};

export default function BillingPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh() {
    getWallet().then(setWallet).catch((e) => setError(e.message));
    listTransactions().then(setTransactions).catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  async function handleTopup(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await requestTopup(Math.round(Number(amount) * 100), 'bank_transfer');
      setNotice('Invoice created — an operator will confirm once payment is received.');
      setAmount('');
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Topbar title="Billing" />
      <div className="p-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <p className="chart-title">Transaction history</p>
            <div className="mt-3 divide-y divide-border">
              {transactions?.length === 0 && (
                <p className="py-4 text-sm text-text-muted">No transactions yet.</p>
              )}
              {transactions?.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-text capitalize">{t.type.replace('_', ' ')}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(t.created_at).toLocaleDateString()}
                      {t.payment_method ? ` · ${t.payment_method}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text">
                      {t.type === 'payout' ? '-' : '+'}
                      {formatCents(t.amount_cents)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <p className="chart-title">Wallet balance</p>
            <p className="kpi-number mt-1">
              {wallet ? formatCents(wallet.walletBalanceCents) : '…'}
            </p>
          </div>

          <form onSubmit={handleTopup} className="rounded-card border border-border bg-surface p-5 shadow-card">
            <p className="chart-title mb-3">Request top-up</p>
            <label className="mb-1 block text-sm text-text-muted">Amount (ETB)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mb-3 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="mb-3 text-sm text-chart-coral">{error}</p>}
            {notice && <p className="mb-3 text-sm text-primary">{notice}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-card bg-primary py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Creating invoice…' : 'Create invoice'}
            </button>
            <p className="mt-2 text-xs text-text-muted">
              Manual invoice for Phase 1 — an operator confirms once payment is received via
              Telebirr / CBE Birr / bank transfer.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
