const API = '/api/notes';

const els = {
  notes: document.getElementById('notes'),
  status: document.getElementById('status'),
  search: document.getElementById('search'),
  newBtn: document.getElementById('new-note'),
  editor: document.getElementById('editor'),
  form: document.getElementById('note-form'),
  editorTitle: document.getElementById('editor-title'),
  fTitle: document.getElementById('f-title'),
  fContent: document.getElementById('f-content'),
  cancel: document.getElementById('cancel'),
  save: document.getElementById('save'),
  toasts: document.getElementById('toasts'),
  viewGrid: document.getElementById('view-grid'),
  viewList: document.getElementById('view-list'),
};

let notes = [];
let query = '';
let editingId = null;
let searchTimer = null;
let requestSeq = 0;

function toast(message, type = 'error') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// Wrapper that turns network failures and server errors into friendly messages
async function api(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (e) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON body */ }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status}).`);
  }
  return data;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function highlight(text) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const q = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
}

function formatDate(s) {
  // SQLite datetime('now') is UTC without a zone marker
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString();
}

function render() {
  els.notes.innerHTML = '';
  if (notes.length === 0) {
    els.status.textContent = query ? `No notes match “${query}”.` : 'No notes yet. Click “New note” to add one.';
    return;
  }
  els.status.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}${query ? ` matching “${query}”` : ''}`;
  for (const n of notes) {
    const card = document.createElement('article');
    card.className = 'note';
    card.innerHTML = `
      <h3>${highlight(n.title)}</h3>
      <p>${highlight(n.content)}</p>
      <div class="meta">Updated ${escapeHtml(formatDate(n.updated_at))}</div>
      <div class="row">
        <button data-act="edit">Edit</button>
        <button data-act="delete" class="danger">Delete</button>
      </div>`;
    card.querySelector('[data-act="edit"]').addEventListener('click', () => openEditor(n));
    card.querySelector('[data-act="delete"]').addEventListener('click', () => removeNote(n));
    els.notes.appendChild(card);
  }
}

async function load() {
  const seq = ++requestSeq;
  try {
    const url = query ? `${API}?q=${encodeURIComponent(query)}` : API;
    const data = await api(url);
    if (seq !== requestSeq) return; // a newer request superseded this one
    notes = data;
    render();
  } catch (e) {
    if (seq !== requestSeq) return;
    els.status.textContent = 'Could not load notes.';
    toast(e.message);
  }
}

function openEditor(note) {
  editingId = note ? note.id : null;
  els.editorTitle.textContent = note ? 'Edit note' : 'New note';
  els.fTitle.value = note ? note.title : '';
  els.fContent.value = note ? note.content : '';
  els.editor.showModal();
  els.fTitle.focus();
}

async function saveNote(e) {
  e.preventDefault();
  const body = JSON.stringify({ title: els.fTitle.value, content: els.fContent.value });
  els.save.disabled = true;
  try {
    if (editingId) {
      await api(`${API}/${editingId}`, { method: 'PUT', body });
      toast('Note updated.', 'success');
    } else {
      await api(API, { method: 'POST', body });
      toast('Note created.', 'success');
    }
    els.editor.close();
    await load(); // re-fetch so UI always mirrors the database
  } catch (err) {
    toast(err.message);
  } finally {
    els.save.disabled = false;
  }
}

async function removeNote(note) {
  if (!confirm(`Delete “${note.title}”?`)) return;
  try {
    await api(`${API}/${note.id}`, { method: 'DELETE' });
    toast('Note deleted.', 'success');
    await load();
  } catch (err) {
    toast(err.message);
    load(); // resync in case the note was already gone
  }
}

function setView(mode) {
  els.notes.className = `notes ${mode}`;
  els.viewGrid.classList.toggle('active', mode === 'grid');
  els.viewList.classList.toggle('active', mode === 'list');
  els.viewGrid.setAttribute('aria-pressed', mode === 'grid');
  els.viewList.setAttribute('aria-pressed', mode === 'list');
}

els.newBtn.addEventListener('click', () => openEditor(null));
els.cancel.addEventListener('click', () => els.editor.close());
els.form.addEventListener('submit', saveNote);
els.viewGrid.addEventListener('click', () => setView('grid'));
els.viewList.addEventListener('click', () => setView('list'));
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query = els.search.value.trim();
    load();
  }, 150);
});

load();
