const API = '/api';
const FIELDS = ['amount', 'category', 'date', 'description'];

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const fmt = (cents) => money.format(cents / 100);

const els = {
  income: document.getElementById('sum-income'),
  expense: document.getElementById('sum-expense'),
  net: document.getElementById('sum-net'),
  netCard: document.getElementById('net-card'),
  form: document.getElementById('tx-form'),
  amount: document.getElementById('f-amount'),
  category: document.getElementById('f-category'),
  date: document.getElementById('f-date'),
  description: document.getElementById('f-description'),
  save: document.getElementById('save'),
  filter: document.getElementById('filter'),
  status: document.getElementById('status'),
  table: document.getElementById('tx-table'),
  body: document.getElementById('tx-body'),
  toasts: document.getElementById('toasts'),
};

let categories = { income: [], expense: [] };

/* ---------- helpers ---------- */

function toast(message, type = 'error') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// One wrapper for every request: turns network failures and server errors into readable messages.
async function api(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch (e) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status}).`);
    if (data && data.errors) err.fields = data.errors;
    throw err;
  }
  return data;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // local date
}

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function currentType() {
  return els.form.elements.type.value;
}

/* ---------- client-side validation (the server re-checks everything independently) ---------- */

function validateClient(data) {
  const errors = {};
  if (!/^\d+(\.\d{1,2})?$/.test(data.amount.trim())) {
    errors.amount = 'Enter a positive amount with at most 2 decimal places.';
  } else if (Number(data.amount) <= 0) {
    errors.amount = 'Amount must be greater than zero.';
  }
  if (!data.category) errors.category = 'Choose a category.';
  if (!isRealDate(data.date)) {
    errors.date = 'Enter a valid date.';
  } else if (data.date > todayISO()) {
    errors.date = 'Date cannot be in the future.';
  } else if (data.date < '2000-01-01') {
    errors.date = 'Date must be 2000-01-01 or later.';
  }
  if (data.description.length > 200) errors.description = 'Description must be 200 characters or fewer.';
  return errors;
}

function clearErrors() {
  for (const f of FIELDS) {
    document.getElementById(`err-${f}`).textContent = '';
    els[f].classList.remove('invalid');
  }
}

function showErrors(errors) {
  for (const f of FIELDS) {
    if (errors[f]) {
      document.getElementById(`err-${f}`).textContent = errors[f];
      els[f].classList.add('invalid');
    }
  }
  const first = FIELDS.find((f) => errors[f]);
  if (first) els[first].focus();
}

/* ---------- rendering ---------- */

function fillCategories() {
  const list = categories[currentType()] || [];
  els.category.innerHTML = '';
  const placeholder = new Option('Select a category', '');
  els.category.add(placeholder);
  for (const c of list) els.category.add(new Option(c, c));
}

function renderSummary(s) {
  els.income.textContent = fmt(s.income_cents);
  els.expense.textContent = fmt(s.expense_cents);
  els.net.textContent = fmt(s.net_cents);
  els.netCard.classList.toggle('negative', s.net_cents < 0);
  els.netCard.classList.toggle('positive', s.net_cents >= 0);
}

function cell(text, label, className) {
  const td = document.createElement('td');
  td.dataset.label = label;
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function renderTransactions(list) {
  els.body.innerHTML = '';
  els.table.hidden = list.length === 0;
  const filter = els.filter.value;
  els.status.textContent = list.length
    ? `${list.length} transaction${list.length === 1 ? '' : 's'}`
    : filter
      ? `No ${filter} transactions yet.`
      : 'No transactions yet. Add your first one using the form.';

  for (const t of list) {
    const tr = document.createElement('tr');
    tr.appendChild(cell(t.date, 'Date'));
    tr.appendChild(cell(t.description || '–', 'Description'));

    const catTd = document.createElement('td');
    catTd.dataset.label = 'Category';
    const badge = document.createElement('span');
    badge.className = `badge ${t.type}`;
    badge.textContent = t.category;
    catTd.appendChild(badge);
    tr.appendChild(catTd);

    const sign = t.type === 'income' ? '+' : '−';
    tr.appendChild(cell(`${sign}${fmt(t.amount_cents)}`, 'Amount', `num ${t.type}`));

    const actions = document.createElement('td');
    actions.className = 'actions';
    const del = document.createElement('button');
    del.className = 'danger';
    del.type = 'button';
    del.textContent = 'Delete';
    del.setAttribute('aria-label', `Delete ${t.category} transaction from ${t.date}`);
    del.addEventListener('click', () => removeTransaction(t));
    actions.appendChild(del);
    tr.appendChild(actions);

    els.body.appendChild(tr);
  }
}

/* ---------- data loading: every number on screen comes from the server ---------- */

async function loadSummary() {
  renderSummary(await api(`${API}/summary`));
}

async function loadTransactions() {
  const type = els.filter.value;
  renderTransactions(await api(type ? `${API}/transactions?type=${type}` : `${API}/transactions`));
}

async function refresh() {
  try {
    await Promise.all([loadSummary(), loadTransactions()]);
  } catch (e) {
    els.status.textContent = 'Could not load data.';
    toast(e.message);
  }
}

/* ---------- actions ---------- */

async function addTransaction(e) {
  e.preventDefault();
  clearErrors();
  const data = {
    type: currentType(),
    amount: els.amount.value.trim(),
    category: els.category.value,
    date: els.date.value,
    description: els.description.value.trim(),
  };
  const errors = validateClient(data);
  if (Object.keys(errors).length) {
    showErrors(errors);
    return;
  }
  els.save.disabled = true;
  try {
    await api(`${API}/transactions`, { method: 'POST', body: JSON.stringify(data) });
    toast('Transaction added.', 'success');
    els.amount.value = '';
    els.description.value = '';
    els.category.value = '';
    await refresh();
  } catch (err) {
    if (err.fields) showErrors(err.fields); // server-side validation messages
    toast(err.message);
  } finally {
    els.save.disabled = false;
  }
}

async function removeTransaction(t) {
  const label = t.description || t.category;
  if (!confirm(`Delete "${label}" (${fmt(t.amount_cents)})?`)) return;
  try {
    await api(`${API}/transactions/${t.id}`, { method: 'DELETE' });
    toast('Transaction deleted.', 'success');
  } catch (err) {
    toast(err.message);
  }
  await refresh(); // always resync with the database
}

/* ---------- init ---------- */

els.form.addEventListener('submit', addTransaction);
for (const radio of els.form.querySelectorAll('input[name="type"]')) {
  radio.addEventListener('change', fillCategories);
}
els.filter.addEventListener('change', refresh);

(async function init() {
  els.date.value = todayISO();
  els.date.max = todayISO();
  try {
    categories = await api(`${API}/categories`);
  } catch (e) {
    toast(e.message);
  }
  fillCategories();
  await refresh();
})();
