import { useEffect, useState } from 'react';
import { formatCurrencyMinor } from '../../domain/money';
import type { DailyAmountSummary, MonthlySummary } from '../../domain/types';
import { getDailyAmountSummaries, getMonthlySummary } from '../../storage/repositories';
import { DailyAmountChart } from './DailyAmountChart';

type DashboardProps = {
  refreshKey: number;
};

const EMPTY_SUMMARY: MonthlySummary = {
  incomeMinor: 0,
  expenseMinor: 0,
  netMinor: 0,
};

export function Dashboard({ refreshKey }: DashboardProps) {
  const [summary, setSummary] = useState<MonthlySummary>(EMPTY_SUMMARY);
  const [dailySummaries, setDailySummaries] = useState<DailyAmountSummary[]>([]);

  useEffect(() => {
    let active = true;

    Promise.all([getMonthlySummary(), getDailyAmountSummaries()]).then(([nextSummary, nextDailySummaries]) => {
      if (active) {
        setSummary(nextSummary);
        setDailySummaries(nextDailySummaries);
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <>
      <section className="card" aria-labelledby="dashboard-title">
        <h2 id="dashboard-title">本月概览</h2>
        <div className="summary-grid">
          <article className="summary-item" aria-label="本月收入">
            <p className="summary-label">收入</p>
            <p className="summary-value income">{formatCurrencyMinor(summary.incomeMinor)}</p>
          </article>
          <article className="summary-item" aria-label="本月支出">
            <p className="summary-label">支出</p>
            <p className="summary-value expense">{formatCurrencyMinor(summary.expenseMinor)}</p>
          </article>
          <article className="summary-item" aria-label="本月结余">
            <p className="summary-label">结余</p>
            <p className="summary-value net">{formatCurrencyMinor(summary.netMinor)}</p>
          </article>
        </div>
      </section>
      <DailyAmountChart days={dailySummaries} />
    </>
  );
}
