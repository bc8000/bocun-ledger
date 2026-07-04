import { describe, expect, it } from 'vitest';
import { decryptString, encryptString, parseEncryptedBackupEnvelope } from '../sync/crypto';

describe('encrypted sync crypto', () => {
  it('encrypts and decrypts a plaintext backup string', async () => {
    const plaintext = JSON.stringify({ note: '午饭', amount: 3550, category: '餐饮' });
    const envelope = await encryptString(plaintext, 'correct horse battery staple', { iterations: 1_000 });

    expect(envelope.app).toBe('personal-ledger-pwa');
    expect(envelope.type).toBe('encrypted-backup');
    expect(envelope.crypto.cipher).toBe('AES-GCM');
    expect(envelope.payload).not.toContain('午饭');
    expect(JSON.stringify(envelope)).not.toContain('餐饮');
    expect(JSON.stringify(envelope)).not.toContain('3550');

    await expect(decryptString(envelope, 'correct horse battery staple')).resolves.toBe(plaintext);
  });

  it('rejects the wrong passphrase', async () => {
    const envelope = await encryptString('secret ledger', 'right passphrase', { iterations: 1_000 });

    await expect(decryptString(envelope, 'wrong passphrase')).rejects.toThrow('无法解密备份');
  });

  it('rejects malformed envelopes', () => {
    expect(() => parseEncryptedBackupEnvelope('{"app":"personal-ledger-pwa"}')).toThrow('加密备份不是当前应用支持的版本');
    expect(() => parseEncryptedBackupEnvelope('{bad json')).toThrow();
  });
});
