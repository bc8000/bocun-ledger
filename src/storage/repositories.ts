import { getMonthRange, getRecentDateRange, todayISODate } from '../domain/dates';
import type { Category, DailyAmountSummary, MonthlySummary, Transaction, TransactionKind, TransactionWithCategory } from '../domain/types';
import { db, type LedgerDatabase } from './db';

export async function listCategories(kind?: TransactionKind, database: LedgerDatabase = db): Promise<Category[]> {
  const categories = kind
    ? await database.categories.where('kind').equals(kind).toArray()
    : await database.categories.toArray();

  return categories
    .filter((category) => !category.deletedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-CN'));
}

export async function getCategoryMap(database: LedgerDatabase = db): Promise<Map<string, Category>> {
  const categories = await listCategories(undefined, database);
  return new Map(categories.map((category) => [category.id, category]));
}

export async function listTransactions(limit = 30, database: LedgerDatabase = db): Promise<TransactionWithCategory[]> {
  const [transactions, categories] = await Promise.all([
    database.transactions.orderBy('date').reverse().toArray(),
    getCategoryMap(database),
  ]);

  return transactions
    .filter((transaction) => !transaction.deletedAt)
    .sort((left, right) => {
      const dateCompare = right.date.localeCompare(left.date);
      if (dateCompare !== 0) return dateCompare;
      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .slice(0, limit)
    .map((transaction) => ({
      ...transaction,
      categoryName: transaction.categoryId ? categories.get(transaction.categoryId)?.name : undefined,
    }));
}

export async function getTransaction(id: string, database: LedgerDatabase = db): Promise<Transaction | undefined> {
  return database.transactions.get(id);
}

export async function getMonthlySummary(referenceDate = todayISODate(), database: LedgerDatabase = db): Promise<MonthlySummary> {
  const { start, end } = getMonthRange(referenceDate);
  const transactions = await database.transactions.where('date').between(start, end, true, true).toArray();

  return summarizeTransactions(transactions);
}

export async function getDailyAmountSummaries(
  days = 30,
  referenceDate = todayISODate(),
  database: LedgerDatabase = db,
): Promise<DailyAmountSummary[]> {
  const { start, end, dates } = getRecentDateRange(days, referenceDate);
  const transactions = await database.transactions.where('date').between(start, end, true, true).toArray();
  const summaries = new Map<string, DailyAmountSummary>(
    dates.map((date) => [date, { date, incomeMinor: 0, expenseMinor: 0, netMinor: 0 }]),
  );

  for (const transaction of transactions) {
    if (transaction.deletedAt) continue;
    const summary = summaries.get(transaction.date);
    if (!summary) continue;

    if (transaction.kind === 'income') {
      summary.incomeMinor += transaction.amountMinor;
    } else {
      summary.expenseMinor += transaction.amountMinor;
    }

    summary.netMinor = summary.incomeMinor - summary.expenseMinor;
  }

  return dates.map((date) => summaries.get(date)!);
}

function summarizeTransactions(transactions: Transaction[]): MonthlySummary {
  return transactions.filter((transaction) => !transaction.deletedAt).reduce<MonthlySummary>(
    (summary, transaction) => {
      if (transaction.kind === 'income') {
        summary.incomeMinor += transaction.amountMinor;
      } else {
        summary.expenseMinor += transaction.amountMinor;
      }

      summary.netMinor = summary.incomeMinor - summary.expenseMinor;
      return summary;
    },
    { incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
  );
}
