import type { PropsWithChildren } from 'react';

type AppShellProps = PropsWithChildren<{
  subtitle: string;
}>;

export function AppShell({ children, subtitle }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">极简记账</h1>
          <p className="app-subtitle">{subtitle}</p>
        </div>
        <span className="app-badge">v0.1</span>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
