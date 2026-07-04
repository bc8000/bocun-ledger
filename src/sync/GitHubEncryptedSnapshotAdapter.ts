import { exportBackup, fingerprintBackup, importBackup, parseBackup, serializeBackup } from '../storage/backup';
import { decryptString, encryptString, parseEncryptedBackupEnvelope } from './crypto';
import { getGitHubFile, putGitHubFile, testGitHubConnection } from './githubClient';
import type { PullOptions, PushOptions, SyncAdapter, SyncResult, SyncStatus } from './SyncAdapter';
import type { GitHubSyncConfig } from './syncConfig';
import { updateSyncMetadata } from './syncConfig';

export class GitHubEncryptedSnapshotAdapter implements SyncAdapter {
  constructor(private readonly config: GitHubSyncConfig) {}

  async getStatus(): Promise<SyncStatus> {
    return {
      mode: 'github',
      label: 'GitHub 加密同步',
      detail: `同步到 ${this.config.owner}/${this.config.repo}:${this.config.path}`,
      configured: true,
      canPush: true,
      canPull: true,
      lastSyncAt: this.config.metadata.lastSyncAt,
      lastOperation: this.config.metadata.lastOperation,
      lastRemoteSha: this.config.metadata.lastRemoteSha,
    };
  }

  async testConnection(): Promise<void> {
    await testGitHubConnection(this.config);
  }

  async push(options?: PushOptions): Promise<SyncResult> {
    const passphrase = options?.passphrase ?? '';
    const backup = await exportBackup();
    const localFingerprint = await fingerprintBackup(backup);
    const remoteFile = await getGitHubFile(this.config);

    if (remoteFile?.sha && remoteFile.sha !== this.config.metadata.lastRemoteSha && !options?.force) {
      return {
        pushed: 0,
        pulled: 0,
        changed: false,
        conflict: true,
        remoteSha: remoteFile.sha,
        message: '远程备份已变化。请先拉取，或确认后强制覆盖远程备份。',
      };
    }

    const plaintext = serializeBackup(backup);
    const envelope = await encryptString(plaintext, passphrase);
    const result = await putGitHubFile(this.config, {
      content: JSON.stringify(envelope, null, 2),
      message: 'Update encrypted ledger backup',
      sha: remoteFile?.sha,
    });

    updateSyncMetadata({
      lastRemoteSha: result.sha,
      lastLocalFingerprint: localFingerprint,
      lastSyncAt: new Date().toISOString(),
      lastOperation: 'push',
    });

    return {
      pushed: 1,
      pulled: 0,
      changed: true,
      message: remoteFile ? '已更新 GitHub 加密备份。' : '已创建 GitHub 加密备份。',
      remoteSha: result.sha,
      htmlUrl: result.htmlUrl,
    };
  }

  async pull(options?: PullOptions): Promise<SyncResult> {
    const passphrase = options?.passphrase ?? '';
    const remoteFile = await getGitHubFile(this.config);

    if (!remoteFile) {
      return {
        pushed: 0,
        pulled: 0,
        changed: false,
        message: 'GitHub 上还没有备份文件，请先推送一次。',
      };
    }

    const envelope = parseEncryptedBackupEnvelope(remoteFile.content);
    const plaintext = await decryptString(envelope, passphrase);
    const remoteBackup = parseBackup(plaintext);
    const remoteFingerprint = await fingerprintBackup(remoteBackup);
    const localFingerprint = await fingerprintBackup(await exportBackup());
    const localChanged = Boolean(
      this.config.metadata.lastLocalFingerprint && localFingerprint !== this.config.metadata.lastLocalFingerprint,
    );

    if (localChanged && !options?.confirmReplace) {
      return {
        pushed: 0,
        pulled: 0,
        changed: false,
        conflict: true,
        remoteSha: remoteFile.sha,
        message: '本机账本自上次同步后有变化。拉取会替换本机数据，请先导出 JSON 备份并确认。',
      };
    }

    await importBackup(plaintext);

    updateSyncMetadata({
      lastRemoteSha: remoteFile.sha,
      lastLocalFingerprint: remoteFingerprint,
      lastSyncAt: new Date().toISOString(),
      lastOperation: 'pull',
    });

    return {
      pushed: 0,
      pulled: 1,
      changed: true,
      remoteSha: remoteFile.sha,
      htmlUrl: remoteFile.htmlUrl,
      message: '已从 GitHub 拉取并恢复加密备份。',
    };
  }
}
