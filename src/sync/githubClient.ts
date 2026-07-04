import type { GitHubSyncConfig } from './syncConfig';

const API_VERSION = '2022-11-28';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type GitHubApiErrorPayload = {
  message?: string;
};

export type GitHubFile = {
  content: string;
  sha: string;
  htmlUrl?: string;
};

export type PutGitHubFileResult = {
  sha: string;
  htmlUrl?: string;
};

export async function testGitHubConnection(config: GitHubSyncConfig): Promise<void> {
  const response = await githubFetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
    headers: githubHeaders(config.token),
  });

  if (!response.ok) {
    throw await githubError(response, '无法连接 GitHub 仓库');
  }
}

export async function getGitHubFile(config: GitHubSyncConfig): Promise<GitHubFile | null> {
  const url = new URL(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${normalizePath(config.path)}`);
  url.searchParams.set('ref', config.branch);

  const response = await githubFetch(url, {
    headers: githubHeaders(config.token),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await githubError(response, '无法读取 GitHub 备份文件');
  }

  const body = (await response.json()) as { content?: string; sha?: string; html_url?: string; type?: string };

  if (body.type && body.type !== 'file') {
    throw new Error('GitHub 远程路径不是文件');
  }

  if (typeof body.content !== 'string' || typeof body.sha !== 'string') {
    throw new Error('GitHub 返回的文件格式不正确');
  }

  return {
    content: decodeBase64(body.content.replace(/\s/g, '')),
    sha: body.sha,
    htmlUrl: body.html_url,
  };
}

export async function putGitHubFile(
  config: GitHubSyncConfig,
  input: { content: string; message: string; sha?: string },
): Promise<PutGitHubFileResult> {
  const response = await githubFetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${normalizePath(config.path)}`, {
    method: 'PUT',
    headers: githubHeaders(config.token),
    body: JSON.stringify({
      message: input.message,
      content: encodeBase64(input.content),
      branch: config.branch,
      ...(input.sha ? { sha: input.sha } : {}),
    }),
  });

  if (!response.ok) {
    throw await githubError(response, '无法写入 GitHub 备份文件');
  }

  const body = (await response.json()) as { content?: { sha?: string; html_url?: string } };
  const sha = body.content?.sha;

  if (!sha) {
    throw new Error('GitHub 写入成功但没有返回文件 SHA');
  }

  return {
    sha,
    htmlUrl: body.content?.html_url,
  };
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  };
}

async function githubFetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error('无法连接 GitHub。请检查网络、仓库地址和 token。');
  }
}

async function githubError(response: Response, fallback: string): Promise<Error> {
  let message = fallback;

  try {
    const payload = (await response.json()) as GitHubApiErrorPayload;
    if (payload.message) {
      message = `${fallback}：${payload.message}`;
    }
  } catch {
    // Ignore invalid error bodies and use fallback.
  }

  if (response.status === 401 || response.status === 403) {
    message = `${message}。请检查 token 是否有效，以及是否有 Contents 读写权限。`;
  }

  if (response.status === 409 || response.status === 422) {
    message = `${message}。远程文件可能已被其他设备修改，请先拉取或明确覆盖。`;
  }

  return new Error(message);
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '');
}

export function encodeBase64(value: string): string {
  return bytesToBase64(textEncoder.encode(value));
}

export function decodeBase64(value: string): string {
  return textDecoder.decode(base64ToBytes(value));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
