import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { todayISODate } from '../../domain/dates';
import { parseAmountToMinor } from '../../domain/money';
import type { Category, TransactionKind } from '../../domain/types';
import { listCategories } from '../../storage/repositories';
import { createTransaction } from './transactionService';

type TransactionFormProps = {
  onSaved: () => void;
};

export function TransactionForm({ onSaved }: TransactionFormProps) {
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [date, setDate] = useState(todayISODate());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    listCategories(kind).then((nextCategories) => {
      if (!active) return;
      setCategories(nextCategories);
      setCategoryId((current) => {
        if (current && nextCategories.some((category) => category.id === current)) {
          return current;
        }
        return nextCategories[0]?.id ?? '';
      });
    });

    return () => {
      active = false;
    };
  }, [kind]);

  const submitLabel = useMemo(() => (kind === 'expense' ? '记一笔支出' : '记一笔收入'), [kind]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await createTransaction({
        kind,
        date,
        amountMinor: parseAmountToMinor(amount),
        categoryId: categoryId || undefined,
        note,
      });
      setAmount('');
      setNote('');
      setDate(todayISODate());
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="transaction-form-title">
      <h2 id="transaction-form-title">新增记录</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="kind-toggle" role="group" aria-label="选择记录类型">
          <button
            type="button"
            className={kind === 'expense' ? 'active' : ''}
            aria-pressed={kind === 'expense'}
            onClick={() => {
              setCategoryId('');
              setKind('expense');
            }}
          >
            支出
          </button>
          <button
            type="button"
            className={kind === 'income' ? 'active' : ''}
            aria-pressed={kind === 'income'}
            onClick={() => setKind('income')}
          >
            收入
          </button>
        </div>

        <div className="form-row">
          <Field label="金额" htmlFor="amount">
            <input
              id="amount"
              inputMode="decimal"
              placeholder="例如 35.50"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </Field>
          <Field label="日期" htmlFor="date">
            <input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </Field>
        </div>

        <Field label="分类" htmlFor="category">
          <select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="备注（可选）" htmlFor="note">
          <textarea
            id="note"
            maxLength={120}
            placeholder="例如 午饭、地铁、工资"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        {error ? <p className="error-text" role="alert">{error}</p> : null}

        <Button type="submit" disabled={saving}>
          {saving ? '保存中…' : submitLabel}
        </Button>
      </form>
    </section>
  );
}
