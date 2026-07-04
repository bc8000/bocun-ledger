import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { createBackupFilename, exportBackup, importBackup } from '../../storage/backup';
import { syncService } from '../../sync/SyncService';
import type { SyncResult, SyncStatus } from '../../sync/SyncAdapter';
import {
  clearSyncToken,
  DEFAULT_SYNC_SETTINGS,
  formatRepoSlug,
  loadSyncSettings,
  loadSyncToken,
  parseRepoSlug,
  saveSyncSettings,
  saveSyncToken,
  type GitHubSyncSettings,
} from '../../sync/syncConfig';

type SettingsPanelProps = {
  onImported: () => void;
};

export function SettingsPanel({ onImported }: SettingsPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<GitHubSyncSettings>(() => loadSyncSettings());
  const [repoSlug, setRepoSlug] = useState(() => formatRepoSlug(loadSyncSettings()));
  const [token, setToken] = useState(() => loadSyncToken());
  const [passphrase, setPassphrase] = useState('');

  useEffect(() => {
    refreshStatus();
  }, []);

  async function refreshStatus() {
    const status = await syncService.getStatus();
    setSyncStatus(status);
  }

  async function handleExport() {
    setBusy(true);
    setMessage('');

    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = createBackupFilename();
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('备份文件已生成，请妥善保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setMessage('');

    try {
      const rawJson = await file.text();
      await importBackup(rawJson);
      setMessage('导入完成。');
      onImported();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  function buildSettingsFromForm(): GitHubSyncSettings {
    const repo = parseRepoSlug(repoSlug);
    return {
      ...settings,
      owner: repo.owner,
      repo: repo.repo,
      branch: settings.branch.trim() || DEFAULT_SYNC_SETTINGS.branch,
      path: settings.path.trim() || DEFAULT_SYNC_SETTINGS.path,
      rememberToken: settings.rememberToken,
    };
  }

  async function saveGitHubConfig(): Promise<GitHubSyncSettings> {
    const nextSettings = buildSettingsFromForm();
    saveSyncSettings(nextSettings);
    saveSyncToken(token, nextSettings.rememberToken);
    setSettings(nextSettings);
    setRepoSlug(formatRepoSlug(nextSettings));
    await refreshStatus();
    return nextSettings;
  }

  async function handleSaveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      await saveGitHubConfig();
      setMessage('GitHub 同步配置已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存配置失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleTestConnection() {
    setBusy(true);
    setMessage('');

    try {
      await saveGitHubConfig();
      await syncService.testConnection();
      await refreshStatus();
      setMessage('GitHub 连接成功。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'GitHub 连接失败');
    } finally {
      setBusy(false);
    }
  }

  async function handlePush() {
    setBusy(true);
    setMessage('');

    try {
      await saveGitHubConfig();
      const result = await syncService.push({ passphrase });
      let finalResult: SyncResult = result;

      if (result.conflict) {
        const shouldOverwrite = window.confirm(`${result.message}\n\n是否强制覆盖 GitHub 远程备份？`);
        if (!shouldOverwrite) {
          setMessage(result.message);
          return;
        }
        finalResult = await syncService.push({ passphrase, force: true });
      }

      await refreshStatus();
      setMessage(finalResult.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '推送失败');
    } finally {
      setBusy(false);
    }
  }

  async function handlePull() {
    const confirmed = window.confirm('拉取 GitHub 备份会替换当前浏览器里的本地账本。建议先导出 JSON 备份。确定继续吗？');
    if (!confirmed) return;

    setBusy(true);
    setMessage('');

    try {
      await saveGitHubConfig();
      const result = await syncService.pull({ passphrase, confirmReplace: true });
      await refreshStatus();
      setMessage(result.message);
      if (result.changed) {
        onImported();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '拉取失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgetToken() {
    clearSyncToken();
    setToken('');
    await refreshStatus();
    setMessage('已忘记本设备保存的 GitHub token。');
  }

  return (
    <section className="card" aria-labelledby="settings-title">
      <h2 id="settings-title">备份与同步</h2>
      <p className="settings-hint">
        当前模式：<strong>{syncStatus?.label ?? '读取中…'}</strong>
        {syncStatus ? `。${syncStatus.detail}` : ''}
      </p>
      {syncStatus?.lastSyncAt ? (
        <p className="settings-hint">
          上次同步：{new Date(syncStatus.lastSyncAt).toLocaleString('zh-CN')}（{syncStatus.lastOperation === 'push' ? '推送' : '拉取'}）
        </p>
      ) : null}

      <div className="settings-actions">
        <Button type="button" variant="secondary" disabled={busy} onClick={handleExport}>
          导出 JSON
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          导入 JSON
        </Button>
      </div>
      <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={handleFileChange} />

      <form className="sync-form" onSubmit={handleSaveConfig}>
        <div className="section-divider" />
        <h3>GitHub 加密同步</h3>
        <p className="settings-hint">
          GitHub 上只会保存加密后的备份文件。请使用只授权目标仓库、仅有 Contents 读写权限的 fine-grained token。
        </p>

        <Field label="GitHub 仓库（owner/repo）" htmlFor="github-repo">
          <input
            id="github-repo"
            placeholder="例如 octocat/my-ledger"
            value={repoSlug}
            onChange={(event) => setRepoSlug(event.target.value)}
            autoComplete="off"
          />
        </Field>

        <div className="form-row">
          <Field label="分支" htmlFor="github-branch">
            <input
              id="github-branch"
              value={settings.branch}
              onChange={(event) => setSettings((current) => ({ ...current, branch: event.target.value }))}
              autoComplete="off"
            />
          </Field>
          <Field label="备份路径" htmlFor="github-path">
            <input
              id="github-path"
              value={settings.path}
              onChange={(event) => setSettings((current) => ({ ...current, path: event.target.value }))}
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="GitHub token" htmlFor="github-token">
          <input
            id="github-token"
            type="password"
            placeholder="ghp_... 或 github_pat_..."
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
          />
        </Field>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.rememberToken}
            onChange={(event) => setSettings((current) => ({ ...current, rememberToken: event.target.checked }))}
          />
          <span>在本设备记住 token（方便但风险更高）</span>
        </label>

        <Field label="加密密码" htmlFor="sync-passphrase">
          <input
            id="sync-passphrase"
            type="password"
            placeholder="至少 8 个字符；不要忘记，无法找回"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <div className="settings-actions sync-actions">
          <Button type="submit" variant="secondary" disabled={busy}>
            保存配置
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={handleTestConnection}>
            测试连接
          </Button>
          <Button type="button" disabled={busy} onClick={handlePush}>
            推送加密备份
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={handlePull}>
            拉取并恢复
          </Button>
        </div>

        <Button type="button" variant="danger" disabled={busy || !token} onClick={handleForgetToken}>
          忘记 token
        </Button>
      </form>

      {message ? (
        <p className="settings-hint" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
