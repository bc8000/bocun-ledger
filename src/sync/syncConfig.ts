export type SavedSyncMetadata = {
  lastRemoteSha?: string;
  lastLocalFingerprint?: string;
  lastSyncAt?: string;
  lastOperation?: 'push' | 'pull';
};

export type GitHubSyncSettings = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  rememberToken: boolean;
  metadata: SavedSyncMetadata;
};

export type GitHubSyncConfig = GitHubSyncSettings & {
  token: string;
};

export const DEFAULT_SYNC_SETTINGS: GitHubSyncSettings = {
  owner: '',
  repo: '',
  branch: 'main',
  path: 'ledger/encrypted-backup.json',
  rememberToken: false,
  metadata: {},
};

const SETTINGS_KEY = 'personal-ledger.github-sync.settings';
const LOCAL_TOKEN_KEY = 'personal-ledger.github-sync.token.local';
const SESSION_TOKEN_KEY = 'personal-ledger.github-sync.token.session';
const memoryLocalStorage = new Map<string, string>();
const memorySessionStorage = new Map<string, string>();

export function parseRepoSlug(value: string): Pick<GitHubSyncSettings, 'owner' | 'repo'> {
  const [owner = '', repo = ''] = value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').split('/');
  return { owner: owner.trim(), repo: repo.trim() };
}

export function formatRepoSlug(settings: Pick<GitHubSyncSettings, 'owner' | 'repo'>): string {
  return [settings.owner, settings.repo].filter(Boolean).join('/');
}

export function loadSyncSettings(): GitHubSyncSettings {
  const rawSettings = getStorageItem('local', SETTINGS_KEY);

  if (!rawSettings) {
    return { ...DEFAULT_SYNC_SETTINGS, metadata: {} };
  }

  try {
    const parsed = JSON.parse(rawSettings) as Partial<GitHubSyncSettings>;
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SYNC_SETTINGS, metadata: {} };
  }
}

export function saveSyncSettings(settings: GitHubSyncSettings): void {
  setStorageItem('local', SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function saveSyncToken(token: string, rememberToken: boolean): void {
  clearSyncToken();
  const trimmed = token.trim();

  if (!trimmed) {
    return;
  }

  if (rememberToken) {
    setStorageItem('local', LOCAL_TOKEN_KEY, trimmed);
  } else {
    setStorageItem('session', SESSION_TOKEN_KEY, trimmed);
  }
}

export function loadSyncToken(): string {
  return getStorageItem('session', SESSION_TOKEN_KEY) ?? getStorageItem('local', LOCAL_TOKEN_KEY) ?? '';
}

export function clearSyncToken(): void {
  removeStorageItem('local', LOCAL_TOKEN_KEY);
  removeStorageItem('session', SESSION_TOKEN_KEY);
}

export function loadGitHubSyncConfig(): GitHubSyncConfig | null {
  const settings = loadSyncSettings();
  const token = loadSyncToken();

  if (!isSettingsComplete(settings) || !token) {
    return null;
  }

  return {
    ...settings,
    token,
  };
}

export function updateSyncMetadata(metadata: SavedSyncMetadata): void {
  const settings = loadSyncSettings();
  saveSyncSettings({
    ...settings,
    metadata: {
      ...settings.metadata,
      ...metadata,
    },
  });
}

export function isSettingsComplete(settings: GitHubSyncSettings): boolean {
  return Boolean(settings.owner.trim() && settings.repo.trim() && settings.branch.trim() && settings.path.trim());
}

function normalizeSettings(settings: Partial<GitHubSyncSettings>): GitHubSyncSettings {
  return {
    owner: settings.owner?.trim() ?? DEFAULT_SYNC_SETTINGS.owner,
    repo: settings.repo?.trim() ?? DEFAULT_SYNC_SETTINGS.repo,
    branch: settings.branch?.trim() || DEFAULT_SYNC_SETTINGS.branch,
    path: normalizePath(settings.path || DEFAULT_SYNC_SETTINGS.path),
    rememberToken: Boolean(settings.rememberToken),
    metadata: {
      lastRemoteSha: settings.metadata?.lastRemoteSha,
      lastLocalFingerprint: settings.metadata?.lastLocalFingerprint,
      lastSyncAt: settings.metadata?.lastSyncAt,
      lastOperation: settings.metadata?.lastOperation,
    },
  };
}

function normalizePath(path: string): string {
  return path.trim().replace(/^\/+/, '') || DEFAULT_SYNC_SETTINGS.path;
}

function getStorageItem(kind: 'local' | 'session', key: string): string | null {
  const storage = getBrowserStorage(kind);

  if (storage) {
    return storage.getItem(key);
  }

  return getMemoryStorage(kind).get(key) ?? null;
}

function setStorageItem(kind: 'local' | 'session', key: string, value: string): void {
  const storage = getBrowserStorage(kind);

  if (storage) {
    storage.setItem(key, value);
    return;
  }

  getMemoryStorage(kind).set(key, value);
}

function removeStorageItem(kind: 'local' | 'session', key: string): void {
  const storage = getBrowserStorage(kind);

  if (storage) {
    storage.removeItem(key);
    return;
  }

  getMemoryStorage(kind).delete(key);
}

function getBrowserStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? (globalThis.localStorage ?? null) : (globalThis.sessionStorage ?? null);
  } catch {
    return null;
  }
}

function getMemoryStorage(kind: 'local' | 'session'): Map<string, string> {
  return kind === 'local' ? memoryLocalStorage : memorySessionStorage;
}
