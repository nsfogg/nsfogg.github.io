// A user's encrypted document vault, stored in the repo under vault/users/<login>/.
//
//   keyfile.json   the user's data key, wrapped with their passphrase
//   index.enc      encrypted list of documents: titles, tags, extracted text...
//   docs/<id>.enc  encrypted original files
//
// File names are random ids and commit messages are generic, so the repository
// reveals nothing about the documents beyond their count and sizes.

import { createKeyfile, decryptBytes, decryptJson, encryptBytes, encryptJson, randomId, rewrapKeyfile, unlockKeyfile } from './crypto.js';
import { isConflict } from './github.js';
import { normalizeLogin } from './access.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

export class Vault {
  constructor(gh, login) {
    this.gh = gh;
    this.login = normalizeLogin(login);
    this.base = `vault/users/${this.login}`;
    this.key = null;
    this.docs = [];
    this.indexSha = null;
  }

  get keyfilePath() { return `${this.base}/keyfile.json`; }
  get indexPath() { return `${this.base}/index.enc`; }
  docPath(id) { return `${this.base}/docs/${id}.enc`; }
  aad(name) { return `${this.login}:${name}`; }

  async loadKeyfile() {
    const file = await this.gh.getFile(this.keyfilePath);
    return file ? { keyfile: JSON.parse(dec.decode(file.bytes)), sha: file.sha } : null;
  }

  async exists() {
    return (await this.loadKeyfile()) !== null;
  }

  async create(passphrase) {
    const { keyfile, key } = await createKeyfile(passphrase, this.login);
    await this.gh.putFile(this.keyfilePath, enc.encode(JSON.stringify(keyfile, null, 2)), 'vault: create key');
    this.key = key;
    this.docs = [];
    this.indexSha = await this.gh.putFile(
      this.indexPath,
      await encryptJson(key, { v: 1, docs: [] }, this.aad('index')),
      'vault: create index',
    );
  }

  async unlock(passphrase) {
    const kf = await this.loadKeyfile();
    if (!kf) throw new Error('No vault found for this account.');
    this.key = await unlockKeyfile(kf.keyfile, passphrase, this.login);
    await this.refresh();
  }

  async changePassphrase(oldPassphrase, newPassphrase) {
    const kf = await this.loadKeyfile();
    const keyfile = await rewrapKeyfile(kf.keyfile, oldPassphrase, newPassphrase, this.login);
    await this.gh.putFile(this.keyfilePath, enc.encode(JSON.stringify(keyfile, null, 2)), 'vault: rotate passphrase', kf.sha);
  }

  lock() {
    this.key = null;
    this.docs = [];
    this.indexSha = null;
  }

  async readIndex() {
    const file = await this.gh.getFile(this.indexPath);
    if (!file) return { docs: [], sha: null };
    const index = await decryptJson(this.key, file.bytes, this.aad('index'));
    return { docs: index.docs || [], sha: file.sha };
  }

  async refresh() {
    const { docs, sha } = await this.readIndex();
    this.docs = docs;
    this.indexSha = sha;
    return docs;
  }

  /**
   * Applies fn to the index and saves it. If another device changed the index
   * in the meantime, re-reads the latest version and re-applies fn.
   */
  async mutateIndex(fn, message) {
    let docs = structuredClone(this.docs);
    let sha = this.indexSha;
    for (let attempt = 0; ; attempt++) {
      fn(docs);
      const blob = await encryptJson(this.key, { v: 1, docs }, this.aad('index'));
      try {
        this.indexSha = await this.gh.putFile(this.indexPath, blob, message, sha);
        this.docs = docs;
        return;
      } catch (e) {
        if (!isConflict(e) || attempt >= 3) throw e;
        ({ docs, sha } = await this.readIndex());
      }
    }
  }

  /** Encrypts and uploads a file, then records it in the index. */
  async addDocument(bytes, meta) {
    const id = randomId();
    const now = new Date().toISOString();
    const doc = {
      id,
      title: meta.title || meta.fileName || 'Untitled',
      category: meta.category || 'Other',
      tags: meta.tags || [],
      docDate: meta.docDate || '',
      notes: meta.notes || '',
      fileName: meta.fileName || '',
      mime: meta.mime || 'application/octet-stream',
      size: bytes.byteLength,
      text: meta.text || '',
      textSource: meta.textSource || '',
      createdAt: now,
      updatedAt: now,
    };
    const blob = await encryptBytes(this.key, bytes, this.aad(`doc:${id}`));
    await this.gh.putFile(this.docPath(id), blob, 'vault: add document');
    await this.mutateIndex((docs) => docs.push(doc), 'vault: update index');
    return doc;
  }

  async getDocumentBytes(id) {
    const file = await this.gh.getFile(this.docPath(id));
    if (!file) throw new Error('Document file is missing from the repository.');
    return decryptBytes(this.key, file.bytes, this.aad(`doc:${id}`));
  }

  async updateDocument(id, patch) {
    await this.mutateIndex((docs) => {
      const doc = docs.find((d) => d.id === id);
      if (doc) Object.assign(doc, patch, { id, updatedAt: new Date().toISOString() });
    }, 'vault: update index');
  }

  async deleteDocument(id) {
    await this.mutateIndex((docs) => {
      const i = docs.findIndex((d) => d.id === id);
      if (i >= 0) docs.splice(i, 1);
    }, 'vault: update index');
    const sha = await this.gh.getSha(this.docPath(id));
    if (sha) await this.gh.deleteFile(this.docPath(id), sha, 'vault: delete document');
  }
}
