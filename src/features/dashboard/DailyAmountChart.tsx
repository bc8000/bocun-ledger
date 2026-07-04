import { formatCurrencyMinor } from '../../domain/money';
import type { DailyAmountSummary } from '../../domain/types';

type DailyAmountChartProps = {
  days: DailyAmountSummary[];
};

export function DailyAmountChart({ days }: DailyAmountChartProps) {
  const maxDailyAmount = Math.max(1, ...days.flatMap((day) => [day.incomeMinor, day.expenseMinor]));
  const activeDays = days.filter((day) => day.incomeMinor > 0 || day.expenseMinor > 0);
  const recentActiveDays = [...activeDays].reverse().slice(0, 5);

  return (
    <section className="card" aria-labelledby="daily-chart-title">
      <div className="section-heading">
        <div>
          <h2 id="daily-chart-title">最近 30 天</h2>
          <p className="section-subtitle">每日收入与支出金额</p>
        </div>
        <span className="summary-pill">{activeDays.length} 天有记录</span>
      </div>

      <div className="daily-legend" aria-hidden="true">
        <span><i className="legend-dot income-dot" />收入</span>
        <span><i className="legend-dot expense-dot" />支出</span>
      </div>

      <div className="daily-chart" role="img" aria-label="最近 30 天每天收入和支出柱状图">
        {days.map((day) => {
          const incomeHeight = Math.max(3, Math.round((day.incomeMinor / maxDailyAmount) * 96));
          const expenseHeight = Math.max(3, Math.round((day.expenseMinor / maxDailyAmount) * 96));
          const label = day.date.slice(5).replace('-', '/');
          const hasIncome = day.incomeMinor > 0;
          const hasExpense = day.expenseMinor > 0;

          return (
            <div
              className="daily-bar-group"
              key={day.date}
              title={`${day.date} 收入 ${formatCurrencyMinor(day.incomeMinor)}，支出 ${formatCurrencyMinor(day.expenseMinor)}`}
              aria-label={`${day.date} 收入 ${formatCurrencyMinor(day.incomeMinor)}，支出 ${formatCurrencyMinor(day.expenseMinor)}`}
            >
              <div className="daily-bars">
                <span className={`daily-bar income-bar ${hasIncome ? '' : 'empty'}`} style={{ height: `${incomeHeight}%` }} />
                <span className={`daily-bar expense-bar ${hasExpense ? '' : 'empty'}`} style={{ height: `${expenseHeight}%` }} />
              </div>
              <span className="daily-bar-label">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="daily-table" aria-label="最近有记录的日期">
        {recentActiveDays.length === 0 ? (
          <p className="empty-state">最近 30 天还没有记账。</p>
        ) : (
          recentActiveDays.map((day) => (
            <div className="daily-row" key={day.date}>
              <span>{day.date.slice(5).replace('-', '/')}</span>
              <span className="daily-row-income">收入 {formatCurrencyMinor(day.incomeMinor)}</span>
              <span className="daily-row-expense">支出 {formatCurrencyMinor(day.expenseMinor)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
