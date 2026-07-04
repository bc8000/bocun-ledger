import { describe, expect, it } from 'vitest';
import { createTransaction, deleteTransaction } from '../features/transactions/transactionService';
import { exportBackup, importBackup } from '../storage/backup';
import { db, resetDatabase } from '../storage/db';
import { listCategories, listTransactions, getMonthlySummary } from '../storage/repositories';
import { ensureSeedData } from '../storage/seed';

describe('bookkeeping storage flow', () => {
  it('seeds a local ledger with defaults', async () => {
    const context = await ensureSeedData();
    const categories = await listCategories();

    expect(context.ledgerId).toMatch(/^ledger_/);
    expect(context.actorId).toMatch(/^actor_/);
    expect(context.defaultAccountId).toMatch(/^account_/);
    expect(categories.length).toBeGreaterThanOrEqual(6);
  });

  it('creates a transaction and corresponding change record', async () => {
    await ensureSeedData();
    const [category] = await listCategories('expense');

    const transaction = await createTransaction({
      kind: 'expense',
      date: '2026-07-03',
      amountMinor: 3550,
      categoryId: category.id,
      note: '午饭',
    });

    const transactions = await listTransactions();
    const changes = await db.changes.toArray();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe(transaction.id);
    expect(transactions[0].categoryName).toBe(category.name);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      entityKind: 'transaction',
      entityId: transaction.id,
      operation: 'create',
      syncState: 'local-only',
    });
  });

  it('summarizes current month income and expense', async () => {
    await ensureSeedData();
    await createTransaction({ kind: 'income', date: '2026-07-03', amountMinor: 10000 });
    await createTransaction({ kind: 'expense', date: '2026-07-04', amountMinor: 3500 });
    await createTransaction({ kind: 'expense', date: '2026-06-30', amountMinor: 9999 });

    const summary = await getMonthlySummary('2026-07-20');

    expect(summary).toEqual({
      incomeMinor: 10000,
      expenseMinor: 3500,
      netMinor: 6500,
    });
  });

  it('soft-deletes transactions and records a delete change', async () => {
    await ensureSeedData();
    const transaction = await createTransaction({ kind: 'expense', date: '2026-07-03', amountMinor: 1200 });

    await deleteTransaction(transaction.id);

    const visibleTransactions = await listTransactions();
    const storedTransaction = await db.transactions.get(transaction.id);
    const changes = await db.changes.toArray();

    expect(visibleTransactions).toHaveLength(0);
    expect(storedTransaction?.deletedAt).toBeTruthy();
    expect(changes.map((change) => change.operation).sort()).toEqual(['create', 'delete'].sort());
  });

  it('exports and imports a JSON backup round trip', async () => {
    await ensureSeedData();
    await createTransaction({ kind: 'income', date: '2026-07-03', amountMinor: 8800, note: '测试收入' });

    const backup = await exportBackup();
    await resetDatabase();
    expect(await listTransactions()).toHaveLength(0);

    await importBackup(JSON.stringify(backup));

    const restoredTransactions = await listTransactions();
    const restoredChanges = await db.changes.toArray();

    expect(restoredTransactions).toHaveLength(1);
    expect(restoredTransactions[0].note).toBe('测试收入');
    expect(restoredChanges).toHaveLength(1);
  });
});
