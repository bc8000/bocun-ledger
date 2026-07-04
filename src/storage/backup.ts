import type { Account, Category, LedgerChange, MetaRecord, Transaction } from '../domain/types';
import { db, resetDatabase, type LedgerDatabase } from './db';
import { ensureSeedData } from './seed';

export type LedgerBackup = {
  app: 'personal-ledger-pwa';
  exportedAt: string;
  schemaVersion: 1;
  meta: MetaRecord[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  changes: LedgerChange[];
};

const textEncoder = new TextEncoder();

function assertBackup(value: unknown): asserts value is LedgerBackup {
  if (!value || typeof value !== 'object') {
    throw new Error('备份文件格式不正确');
  }

  const backup = value as Partial<LedgerBackup>;

  if (backup.app !== 'personal-ledger-pwa' || backup.schemaVersion !== 1) {
    throw new Error('备份文件不是当前应用支持的版本');
  }

  if (
    typeof backup.exportedAt !== 'string' ||
    !Array.isArray(backup.meta) ||
    !Array.isArray(backup.accounts) ||
    !Array.isArray(backup.categories) ||
    !Array.isArray(backup.transactions) ||
    !Array.isArray(backup.changes)
  ) {
    throw new Error('备份文件缺少必要数据');
  }
}

export function parseBackup(rawJson: string): LedgerBackup {
  const parsed = JSON.parse(rawJson) as unknown;
  assertBackup(parsed);
  return parsed;
}

export function serializeBackup(backup: LedgerBackup, options: { normalizeExportedAt?: boolean } = {}): string {
  const normalized: LedgerBackup = {
    ...backup,
    exportedAt: options.normalizeExportedAt ? 'normalized-for-fingerprint' : backup.exportedAt,
    meta: [...backup.meta].sort((left, right) => left.key.localeCompare(right.key)),
    accounts: [...backup.accounts].sort((left, right) => left.id.localeCompare(right.id)),
    categories: [...backup.categories].sort((left, right) => left.id.localeCompare(right.id)),
    transactions: [...backup.transactions].sort((left, right) => left.id.localeCompare(right.id)),
    changes: [...backup.changes].sort((left, right) => left.changeId.localeCompare(right.changeId)),
  };

  return JSON.stringify(normalized);
}

export async function fingerprintBackup(backup: LedgerBackup): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(serializeBackup(backup, { normalizeExportedAt: true })));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function exportBackup(database: LedgerDatabase = db): Promise<LedgerBackup> {
  await ensureSeedData(database);
  const [meta, accounts, categories, transactions, changes] = await Promise.all([
    database.meta.toArray(),
    database.accounts.toArray(),
    database.categories.toArray(),
    database.transactions.toArray(),
    database.changes.toArray(),
  ]);

  return {
    app: 'personal-ledger-pwa',
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    meta,
    accounts,
    categories,
    transactions,
    changes,
  };
}

export async function importBackup(rawJson: string, database: LedgerDatabase = db): Promise<void> {
  const parsed = parseBackup(rawJson);

  await database.transaction('rw', database.meta, database.accounts, database.categories, database.transactions, database.changes, async () => {
    await resetDatabase(database);
    await database.meta.bulkPut(parsed.meta);
    await database.accounts.bulkPut(parsed.accounts);
    await database.categories.bulkPut(parsed.categories);
    await database.transactions.bulkPut(parsed.transactions);
    await database.changes.bulkPut(parsed.changes);
  });

  await ensureSeedData(database);
}

export function createBackupFilename(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `ledger-backup-${stamp}.json`;
}
