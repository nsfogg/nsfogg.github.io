// Role-based access control.
//
// vault/access.json (plaintext, in the private repo) maps GitHub logins to roles.
// Roles gate what the app lets each user do. Confidentiality does not depend on
// the app behaving: every user's documents are encrypted with a key only their
// passphrase can unlock, so even another collaborator on the repo — including
// an admin — cannot read them.

import { isConflict } from './github.js';

export const ACCESS_PATH = 'vault/access.json';

export const ROLES = {
  admin: { label: 'Admin', description: 'Full access to their own vault, and manages who can sign in.', perms: ['read', 'write', 'delete', 'manageUsers'] },
  member: { label: 'Member', description: 'Upload, search, edit and delete documents in their own vault.', perms: ['read', 'write', 'delete'] },
  readonly: { label: 'Read-only', description: 'Search, view and download documents in their own vault. No changes.', perms: ['read'] },
  disabled: { label: 'Disabled', description: 'Cannot sign in. Their encrypted files are kept.', perms: [] },
};

const enc = new TextEncoder();
const dec = new TextDecoder();

export function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase();
}

export function can(role, perm) {
  return Boolean(ROLES[role]?.perms.includes(perm));
}

export async function loadAccess(gh) {
  const file = await gh.getFile(ACCESS_PATH);
  if (!file) return { access: null, sha: null };
  return { access: JSON.parse(dec.decode(file.bytes)), sha: file.sha };
}

/**
 * Resolves the signed-in user's role. On first use (no access.json yet) the
 * repository owner is bootstrapped as the first admin.
 */
export async function resolveRole(gh, login, repoOwner) {
  const me = normalizeLogin(login);
  let { access } = await loadAccess(gh);
  if (!access) {
    if (me !== normalizeLogin(repoOwner)) {
      throw new Error(`This vault has not been set up yet. The repository owner (${repoOwner}) must sign in first.`);
    }
    access = {
      v: 1,
      users: { [me]: { role: 'admin', addedBy: me, addedAt: new Date().toISOString() } },
    };
    try {
      await saveAccess(gh, access, null, 'vault: initialize access control');
    } catch (e) {
      if (!isConflict(e)) throw e;
      ({ access } = await loadAccess(gh)); // someone else initialized it first
    }
  }
  const entry = access.users?.[me];
  if (!entry || !ROLES[entry.role]) {
    throw new Error(`@${login} has not been given access to this vault. Ask an admin to add you.`);
  }
  if (entry.role === 'disabled') throw new Error(`@${login}'s access to this vault has been disabled.`);
  return entry.role;
}

export async function saveAccess(gh, access, sha, message = 'vault: update access control') {
  const bytes = enc.encode(JSON.stringify(access, null, 2) + '\n');
  return gh.putFile(ACCESS_PATH, bytes, message, sha);
}

/** Applies fn to the latest access.json and saves it, retrying on concurrent edits. */
export async function updateAccess(gh, fn) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { access, sha } = await loadAccess(gh);
    const next = structuredClone(access);
    fn(next);
    const admins = Object.values(next.users).filter((u) => u.role === 'admin');
    if (admins.length === 0) throw new Error('There must be at least one admin.');
    try {
      await saveAccess(gh, next, sha);
      return next;
    } catch (e) {
      if (!isConflict(e) || attempt === 2) throw e;
    }
  }
}
