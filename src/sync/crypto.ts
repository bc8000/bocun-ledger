export type EncryptedBackupEnvelope = {
  app: 'personal-ledger-pwa';
  type: 'encrypted-backup';
  envelopeVersion: 1;
  createdAt: string;
  crypto: {
    kdf: 'PBKDF2-SHA-256';
    iterations: number;
    salt: string;
    cipher: 'AES-GCM';
    iv: string;
    tagLength: 128;
  };
  payload: string;
};

export const DEFAULT_KDF_ITERATIONS = 310_000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function assertEncryptedBackupEnvelope(value: unknown): asserts value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object') {
    throw new Error('加密备份格式不正确');
  }

  const envelope = value as Partial<EncryptedBackupEnvelope>;

  if (envelope.app !== 'personal-ledger-pwa' || envelope.type !== 'encrypted-backup' || envelope.envelopeVersion !== 1) {
    throw new Error('加密备份不是当前应用支持的版本');
  }

  if (!envelope.crypto || typeof envelope.crypto !== 'object') {
    throw new Error('加密备份缺少加密参数');
  }

  if (
    envelope.crypto.kdf !== 'PBKDF2-SHA-256' ||
    envelope.crypto.cipher !== 'AES-GCM' ||
    envelope.crypto.tagLength !== 128 ||
    !Number.isSafeInteger(envelope.crypto.iterations) ||
    envelope.crypto.iterations < 1 ||
    typeof envelope.crypto.salt !== 'string' ||
    typeof envelope.crypto.iv !== 'string' ||
    typeof envelope.payload !== 'string'
  ) {
    throw new Error('加密备份参数不正确');
  }
}

export function parseEncryptedBackupEnvelope(rawJson: string): EncryptedBackupEnvelope {
  const parsed = JSON.parse(rawJson) as unknown;
  assertEncryptedBackupEnvelope(parsed);
  return parsed;
}

export async function encryptString(
  plaintext: string,
  passphrase: string,
  options: { iterations?: number } = {},
): Promise<EncryptedBackupEnvelope> {
  assertPassphrase(passphrase);
  const iterations = options.iterations ?? DEFAULT_KDF_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const createdAt = new Date().toISOString();
  const key = await deriveAesKey(passphrase, salt, iterations);
  const header = createEnvelopeHeader({ createdAt, iterations, salt, iv });
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      tagLength: 128,
      additionalData: toArrayBuffer(textEncoder.encode(JSON.stringify(header))),
    },
    key,
    toArrayBuffer(textEncoder.encode(plaintext)),
  );

  return {
    ...header,
    payload: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptString(envelope: EncryptedBackupEnvelope, passphrase: string): Promise<string> {
  assertPassphrase(passphrase);
  assertEncryptedBackupEnvelope(envelope);

  try {
    const salt = base64UrlToBytes(envelope.crypto.salt);
    const iv = base64UrlToBytes(envelope.crypto.iv);
    const key = await deriveAesKey(passphrase, salt, envelope.crypto.iterations);
    const header = envelopeHeaderForAad(envelope);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
        tagLength: 128,
        additionalData: toArrayBuffer(textEncoder.encode(JSON.stringify(header))),
      },
      key,
      toArrayBuffer(base64UrlToBytes(envelope.payload)),
    );

    return textDecoder.decode(plaintext);
  } catch {
    throw new Error('无法解密备份：密码错误或远程文件已损坏');
  }
}

function createEnvelopeHeader({
  createdAt,
  iterations,
  salt,
  iv,
}: {
  createdAt: string;
  iterations: number;
  salt: Uint8Array;
  iv: Uint8Array;
}): Omit<EncryptedBackupEnvelope, 'payload'> {
  return {
    app: 'personal-ledger-pwa',
    type: 'encrypted-backup',
    envelopeVersion: 1,
    createdAt,
    crypto: {
      kdf: 'PBKDF2-SHA-256',
      iterations,
      salt: bytesToBase64Url(salt),
      cipher: 'AES-GCM',
      iv: bytesToBase64Url(iv),
      tagLength: 128,
    },
  };
}

function envelopeHeaderForAad(envelope: EncryptedBackupEnvelope): Omit<EncryptedBackupEnvelope, 'payload'> {
  return {
    app: envelope.app,
    type: envelope.type,
    envelopeVersion: envelope.envelopeVersion,
    createdAt: envelope.createdAt,
    crypto: {
      kdf: envelope.crypto.kdf,
      iterations: envelope.crypto.iterations,
      salt: envelope.crypto.salt,
      cipher: envelope.crypto.cipher,
      iv: envelope.crypto.iv,
      tagLength: envelope.crypto.tagLength,
    },
  };
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(textEncoder.encode(passphrase)), 'PBKDF2', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function assertPassphrase(passphrase: string): void {
  if (passphrase.trim().length < 8) {
    throw new Error('加密密码至少需要 8 个字符');
  }
}
