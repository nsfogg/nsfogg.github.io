import { CATEGORIES, CONFIG } from './config.js';
import { GitHub, GitHubError } from './github.js';
import { ROLES, can, normalizeLogin, loadAccess, resolveRole, updateAccess } from './access.js';
import { Vault } from './vault.js';
import { highlightText, search, snippet } from './search.js';
import { extractText, ocrImages } from './extract.js';
import { canvasToBlob, pagesToPdf, preparePage } from './scanner.js';
import { suggestCategory } from './categorize.js';

// ---------------------------------------------------------------------------
// Small DOM helpers. User data is only ever inserted as text, never as HTML.

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function segmentsToNodes(segments) {
  return segments.map((s) => (s.match ? el('mark', {}, s.text) : document.createTextNode(s.text)));
}

function show(node, visible = true) {
  node.hidden = !visible;
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) show(s, s.id === id);
}

function setError(node, message) {
  node.textContent = message || '';
  show(node, Boolean(message));
}

let toastTimer;
function toast(message, kind = 'info') {
  const t = $('#toast');
  t.textContent = message;
  t.className = `toast ${kind}`;
  show(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => show(t, false), kind === 'error' ? 7000 : 3500);
}

async function busy(text, fn) {
  $('#busy-text').textContent = text;
  show($('#busy'));
  try {
    return await fn((t) => { $('#busy-text').textContent = t; });
  } finally {
    show($('#busy'), false);
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseTags(value) {
  return [...new Set(value.split(',').map((t) => t.trim()).filter(Boolean))];
}

function titleFromFileName(name) {
  return name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ').trim() || name;
}

function mimeFor(file) {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return { pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', eml: 'message/rfc822', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic' }[ext] || 'application/octet-stream';
}

function describeError(e) {
  if (e instanceof GitHubError) {
    if (e.status === 401) return 'GitHub rejected the token. It may be expired or revoked.';
    if (e.status === 403) return `${e.message}. The token may lack permission, or you hit a rate limit.`;
    if (e.status === 404) return 'Not found. Check that the token has access to the repository.';
  }
  return e?.message || String(e);
}

// ---------------------------------------------------------------------------
// Token storage. sessionStorage by default (cleared when the tab closes);
// localStorage only when the user asks to stay signed in.

const TOKEN_KEY = 'docfinder.token';
const tokenStore = {
  get() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token, remember) {
    try {
      this.clear();
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: token lives in memory only */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

// ---------------------------------------------------------------------------
// State

const state = {
  gh: null,
  user: null, // GitHub login as returned by the API
  role: null,
  vault: null,
  creating: false,
  query: '',
  category: 'All',
  sort: 'relevance',
  current: null, // { doc, url, bytes } for the open document
};

// ---------------------------------------------------------------------------
// Sign in / unlock / lock

async function signIn(token) {
  const gh = new GitHub({ token, owner: CONFIG.owner, repo: CONFIG.repo, branch: CONFIG.branch });
  const user = await gh.getUser();
  try {
    await gh.getRepo();
  } catch (e) {
    if (e.status === 404) throw new Error(`This token cannot see ${CONFIG.owner}/${CONFIG.repo}. Give it access to that repository.`);
    throw e;
  }
  await gh.ensureBranch().catch((e) => {
    if (e.status === 403 || e.status === 404) throw new Error('Token needs "Contents: Read and write" permission on the repository.');
    throw e;
  });
  const role = await resolveRole(gh, user.login, CONFIG.owner);
  const vault = new Vault(gh, user.login);
  const exists = await vault.exists();
  if (!exists && !can(role, 'write')) throw new Error('Your account is read-only and has no vault yet.');

  Object.assign(state, { gh, user: user.login, role, vault, creating: !exists });
  showUnlock();
}

function showUnlock() {
  $('#unlock-user').textContent = `@${state.user}`;
  $('#unlock-role').textContent = ROLES[state.role].label;
  $('#unlock-title').textContent = state.creating ? 'Create your vault' : 'Unlock vault';
  $('#unlock-submit').textContent = state.creating ? 'Create vault' : 'Unlock';
  show($('#unlock-create-note'), state.creating);
  show($('#unlock-confirm-wrap'), state.creating);
  $('#unlock-confirm').required = state.creating;
  $('#unlock-pass').autocomplete = state.creating ? 'new-password' : 'current-password';
  $('#unlock-pass').value = '';
  $('#unlock-confirm').value = '';
  setError($('#unlock-error'), '');
  showScreen('screen-unlock');
  $('#unlock-pass').focus();
}

async function unlock(passphrase) {
  if (state.creating) {
    await state.vault.create(passphrase);
    state.creating = false;
  } else {
    await state.vault.unlock(passphrase);
  }
  enterMain();
}

function enterMain() {
  $('#main-user').textContent = `@${state.user}`;
  $('#main-role').textContent = ROLES[state.role].label;
  show($('#btn-users'), can(state.role, 'manageUsers'));
  show($('#add-actions'), can(state.role, 'write'));
  $('#settings-repo').textContent = `${CONFIG.owner}/${CONFIG.repo} @ ${CONFIG.branch}`;
  renderCategoryChips();
  showScreen('screen-main');
  render();
  $('#search').focus();
  resetIdleTimer();
}

function lock() {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  closeCurrentDoc();
  state.vault?.lock();
  $('#results').replaceChildren();
  $('#search').value = '';
  state.query = '';
  clearTimeout(idleTimer);
  if (state.vault) showUnlock();
  else showScreen('screen-signin');
}

function signOut() {
  tokenStore.clear();
  lock();
  Object.assign(state, { gh: null, user: null, role: null, vault: null });
  $('#signin-token').value = '';
  showScreen('screen-signin');
}

let idleTimer;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (!state.vault?.key) return;
  idleTimer = setTimeout(() => {
    lock();
    toast('Vault locked after inactivity.');
  }, CONFIG.idleLockMinutes * 60_000);
}

// ---------------------------------------------------------------------------
// Search results

function renderCategoryChips() {
  const counts = new Map();
  for (const d of state.vault.docs) counts.set(d.category, (counts.get(d.category) || 0) + 1);
  const cats = ['All', ...CATEGORIES.filter((c) => counts.has(c)), ...[...counts.keys()].filter((c) => !CATEGORIES.includes(c))];
  if (!cats.includes(state.category)) state.category = 'All';
  $('#category-chips').replaceChildren(
    ...cats.map((c) =>
      el('button', {
        type: 'button',
        class: `chip${c === state.category ? ' active' : ''}`,
        'aria-pressed': String(c === state.category),
        onclick: () => {
          state.category = c;
          renderCategoryChips();
          render();
        },
      }, c, c === 'All' ? null : el('span', { class: 'count' }, counts.get(c))),
    ),
  );
}

function sortResults(results) {
  const byAdded = (a, b) => (b.doc.createdAt || '').localeCompare(a.doc.createdAt || '');
  const byDate = (a, b) => (b.doc.docDate || b.doc.createdAt || '').localeCompare(a.doc.docDate || a.doc.createdAt || '');
  const byTitle = (a, b) => a.doc.title.localeCompare(b.doc.title, undefined, { sensitivity: 'base', numeric: true });
  const sorters = {
    relevance: state.query.trim() ? (a, b) => b.score - a.score || byAdded(a, b) : byAdded,
    added: byAdded,
    date: byDate,
    title: byTitle,
  };
  return results.sort(sorters[state.sort]);
}

function docIcon(mime) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'IMG';
  if (mime.startsWith('text/')) return 'TXT';
  return 'FILE';
}

function render() {
  const docs = state.vault?.docs || [];
  const pool = state.category === 'All' ? docs : docs.filter((d) => d.category === state.category);
  const results = sortResults(search(pool, state.query));
  const q = state.query;

  const items = results.map(({ doc }) => {
    const snip = q.trim() ? snippet(doc.text, q) || snippet(doc.notes, q) : null;
    return el('li', {},
      el('button', { type: 'button', class: 'result', onclick: () => openDoc(doc.id) },
        el('span', { class: `doc-icon t-${docIcon(doc.mime).toLowerCase()}`, 'aria-hidden': 'true' }, docIcon(doc.mime)),
        el('span', { class: 'result-main' },
          el('span', { class: 'result-title' }, q.trim() ? segmentsToNodes(highlightText(doc.title, q)) : doc.title),
          el('span', { class: 'result-meta' },
            el('span', { class: 'badge cat' }, doc.category),
            doc.docDate ? ` ${formatDate(doc.docDate)}` : ` Added ${formatDate(doc.createdAt)}`,
            ` · ${formatSize(doc.size)}`),
          snip ? el('span', { class: 'result-snippet' }, segmentsToNodes(snip)) : null,
          doc.tags.length ? el('span', { class: 'tags' }, doc.tags.map((t) => el('span', { class: 'tag' }, t))) : null,
        ),
      ),
    );
  });
  $('#results').replaceChildren(...items);
  show($('#empty-state'), docs.length === 0);
  $('#result-count').textContent = docs.length === 0
    ? ''
    : q.trim()
      ? `${results.length} of ${pool.length} document${pool.length === 1 ? '' : 's'} match “${q.trim()}”`
      : `${results.length} document${results.length === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Adding documents

let addItems = [];
let scanMode = false;
let scanPages = []; // { canvas, url, text: Promise<string> }

function newItem({ bytes, fileName, mime, title }) {
  const item = {
    bytes,
    fileName,
    mime,
    title,
    category: '',
    categoryTouched: false,
    tags: '',
    docDate: '',
    notes: '',
    text: '',
    textSource: '',
    status: 'Reading text…',
    extraction: null,
    node: null,
  };
  return item;
}

function openAddDialog(mode) {
  scanMode = mode === 'scan';
  addItems = [];
  for (const p of scanPages) URL.revokeObjectURL(p.url);
  scanPages = [];
  $('#add-title').textContent = scanMode ? 'Scan a document' : 'Upload documents';
  show($('#scan-panel'), scanMode);
  $('#scan-pages').replaceChildren();
  $('#add-items').replaceChildren();
  $('#add-status').textContent = '';
  if (scanMode) {
    const item = newItem({ bytes: null, fileName: '', mime: 'application/pdf', title: `Scan ${today()}` });
    item.status = 'Add at least one page.';
    addItems.push(item);
    renderAddItem(item);
  }
  $('#dlg-add').showModal();
}

function renderAddItem(item) {
  const id = Math.random().toString(36).slice(2);
  const status = el('span', { class: 'item-status muted' }, item.status);
  const catSelect = el('select', { id: `cat-${id}`, onchange: (e) => { item.category = e.target.value; item.categoryTouched = true; } },
    el('option', { value: '' }, 'Auto-detect'),
    CATEGORIES.map((c) => el('option', { value: c }, c)));
  const node = el('fieldset', { class: 'add-item' },
    el('legend', {}, item.fileName || 'Scanned document', item.bytes ? el('span', { class: 'muted' }, ` · ${formatSize(item.bytes.byteLength)}`) : null),
    el('div', { class: 'grid2' },
      el('label', {}, 'Title', el('input', { value: item.title, required: true, oninput: (e) => { item.title = e.target.value; } })),
      el('label', {}, 'Category', catSelect),
      el('label', {}, 'Document date', el('input', { type: 'date', value: item.docDate, oninput: (e) => { item.docDate = e.target.value; } })),
      el('label', {}, 'Tags (comma separated)', el('input', { value: item.tags, placeholder: 'e.g. hpsp, 2026, car', oninput: (e) => { item.tags = e.target.value; } })),
    ),
    el('label', {}, 'Notes', el('input', { value: item.notes, placeholder: 'Anything you want to be able to search for', oninput: (e) => { item.notes = e.target.value; } })),
    addItems.length > 1 || !scanMode
      ? el('button', { type: 'button', class: 'link danger-text', onclick: () => removeAddItem(item) }, 'Remove')
      : null,
    status,
  );
  item.node = node;
  item.statusNode = status;
  item.catSelect = catSelect;
  $('#add-items').append(node);
}

function removeAddItem(item) {
  addItems = addItems.filter((i) => i !== item);
  item.node.remove();
  if (!addItems.length) $('#dlg-add').close();
}

function setItemStatus(item, text) {
  item.status = text;
  if (item.statusNode) item.statusNode.textContent = text;
}

function applyExtraction(item, { text, source }) {
  item.text = text;
  item.textSource = source;
  const guess = suggestCategory(item.title, text);
  if (!item.categoryTouched && guess) {
    item.category = guess;
    item.catSelect.value = guess;
  }
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  setItemStatus(item, source === 'none'
    ? 'Stored as-is (text search not available for this file type).'
    : `Found ${words} word${words === 1 ? '' : 's'} of searchable text${source === 'ocr' ? ' (OCR)' : ''}.`);
}

async function handleUploadFiles(files) {
  const maxBytes = CONFIG.maxUploadMB * 1024 * 1024;
  const accepted = [];
  for (const file of files) {
    if (file.size > maxBytes) {
      toast(`${file.name} is larger than ${CONFIG.maxUploadMB} MB and was skipped.`, 'error');
      continue;
    }
    accepted.push(file);
  }
  if (!accepted.length) return;
  openAddDialog('upload');
  for (const file of accepted) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = mimeFor(file);
    const item = newItem({ bytes, fileName: file.name, mime, title: titleFromFileName(file.name) });
    addItems.push(item);
    renderAddItem(item);
  }
  // Extract text one file at a time so OCR doesn't overwhelm the device.
  let chain = Promise.resolve();
  for (const item of addItems) {
    item.extraction = chain = chain.then(async () => {
      try {
        applyExtraction(item, await extractText(item.bytes, item.mime, item.fileName, (s) => setItemStatus(item, s)));
      } catch (e) {
        console.error(e);
        setItemStatus(item, `Could not read text (${e.message}). The file will still be saved.`);
      }
    });
  }
}

async function handleScanPhotos(files) {
  const enhance = $('#scan-enhance').checked;
  const item = addItems[0];
  for (const file of files) {
    let canvas;
    try {
      canvas = await preparePage(file, { enhance });
    } catch (e) {
      toast(e.message, 'error');
      continue;
    }
    const blob = await canvasToBlob(canvas);
    const page = { canvas, url: URL.createObjectURL(blob), text: null };
    const prev = scanPages.at(-1)?.text || Promise.resolve();
    page.text = prev.then(() => ocrImages([canvas], (s) => setItemStatus(item, `Page ${scanPages.indexOf(page) + 1}: ${s}`))).catch(() => '');
    scanPages.push(page);
    renderScanPages();
  }
  if (!scanPages.length) return;
  item.extraction = Promise.all(scanPages.map((p) => p.text)).then((texts) => {
    applyExtraction(item, { text: texts.join('\n').trim(), source: 'ocr' });
  });
}

function renderScanPages() {
  $('#scan-pages').replaceChildren(...scanPages.map((p, i) =>
    el('figure', { class: 'scan-page' },
      el('img', { src: p.url, alt: `Page ${i + 1}` }),
      el('figcaption', {}, `Page ${i + 1}`,
        el('button', {
          type: 'button',
          class: 'icon-btn small',
          'aria-label': `Remove page ${i + 1}`,
          onclick: () => {
            URL.revokeObjectURL(p.url);
            scanPages.splice(i, 1);
            renderScanPages();
            const item = addItems[0];
            item.extraction = Promise.all(scanPages.map((pg) => pg.text)).then((texts) => {
              if (scanPages.length) applyExtraction(item, { text: texts.join('\n').trim(), source: 'ocr' });
              else setItemStatus(item, 'Add at least one page.');
            });
          },
        }, '×')),
    )));
}

async function saveAddItems() {
  if (!addItems.length) return;
  if (scanMode && !scanPages.length) {
    toast('Add at least one page first.', 'error');
    return;
  }
  for (const item of addItems) {
    if (!item.title.trim()) {
      toast('Every document needs a title.', 'error');
      return;
    }
  }
  const saveBtn = $('#add-save');
  saveBtn.disabled = true;
  try {
    if (scanMode) {
      $('#add-status').textContent = 'Building PDF…';
      addItems[0].bytes = await pagesToPdf(scanPages.map((p) => p.canvas));
      addItems[0].fileName = `${addItems[0].title.replace(/[^\w\- ]+/g, '').trim() || 'scan'}.pdf`;
    }
    let done = 0;
    for (const item of [...addItems]) {
      $('#add-status').textContent = `Reading text (${done + 1} of ${addItems.length})…`;
      await item.extraction;
      $('#add-status').textContent = `Encrypting & uploading ${done + 1} of ${addItems.length}…`;
      await state.vault.addDocument(item.bytes, {
        title: item.title.trim(),
        category: item.category || 'Other',
        tags: parseTags(item.tags),
        docDate: item.docDate,
        notes: item.notes.trim(),
        fileName: item.fileName,
        mime: item.mime,
        text: item.text,
        textSource: item.textSource,
      });
      done++;
      item.node.remove();
      addItems = addItems.filter((i) => i !== item);
    }
    $('#dlg-add').close();
    toast(`Saved ${done} document${done === 1 ? '' : 's'}.`, 'success');
  } catch (e) {
    console.error(e);
    $('#add-status').textContent = '';
    toast(`Upload failed: ${describeError(e)}`, 'error');
  } finally {
    saveBtn.disabled = false;
    renderCategoryChips();
    render();
  }
}

// ---------------------------------------------------------------------------
// Viewing / editing a document

function closeCurrentDoc() {
  if (state.current?.url) URL.revokeObjectURL(state.current.url);
  state.current = null;
  $('#doc-preview').replaceChildren();
}

async function openDoc(id) {
  const doc = state.vault.docs.find((d) => d.id === id);
  if (!doc) return;
  closeCurrentDoc();
  const writable = can(state.role, 'write');
  const fields = {};
  const field = (label, input) => el('label', {}, label, input);
  fields.title = el('input', { value: doc.title, disabled: !writable, required: true });
  fields.category = el('select', { disabled: !writable },
    [...new Set([...CATEGORIES, doc.category])].map((c) => el('option', { value: c, selected: c === doc.category }, c)));
  fields.docDate = el('input', { type: 'date', value: doc.docDate || '', disabled: !writable });
  fields.tags = el('input', { value: doc.tags.join(', '), disabled: !writable });
  fields.notes = el('textarea', { rows: 3, disabled: !writable }, doc.notes || '');
  fields.text = el('textarea', { rows: 8, disabled: !writable, class: 'mono' }, doc.text || '');

  $('#doc-title').textContent = doc.title;
  $('#doc-form').replaceChildren(
    field('Title', fields.title),
    el('div', { class: 'grid2' }, field('Category', fields.category), field('Document date', fields.docDate)),
    field('Tags (comma separated)', fields.tags),
    field('Notes', fields.notes),
    el('details', {}, el('summary', {}, `Searchable text${doc.textSource === 'ocr' ? ' (from OCR — fix mistakes here)' : ''}`), fields.text),
    el('p', { class: 'muted small' },
      `${doc.fileName || 'File'} · ${formatSize(doc.size)} · added ${formatDate(doc.createdAt)}`,
      doc.updatedAt !== doc.createdAt ? ` · edited ${formatDate(doc.updatedAt)}` : ''),
  );
  show($('#doc-save'), writable);
  show($('#doc-delete'), can(state.role, 'delete'));
  $('#doc-preview').replaceChildren(el('div', { class: 'preview-loading' }, el('div', { class: 'spinner' }), 'Decrypting…'));
  state.current = { doc, url: null, fields };
  $('#dlg-doc').showModal();

  try {
    const bytes = await state.vault.getDocumentBytes(doc.id);
    if (state.current?.doc.id !== doc.id) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: doc.mime }));
    state.current.url = url;
    let preview;
    if (doc.mime === 'application/pdf') preview = el('iframe', { src: url, title: doc.title });
    else if (doc.mime.startsWith('image/')) preview = el('img', { src: url, alt: doc.title });
    else if (doc.mime.startsWith('text/')) preview = el('pre', {}, new TextDecoder().decode(bytes).slice(0, 200_000));
    else preview = el('div', { class: 'preview-none' }, 'No preview for this file type. Use Download.');
    $('#doc-preview').replaceChildren(preview);
  } catch (e) {
    $('#doc-preview').replaceChildren(el('div', { class: 'preview-none error' }, describeError(e)));
  }
}

async function saveCurrentDoc() {
  const { doc, fields } = state.current;
  const title = fields.title.value.trim();
  if (!title) return toast('Title is required.', 'error');
  await busy('Saving…', () => state.vault.updateDocument(doc.id, {
    title,
    category: fields.category.value,
    docDate: fields.docDate.value,
    tags: parseTags(fields.tags.value),
    notes: fields.notes.value.trim(),
    text: fields.text.value,
  }));
  $('#dlg-doc').close();
  toast('Saved.', 'success');
  renderCategoryChips();
  render();
}

async function deleteCurrentDoc() {
  const { doc } = state.current;
  if (!confirm(`Delete “${doc.title}”? This cannot be undone from the app.`)) return;
  await busy('Deleting…', () => state.vault.deleteDocument(doc.id));
  $('#dlg-doc').close();
  toast('Deleted.', 'success');
  renderCategoryChips();
  render();
}

function downloadCurrentDoc() {
  const { doc, url } = state.current || {};
  if (!url) return;
  const a = el('a', { href: url, download: doc.fileName || `${doc.title}` });
  document.body.append(a);
  a.click();
  a.remove();
}

// ---------------------------------------------------------------------------
// Admin: users & roles

async function openUsers() {
  setError($('#users-error'), '');
  $('#users-role').replaceChildren(...Object.entries(ROLES).filter(([r]) => r !== 'disabled').map(([r, { label }]) => el('option', { value: r, selected: r === 'member' }, label)));
  $('#roles-help').replaceChildren(...Object.values(ROLES).flatMap(({ label, description }) => [el('dt', {}, label), el('dd', {}, description)]));
  $('#dlg-users').showModal();
  await refreshUsers();
}

async function refreshUsers() {
  $('#users-body').replaceChildren(el('tr', {}, el('td', { colspan: '3', class: 'muted' }, 'Loading…')));
  const { access } = await loadAccess(state.gh);
  renderUsers(access);
}

function renderUsers(access) {
  const me = normalizeLogin(state.user);
  const rows = Object.entries(access.users).sort(([a], [b]) => a.localeCompare(b)).map(([login, entry]) => {
    const select = el('select', {
      'aria-label': `Role for ${login}`,
      disabled: login === me,
      onchange: (e) => changeUser(login, e.target.value),
    }, Object.entries(ROLES).map(([r, { label }]) => el('option', { value: r, selected: r === entry.role }, label)));
    return el('tr', {},
      el('td', {}, `@${login}`, login === me ? el('span', { class: 'muted' }, ' (you)') : null),
      el('td', {}, select),
      el('td', {}, login === me ? null : el('button', { type: 'button', class: 'link danger-text', onclick: () => changeUser(login, null) }, 'Remove')),
    );
  });
  $('#users-body').replaceChildren(...rows);
}

async function changeUser(login, role) {
  setError($('#users-error'), '');
  if (role === null && !confirm(`Remove @${login}? Their encrypted files stay in the repository but they can no longer sign in.`)) return;
  try {
    const access = await busy('Saving…', () => updateAccess(state.gh, (a) => {
      if (role === null) delete a.users[login];
      else a.users[login] = { ...(a.users[login] || { addedBy: normalizeLogin(state.user), addedAt: new Date().toISOString() }), role };
    }));
    renderUsers(access);
  } catch (e) {
    setError($('#users-error'), describeError(e));
    await refreshUsers();
  }
}

// ---------------------------------------------------------------------------
// Wiring

function wire() {
  $('#signin-repo').textContent = `${CONFIG.owner}/${CONFIG.repo}`;

  $('#signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('#signin-token').value.trim();
    setError($('#signin-error'), '');
    try {
      await busy('Signing in…', () => signIn(token));
      tokenStore.set(token, $('#signin-remember').checked);
      $('#signin-token').value = '';
    } catch (err) {
      setError($('#signin-error'), describeError(err));
    }
  });

  $('#unlock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = $('#unlock-pass').value;
    setError($('#unlock-error'), '');
    if (state.creating) {
      if (pass.length < 12) return setError($('#unlock-error'), 'Use at least 12 characters. A few random words works well.');
      if (pass !== $('#unlock-confirm').value) return setError($('#unlock-error'), 'Passphrases do not match.');
    }
    try {
      await busy(state.creating ? 'Creating your vault…' : 'Unlocking…', () => unlock(pass));
    } catch (err) {
      setError($('#unlock-error'), describeError(err));
    }
  });
  $('#unlock-signout').addEventListener('click', signOut);

  const search = $('#search');
  search.addEventListener('input', () => {
    state.query = search.value;
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !$('#screen-main').hidden && !document.querySelector('dialog[open]') && document.activeElement !== search && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
      e.preventDefault();
      search.focus();
    }
  });
  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  $('#btn-lock').addEventListener('click', lock);
  $('#btn-signout').addEventListener('click', signOut);
  $('#btn-users').addEventListener('click', () => openUsers().catch((e) => setError($('#users-error'), describeError(e))));
  $('#btn-settings').addEventListener('click', () => {
    $('#pass-msg').textContent = '';
    $('#dlg-settings').showModal();
  });

  $('#btn-upload').addEventListener('click', () => $('#file-upload').click());
  $('#file-upload').addEventListener('change', (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    handleUploadFiles(files);
  });
  $('#btn-scan').addEventListener('click', () => {
    openAddDialog('scan');
    $('#scan-input').click();
  });
  $('#scan-add-page').addEventListener('click', () => $('#scan-input').click());
  $('#scan-input').addEventListener('change', (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    handleScanPhotos(files);
  });
  $('#add-save').addEventListener('click', saveAddItems);
  $('#dlg-add').addEventListener('close', () => {
    for (const p of scanPages) URL.revokeObjectURL(p.url);
    scanPages = [];
    addItems = [];
  });

  $('#doc-save').addEventListener('click', () => saveCurrentDoc().catch((e) => toast(describeError(e), 'error')));
  $('#doc-delete').addEventListener('click', () => deleteCurrentDoc().catch((e) => toast(describeError(e), 'error')));
  $('#doc-download').addEventListener('click', downloadCurrentDoc);
  $('#doc-open').addEventListener('click', () => state.current?.url && window.open(state.current.url, '_blank', 'noopener'));
  $('#dlg-doc').addEventListener('close', closeCurrentDoc);

  $('#users-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const login = normalizeLogin($('#users-login').value.replace(/^@/, ''));
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38})$/.test(login)) return setError($('#users-error'), 'That is not a valid GitHub username.');
    $('#users-login').value = '';
    changeUser(login, $('#users-role').value);
  });

  $('#pass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#pass-msg');
    const [oldP, newP, newP2] = ['#pass-old', '#pass-new', '#pass-new2'].map((s) => $(s).value);
    if (newP.length < 12) return (msg.textContent = 'New passphrase must be at least 12 characters.');
    if (newP !== newP2) return (msg.textContent = 'New passphrases do not match.');
    try {
      await busy('Re-encrypting key…', () => state.vault.changePassphrase(oldP, newP));
      e.target.reset();
      msg.textContent = 'Passphrase changed. Use the new one next time you unlock.';
    } catch (err) {
      msg.textContent = describeError(err);
    }
  });

  for (const btn of document.querySelectorAll('[data-close]')) {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  }

  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) {
    document.addEventListener(ev, resetIdleTimer, { passive: true, capture: true });
  }
}

async function start() {
  wire();
  const token = tokenStore.get();
  if (!token) return showScreen('screen-signin');
  try {
    await busy('Signing in…', () => signIn(token));
  } catch (e) {
    if (e instanceof GitHubError && e.status === 401) tokenStore.clear();
    setError($('#signin-error'), describeError(e));
    showScreen('screen-signin');
  }
}

start();
