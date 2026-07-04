import { GitHubEncryptedSnapshotAdapter } from './GitHubEncryptedSnapshotAdapter';
import { LocalOnlySyncAdapter } from './LocalOnlySyncAdapter';
import type { PullOptions, PushOptions, SyncAdapter, SyncResult, SyncStatus } from './SyncAdapter';
import { loadGitHubSyncConfig } from './syncConfig';

export class SyncService {
  constructor(private readonly adapterFactory: () => SyncAdapter = createConfiguredAdapter) {}

  getStatus(): Promise<SyncStatus> {
    return this.adapterFactory().getStatus();
  }

  testConnection(): Promise<void> {
    const adapter = this.adapterFactory();
    return adapter.testConnection ? adapter.testConnection() : Promise.resolve();
  }

  push(options?: PushOptions): Promise<SyncResult> {
    return this.adapterFactory().push(options);
  }

  pull(options?: PullOptions): Promise<SyncResult> {
    return this.adapterFactory().pull(options);
  }
}

function createConfiguredAdapter(): SyncAdapter {
  const config = loadGitHubSyncConfig();
  return config ? new GitHubEncryptedSnapshotAdapter(config) : new LocalOnlySyncAdapter();
}

export const syncService = new SyncService();
