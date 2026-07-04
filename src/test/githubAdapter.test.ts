import { describe, expect, it, vi } from 'vitest';
import { createTransaction } from '../features/transactions/transactionService';
import { fingerprintBackup, exportBackup } from '../storage/backup';
import { db } from '../storage/db';
import { listTransactions } from '../storage/repositories';
import { ensureSeedData } from '../storage/seed';
import { GitHubEncryptedSnapshotAdapter } from '../sync/GitHubEncryptedSnapshotAdapter';
import { decryptString, encryptString } from '../sync/crypto';
import { decodeBase64, encodeBase64 } from '../sync/githubClient';
import { loadSyncSettings, type GitHubSyncConfig } from '../sync/syncConfig';

function config(overrides: Partial<GitHubSyncConfig> = {}): GitHubSyncConfig {
  return {
    owner: 'octocat',
    repo: 'ledger',
    branch: 'main',
    path: 'ledger/encrypted-backup.json',
    rememberToken: false,
    token: 'github_pat_test',
    metadata: {},
    ...overrides,
  };
}

describe('GitHub encrypted snapshot adapter', () => {
  it('pushes an encrypted backup and saves sync metadata', async () => {
    await ensureSeedData();
    await createTransaction({ kind: 'expense', date: '2026-07-03', amountMinor: 3550, note: '午饭' });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: { sha: 'remote-sha-1', html_url: 'https://github.com/file' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new GitHubEncryptedSnapshotAdapter(config());
    const result = await adapter.push({ passphrase: 'sync passphrase' });

    expect(result.changed).toBe(true);
    expect(result.remoteSha).toBe('remote-sha-1');

    const putBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as { content: string; sha?: string };
    const uploadedEnvelope = decodeBase64(putBody.content);
    expect(putBody.sha).toBeUndefined();
    expect(uploadedEnvelope).toContain('encrypted-backup');
    expect(uploadedEnvelope).not.toContain('午饭');
    expect(uploadedEnvelope).not.toContain('3550');

    const saved = loadSyncSettings();
    expect(saved.metadata.lastRemoteSha).toBe('remote-sha-1');
    expect(saved.metadata.lastOperation).toBe('push');
    expect(saved.metadata.lastLocalFingerprint).toBeTruthy();
  });

  it('pulls, decrypts, and imports the remote backup', async () => {
    await ensureSeedData();
    await createTransaction({ kind: 'income', date: '2026-07-03', amountMinor: 10000, note: '本地会被替换' });

    const remoteBackup = await exportBackup();
    remoteBackup.transactions = [];
    remoteBackup.changes = [];
    const remoteEnvelope = await encryptString(JSON.stringify(remoteBackup), 'sync passphrase', { iterations: 1_000 });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            type: 'file',
            content: encodeBase64(JSON.stringify(remoteEnvelope)),
            sha: 'remote-sha-2',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const adapter = new GitHubEncryptedSnapshotAdapter(config());
    const result = await adapter.pull({ passphrase: 'sync passphrase', confirmReplace: true });

    expect(result.changed).toBe(true);
    expect(await listTransactions()).toHaveLength(0);
    expect(loadSyncSettings().metadata.lastRemoteSha).toBe('remote-sha-2');
  });

  it('wrong passphrase leaves local data unchanged', async () => {
    await ensureSeedData();
    await createTransaction({ kind: 'income', date: '2026-07-03', amountMinor: 10000, note: '保留本地' });
    const remoteEnvelope = await encryptString('{"app":"personal-ledger-pwa"}', 'right passphrase', { iterations: 1_000 });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ type: 'file', content: encodeBase64(JSON.stringify(remoteEnvelope)), sha: 'remote-sha-3' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const adapter = new GitHubEncryptedSnapshotAdapter(config());
    await expect(adapter.pull({ passphrase: 'wrong passphrase', confirmReplace: true })).rejects.toThrow('无法解密备份');

    const transactions = await listTransactions();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].note).toBe('保留本地');
  });

  it('blocks normal push when remote sha changed', async () => {
    await ensureSeedData();
    await createTransaction({ kind: 'expense', date: '2026-07-03', amountMinor: 1200 });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ type: 'file', content: encodeBase64('{}'), sha: 'new-remote-sha' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const localFingerprint = await fingerprintBackup(await exportBackup());
    const adapter = new GitHubEncryptedSnapshotAdapter(
      config({ metadata: { lastRemoteSha: 'old-remote-sha', lastLocalFingerprint: localFingerprint } }),
    );

    const result = await adapter.push({ passphrase: 'sync passphrase' });

    expect(result.conflict).toBe(true);
    expect(result.changed).toBe(false);
    expect(await db.changes.count()).toBe(1);
  });
});
