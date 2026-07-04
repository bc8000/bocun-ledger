import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64, encodeBase64, getGitHubFile, putGitHubFile } from '../sync/githubClient';
import type { GitHubSyncConfig } from '../sync/syncConfig';

const config: GitHubSyncConfig = {
  owner: 'octocat',
  repo: 'ledger',
  branch: 'main',
  path: 'ledger/encrypted-backup.json',
  rememberToken: false,
  token: 'github_pat_test',
  metadata: {},
};

describe('GitHub Contents API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('decodes an existing remote file and returns its sha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            type: 'file',
            content: encodeBase64('{"encrypted":true}'),
            sha: 'abc123',
            html_url: 'https://github.com/octocat/ledger/blob/main/ledger/encrypted-backup.json',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const file = await getGitHubFile(config);

    expect(file).toEqual({
      content: '{"encrypted":true}',
      sha: 'abc123',
      htmlUrl: 'https://github.com/octocat/ledger/blob/main/ledger/encrypted-backup.json',
    });
  });

  it('returns null when remote file does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })));

    await expect(getGitHubFile(config)).resolves.toBeNull();
  });

  it('creates a new file without sha and updates with sha', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ content: { sha: 'newsha', html_url: 'https://github.com/file' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await putGitHubFile(config, { content: '{"payload":"ciphertext"}', message: 'create' });
    await putGitHubFile(config, { content: '{"payload":"ciphertext2"}', message: 'update', sha: 'oldsha' });

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const firstCall = calls[0];
    const secondCall = calls[1];
    if (!firstCall || !secondCall) throw new Error('Expected two fetch calls');
    const firstBody = JSON.parse(firstCall[1].body as string) as { sha?: string; content: string };
    const secondBody = JSON.parse(secondCall[1].body as string) as { sha?: string; content: string };

    expect(firstBody.sha).toBeUndefined();
    expect(secondBody.sha).toBe('oldsha');
    expect(decodeBase64(firstBody.content)).toBe('{"payload":"ciphertext"}');
  });

  it('turns auth and conflict errors into readable messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 })));

    await expect(getGitHubFile(config)).rejects.toThrow('token');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'sha does not match' }), { status: 409 })));

    await expect(putGitHubFile(config, { content: '{}', message: 'update', sha: 'stale' })).rejects.toThrow('远程文件可能已被其他设备修改');
  });
});
