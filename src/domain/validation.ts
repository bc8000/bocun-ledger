import { isISODate } from './dates';
import type { TransactionKind } from './types';

export type TransactionDraft = {
  kind: TransactionKind;
  date: string;
  amountMinor: number;
  categoryId?: string;
  note?: string;
};

export function validateTransactionDraft(draft: TransactionDraft): void {
  if (draft.kind !== 'income' && draft.kind !== 'expense') {
    throw new Error('请选择收入或支出');
  }

  if (!isISODate(draft.date)) {
    throw new Error('日期格式不正确');
  }

  if (!Number.isSafeInteger(draft.amountMinor) || draft.amountMinor <= 0) {
    throw new Error('金额必须大于 0');
  }

  if (draft.note && draft.note.length > 120) {
    throw new Error('备注最多 120 个字');
  }
}
