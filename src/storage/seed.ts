import { createAccountId, createActorId, createCategoryId, createLedgerId } from '../domain/ids';
import type { Account, Category, LedgerContext, MetaRecord, TransactionKind } from '../domain/types';
import { nowIsoString } from '../domain/dates';
import { db, type LedgerDatabase } from './db';

const META_LEDGER_ID = 'ledgerId';
const META_ACTOR_ID = 'actorId';
const META_DEFAULT_ACCOUNT_ID = 'defaultAccountId';
const SCHEMA_VERSION = 1;

type DefaultCategory = {
  name: string;
  kind: TransactionKind;
};

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: '餐饮', kind: 'expense' },
  { name: '交通', kind: 'expense' },
  { name: '购物', kind: 'expense' },
  { name: '其他支出', kind: 'expense' },
  { name: '工资', kind: 'income' },
  { name: '其他收入', kind: 'income' },
];

export async function ensureSeedData(database: LedgerDatabase = db): Promise<LedgerContext> {
  const existingLedgerId = await getMeta<string>(META_LEDGER_ID, database);
  const existingActorId = await getMeta<string>(META_ACTOR_ID, database);
  const existingDefaultAccountId = await getMeta<string>(META_DEFAULT_ACCOUNT_ID, database);

  if (existingLedgerId && existingActorId && existingDefaultAccountId) {
    return {
      ledgerId: existingLedgerId,
      actorId: existingActorId,
      defaultAccountId: existingDefaultAccountId,
    };
  }

  const ledgerId = existingLedgerId ?? createLedgerId();
  const actorId = existingActorId ?? createActorId();
  const defaultAccountId = existingDefaultAccountId ?? createAccountId();
  const timestamp = nowIsoString();

  await database.transaction('rw', database.meta, database.accounts, database.categories, async () => {
    await database.meta.bulkPut([
      { key: META_LEDGER_ID, value: ledgerId },
      { key: META_ACTOR_ID, value: actorId },
      { key: META_DEFAULT_ACCOUNT_ID, value: defaultAccountId },
      { key: 'schemaVersion', value: SCHEMA_VERSION },
    ] satisfies MetaRecord[]);

    const accountExists = await database.accounts.get(defaultAccountId);

    if (!accountExists) {
      const account: Account = {
        id: defaultAccountId,
        name: '默认账户',
        currency: 'CNY',
        createdAt: timestamp,
        updatedAt: timestamp,
        version: Date.now(),
        updatedBy: actorId,
        schemaVersion: SCHEMA_VERSION,
      };
      await database.accounts.put(account);
    }

    const existingCategories = await database.categories.count();

    if (existingCategories === 0) {
      const categories: Category[] = DEFAULT_CATEGORIES.map((category, index) => ({
        id: createCategoryId(),
        name: category.name,
        kind: category.kind,
        sortOrder: index,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: Date.now() + index,
        updatedBy: actorId,
        schemaVersion: SCHEMA_VERSION,
      }));

      await database.categories.bulkAdd(categories);
    }
  });

  return {
    ledgerId,
    actorId,
    defaultAccountId,
  };
}

export async function getLedgerContext(database: LedgerDatabase = db): Promise<LedgerContext> {
  return ensureSeedData(database);
}

export async function getMeta<T>(key: string, database: LedgerDatabase = db): Promise<T | undefined> {
  const record = await database.meta.get(key);
  return record?.value as T | undefined;
}
