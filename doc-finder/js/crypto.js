// Client-side encryption. Nothing leaves the browser unencrypted.
//
// Each user has a random 256-bit AES-GCM data key (DEK). The DEK is stored in
// the repo only in wrapped form: encrypted with a key derived from the user's
// vault passphrase via PBKDF2-SHA256. Changing the passphrase re-wraps the DEK
// without re-encrypting any documents.
//
// Blob format: [1 byte version][12 byte IV][AES-GCM ciphertext + tag]
// Every blob is bound to its location with additional authenticated data, so a
// ciphertext cannot be swapped into another path or another user's vault.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 600_000;
const BLOB_VERSION = 1;

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function randomId() {
  return Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function b64encode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function b64decode(str) {
  const bin = atob(str.replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKek(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

function keyfileAad(login) {
  return enc.encode(`doc-finder:dek:${login.toLowerCase()}`);
}

async function wrapDek(dek, passphrase, login) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await deriveKek(passphrase, salt, PBKDF2_ITERATIONS);
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, {
    name: 'AES-GCM',
    iv,
    additionalData: keyfileAad(login),
  });
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: b64encode(salt),
    iv: b64encode(iv),
    wrappedKey: b64encode(new Uint8Array(wrapped)),
  };
}

async function unwrapDek(keyfile, passphrase, login, extractable) {
  const kek = await deriveKek(passphrase, b64decode(keyfile.salt), keyfile.iterations);
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      b64decode(keyfile.wrappedKey),
      kek,
      { name: 'AES-GCM', iv: b64decode(keyfile.iv), additionalData: keyfileAad(login) },
      { name: 'AES-GCM', length: 256 },
      extractable,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new Error('Wrong passphrase.');
  }
}

/** Creates a new data key. Returns the keyfile to store and a non-extractable key to use. */
export async function createKeyfile(passphrase, login) {
  const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const keyfile = await wrapDek(dek, passphrase, login);
  const key = await unwrapDek(keyfile, passphrase, login, false);
  return { keyfile, key };
}

/** Unlocks an existing keyfile. The returned key cannot be exported from the browser. */
export function unlockKeyfile(keyfile, passphrase, login) {
  return unwrapDek(keyfile, passphrase, login, false);
}

/** Re-wraps the data key under a new passphrase. Documents stay as they are. */
export async function rewrapKeyfile(keyfile, oldPassphrase, newPassphrase, login) {
  const dek = await unwrapDek(keyfile, oldPassphrase, login, true);
  return wrapDek(dek, newPassphrase, login);
}

export async function encryptBytes(key, bytes, aad) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, bytes),
  );
  const out = new Uint8Array(1 + iv.length + ct.length);
  out[0] = BLOB_VERSION;
  out.set(iv, 1);
  out.set(ct, 1 + iv.length);
  return out;
}

export async function decryptBytes(key, blob, aad) {
  const u8 = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  if (u8[0] !== BLOB_VERSION) throw new Error('Unsupported encrypted file format.');
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: u8.subarray(1, 13), additionalData: enc.encode(aad) },
      key,
      u8.subarray(13),
    );
    return new Uint8Array(pt);
  } catch {
    throw new Error('Could not decrypt file (wrong key or tampered data).');
  }
}

export async function encryptJson(key, value, aad) {
  return encryptBytes(key, enc.encode(JSON.stringify(value)), aad);
}

export async function decryptJson(key, blob, aad) {
  return JSON.parse(dec.decode(await decryptBytes(key, blob, aad)));
}
