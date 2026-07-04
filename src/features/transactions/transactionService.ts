import { nowIsoString } from '../../domain/dates';
import { createChangeId, createTransactionId } from '../../domain/ids';
import type { LedgerChange, Transaction, TransactionKind } from '../../domain/types';
import { validateTransactionDraft } from '../../domain/validation';
import { db, type LedgerDatabase } from '../../storage/db';
import { getLedgerContext } from '../../storage/seed';

export type CreateTransactionInput = {
  kind: TransactionKind;
  date: string;
  amountMinor: number;
  categoryId?: string;
  note?: string;
};

const SCHEMA_VERSION = 1;

function nextVersion(): number {
  return Date.now();
}

export async function createTransaction(input: CreateTransactionInput, database: LedgerDatabase = db): Promise<Transaction> {
  validateTransactionDraft(input);
  const context = await getLedgerContext(database);
  const timestamp = nowIsoString();
  const version = nextVersion();

  const transaction: Transaction = {
    id: createTransactionId(),
    date: input.date,
    kind: input.kind,
    accountId: context.defaultAccountId,
    categoryId: input.categoryId || undefined,
    amountMinor: input.amountMinor,
    currency: 'CNY',
    note: input.note?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    version,
    updatedBy: context.actorId,
    schemaVersion: SCHEMA_VERSION,
  };

  const change: LedgerChange = {
    changeId: createChangeId(),
    entityKind: 'transaction',
    entityId: transaction.id,
    operation: 'create',
    version,
    snapshot: transaction,
    createdAt: timestamp,
    syncState: 'local-only',
  };

  await database.transaction('rw', database.transactions, database.changes, async () => {
    await database.transactions.add(transaction);
    await database.changes.add(change);
  });

  return transaction;
}

export async function deleteTransaction(transactionId: string, database: LedgerDatabase = db): Promise<void> {
  const context = await getLedgerContext(database);
  const existing = await database.transactions.get(transactionId);

  if (!existing || existing.deletedAt) {
    return;
  }

  const timestamp = nowIsoString();
  const version = nextVersion();
  const deleted: Transaction = {
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version,
    updatedBy: context.actorId,
  };

  const change: LedgerChange = {
    changeId: createChangeId(),
    entityKind: 'transaction',
    entityId: transactionId,
    operation: 'delete',
    version,
    snapshot: deleted,
    createdAt: timestamp,
    syncState: 'local-only',
  };

  await database.transaction('rw', database.transactions, database.changes, async () => {
    await database.transactions.put(deleted);
    await database.changes.add(change);
  });
}
