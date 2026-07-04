import type { Currency } from './types';

const AMOUNT_PATTERN = /^(?:\d+|\d*\.\d{1,2})$/;

export function parseAmountToMinor(input: string): number {
  const normalized = input.trim().replace(/,/g, '');

  if (!AMOUNT_PATTERN.test(normalized)) {
    throw new Error('金额格式不正确，最多保留两位小数');
  }

  const [yuanPartRaw, centPartRaw = ''] = normalized.split('.');
  const yuanPart = yuanPartRaw === '' ? '0' : yuanPartRaw;
  const centPart = centPartRaw.padEnd(2, '0');
  const amountMinor = Number.parseInt(yuanPart, 10) * 100 + Number.parseInt(centPart || '0', 10);

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('金额必须大于 0');
  }

  return amountMinor;
}

export function formatCurrencyMinor(amountMinor: number, currency: Currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatSignedCurrencyMinor(amountMinor: number, currency: Currency = 'CNY'): string {
  const prefix = amountMinor > 0 ? '+' : amountMinor < 0 ? '-' : '';
  return `${prefix}${formatCurrencyMinor(Math.abs(amountMinor), currency)}`;
}
