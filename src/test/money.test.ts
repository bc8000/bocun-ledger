import { describe, expect, it } from 'vitest';
import { formatCurrencyMinor, formatSignedCurrencyMinor, parseAmountToMinor } from '../domain/money';

describe('money utilities', () => {
  it('parses yuan strings into integer minor units', () => {
    expect(parseAmountToMinor('35')).toBe(3500);
    expect(parseAmountToMinor('35.5')).toBe(3550);
    expect(parseAmountToMinor('0.01')).toBe(1);
    expect(parseAmountToMinor('1,234.56')).toBe(123456);
  });

  it('rejects invalid or non-positive amounts', () => {
    expect(() => parseAmountToMinor('')).toThrow();
    expect(() => parseAmountToMinor('0')).toThrow();
    expect(() => parseAmountToMinor('-1')).toThrow();
    expect(() => parseAmountToMinor('12.345')).toThrow();
  });

  it('formats minor units as CNY', () => {
    expect(formatCurrencyMinor(123456)).toContain('1,234.56');
    expect(formatSignedCurrencyMinor(123)).toContain('+');
    expect(formatSignedCurrencyMinor(-123)).toContain('-');
  });
});
