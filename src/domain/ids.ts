type IdPrefix = 'ledger' | 'actor' | 'account' | 'category' | 'transaction' | 'change';

export function createId(prefix: IdPrefix): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export const createLedgerId = () => createId('ledger');
export const createActorId = () => createId('actor');
export const createAccountId = () => createId('account');
export const createCategoryId = () => createId('category');
export const createTransactionId = () => createId('transaction');
export const createChangeId = () => createId('change');
