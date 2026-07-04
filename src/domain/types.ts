export type Currency = 'CNY';
export type TransactionKind = 'income' | 'expense';
export type EntityKind = 'account' | 'category' | 'transaction';
export type ChangeOperation = 'create' | 'update' | 'delete';
export type SyncState = 'local-only' | 'pending' | 'synced';

export type SyncMetadata = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  version: number;
  updatedBy: string;
  schemaVersion: number;
};

export type Account = SyncMetadata & {
  name: string;
  currency: Currency;
};

export type Category = SyncMetadata & {
  name: string;
  kind: TransactionKind;
  sortOrder: number;
};

export type Transaction = SyncMetadata & {
  date: string;
  kind: TransactionKind;
  accountId: string;
  categoryId?: string;
  amountMinor: number;
  currency: Currency;
  note?: string;
};

export type LedgerChange = {
  changeId: string;
  entityKind: EntityKind;
  entityId: string;
  operation: ChangeOperation;
  version: number;
  snapshot: unknown;
  createdAt: string;
  syncState: SyncState;
};

export type MetaRecord = {
  key: string;
  value: unknown;
};

export type LedgerContext = {
  ledgerId: string;
  actorId: string;
  defaultAccountId: string;
};

export type MonthlySummary = {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

export type DailyAmountSummary = MonthlySummary & {
  date: string;
};

export type TransactionWithCategory = Transaction & {
  categoryName?: string;
};
