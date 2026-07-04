export type SyncStatus = {
  mode: 'local-only' | 'github';
  label: string;
  detail: string;
  configured: boolean;
  canPush: boolean;
  canPull: boolean;
  lastSyncAt?: string;
  lastOperation?: 'push' | 'pull';
  lastRemoteSha?: string;
  conflict?: boolean;
};

export type SyncResult = {
  pushed: number;
  pulled: number;
  changed: boolean;
  message: string;
  remoteSha?: string;
  htmlUrl?: string;
  conflict?: boolean;
};

export type PushOptions = {
  passphrase: string;
  force?: boolean;
};

export type PullOptions = {
  passphrase: string;
  confirmReplace?: boolean;
};

export interface SyncAdapter {
  getStatus(): Promise<SyncStatus>;
  testConnection?(): Promise<void>;
  push(options?: PushOptions): Promise<SyncResult>;
  pull(options?: PullOptions): Promise<SyncResult>;
}
