import { useEffect, useState } from 'react';
import { formatSignedCurrencyMinor } from '../../domain/money';
import type { TransactionWithCategory } from '../../domain/types';
import { listTransactions } from '../../storage/repositories';
import { deleteTransaction } from './transactionService';

type TransactionListProps = {
  refreshKey: number;
  onChanged: () => void;
};

export function TransactionList({ refreshKey, onChanged }: TransactionListProps) {
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listTransactions().then((nextTransactions) => {
      if (active) {
        setTransactions(nextTransactions);
      }
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function handleDelete(transactionId: string) {
    setDeletingId(transactionId);
    try {
      await deleteTransaction(transactionId);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card" aria-labelledby="transaction-list-title">
      <h2 id="transaction-list-title">最近记录</h2>
      {transactions.length === 0 ? (
        <p className="empty-state">还没有记录。先记一笔支出或收入吧。</p>
      ) : (
        <div className="list">
          {transactions.map((transaction) => {
            const isIncome = transaction.kind === 'income';
            const signedAmount = isIncome ? transaction.amountMinor : -transaction.amountMinor;

            return (
              <article className="transaction-item" key={transaction.id}>
                <div className="transaction-main">
                  <p className="transaction-title">
                    <span>{transaction.categoryName ?? (isIncome ? '收入' : '支出')}</span>
                  </p>
                  <p className="transaction-meta">{transaction.date}</p>
                  {transaction.note ? <p className="transaction-note">{transaction.note}</p> : null}
                </div>
                <div className="transaction-actions">
                  <span className={`transaction-amount ${transaction.kind}`}>{formatSignedCurrencyMinor(signedAmount)}</span>
                  <button
                    className="icon-button"
                    type="button"
                    disabled={deletingId === transaction.id}
                    onClick={() => handleDelete(transaction.id)}
                    aria-label={`删除 ${transaction.categoryName ?? '记录'}`}
                  >
                    删除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
