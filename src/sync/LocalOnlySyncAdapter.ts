import type { PushOptions, PullOptions, SyncAdapter, SyncResult, SyncStatus } from './SyncAdapter';

export class LocalOnlySyncAdapter implements SyncAdapter {
  async getStatus(): Promise<SyncStatus> {
    return {
      mode: 'local-only',
      label: '仅本机',
      detail: '数据只保存在当前浏览器。填写 GitHub 配置后可启用加密同步。',
      configured: false,
      canPush: false,
      canPull: false,
    };
  }

  async testConnection(): Promise<void> {
    throw new Error('请先填写完整的 GitHub 仓库、token 和备份路径。');
  }

  async push(_options?: PushOptions): Promise<SyncResult> {
    return {
      pushed: 0,
      pulled: 0,
      changed: false,
      message: '尚未配置 GitHub 加密同步。',
    };
  }

  async pull(_options?: PullOptions): Promise<SyncResult> {
    return {
      pushed: 0,
      pulled: 0,
      changed: false,
      message: '尚未配置 GitHub 加密同步。',
    };
  }
}
