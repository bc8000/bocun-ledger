import Dexie, { type Table } from 'dexie';
import type { Account, Category, LedgerChange, MetaRecord, Transaction } from '../domain/types';

export class LedgerDatabase extends Dexie {
  meta!: Table<MetaRecord, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  changes!: Table<LedgerChange, string>;

  constructor(name = 'personal-ledger-v1') {
    super(name);

    this.version(1).stores({
      meta: 'key',
      accounts: 'id, updatedAt, deletedAt',
      categories: 'id, kind, sortOrder, deletedAt',
      transactions: 'id, date, kind, accountId, categoryId, updatedAt, deletedAt',
      changes: 'changeId, entityKind, entityId, operation, createdAt, syncState',
    });
  }
}

export const db = new LedgerDatabase();

export async function resetDatabase(database = db): Promise<void> {
  await database.transaction('rw', database.meta, database.accounts, database.categories, database.transactions, database.changes, async () => {
    await Promise.all([
      database.meta.clear(),
      database.accounts.clear(),
      database.categories.clear(),
      database.transactions.clear(),
      database.changes.clear(),
    ]);
  });
}
