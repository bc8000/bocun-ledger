import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { Dashboard } from './features/dashboard/Dashboard';
import { SettingsPanel } from './features/settings/SettingsPanel';
import { TransactionForm } from './features/transactions/TransactionForm';
import { TransactionList } from './features/transactions/TransactionList';
import { ensureSeedData } from './storage/seed';

type AppStatus = 'booting' | 'ready' | 'error';

export default function App() {
  const [status, setStatus] = useState<AppStatus>('booting');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    ensureSeedData()
      .then(() => setStatus('ready'))
      .catch((error: unknown) => {
        console.error(error);
        setStatus('error');
      });
  }, []);

  const refresh = () => setRefreshKey((key) => key + 1);

  if (status === 'booting') {
    return <AppShell subtitle="正在准备本地账本…" />;
  }

  if (status === 'error') {
    return (
      <AppShell subtitle="本地账本启动失败">
        <section className="card notice-card">
          <h2>无法打开账本</h2>
          <p>请检查浏览器是否允许 IndexedDB。本应用的数据只保存在你的设备上。</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="本地优先 · 离线可用">
      <Dashboard refreshKey={refreshKey} />
      <TransactionForm onSaved={refresh} />
      <TransactionList refreshKey={refreshKey} onChanged={refresh} />
      <SettingsPanel onImported={refresh} />
    </AppShell>
  );
}
