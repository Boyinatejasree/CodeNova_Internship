const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTransaction, parseAmountToCents, isRealDate } = require('./validate');

const NOW = new Date('2026-10-10T10:00:00Z');
const good = { type: 'expense', amount: '250.50', category: 'Food', date: '2026-10-09', description: 'Lunch' };

test('accepts a valid expense and converts to cents', () => {
  const r = validateTransaction(good, NOW);
  assert.equal(r.errors, null);
  assert.deepEqual(r.value, {
    type: 'expense',
    amount_cents: 25050,
    category: 'Food',
    description: 'Lunch',
    date: '2026-10-09',
  });
});

test('accepts numeric amounts and trims descriptions', () => {
  const r = validateTransaction({ ...good, amount: 19.99, description: '  tea  ' }, NOW);
  assert.equal(r.errors, null);
  assert.equal(r.value.amount_cents, 1999);
  assert.equal(r.value.description, 'tea');
});

test('description is optional', () => {
  const { description, ...rest } = good;
  const r = validateTransaction(rest, NOW);
  assert.equal(r.errors, null);
  assert.equal(r.value.description, '');
});

test('amount parsing is exact (no floating-point drift)', () => {
  assert.equal(parseAmountToCents('0.10'), 10);
  assert.equal(parseAmountToCents('0.3'), 30);
  assert.equal(parseAmountToCents(1.1), 110);
  assert.equal(parseAmountToCents('1000000'), 100000000);
});

test('rejects invalid amounts', () => {
  for (const amount of [0, '0', '0.00', -5, '-5', '12.345', 'abc', '', ' ', null, undefined, '1e3', 1e21, NaN, Infinity, [], {}, true]) {
    const r = validateTransaction({ ...good, amount }, NOW);
    assert.ok(r.errors && r.errors.amount, `amount ${String(amount)} should be rejected`);
  }
});

test('rejects absurdly large amounts', () => {
  const r = validateTransaction({ ...good, amount: '99999999999999' }, NOW);
  assert.ok(r.errors.amount);
});

test('rejects invalid dates', () => {
  for (const date of ['2026-02-31', '2026-13-01', '2026-00-10', '10-10-2026', '2026/10/09', 'yesterday', '', null, undefined, 20261009, '2026-10-9']) {
    const r = validateTransaction({ ...good, date }, NOW);
    assert.ok(r.errors && r.errors.date, `date ${String(date)} should be rejected`);
  }
});

test('rejects future dates and very old dates', () => {
  assert.ok(validateTransaction({ ...good, date: '2026-10-20' }, NOW).errors.date);
  assert.ok(validateTransaction({ ...good, date: '1999-12-31' }, NOW).errors.date);
  assert.equal(validateTransaction({ ...good, date: '2026-10-11' }, NOW).errors, null); // 1-day timezone tolerance
});

test('isRealDate handles leap years', () => {
  assert.equal(isRealDate('2028-02-29'), true);
  assert.equal(isRealDate('2027-02-29'), false);
});

test('rejects bad type', () => {
  assert.ok(validateTransaction({ ...good, type: 'transfer' }, NOW).errors.type);
  assert.ok(validateTransaction({ ...good, type: undefined }, NOW).errors.type);
});

test('category must belong to the chosen type', () => {
  assert.ok(validateTransaction({ ...good, category: 'Salary' }, NOW).errors.category); // income category on an expense
  assert.ok(validateTransaction({ ...good, category: 'Nonsense' }, NOW).errors.category);
  assert.equal(validateTransaction({ type: 'income', amount: '5000', category: 'Salary', date: '2026-10-01' }, NOW).errors, null);
});

test('rejects overly long or non-string descriptions', () => {
  assert.ok(validateTransaction({ ...good, description: 'x'.repeat(201) }, NOW).errors.description);
  assert.ok(validateTransaction({ ...good, description: 42 }, NOW).errors.description);
});

test('reports every problem at once and survives junk bodies', () => {
  const r = validateTransaction({ type: 'x', amount: '-1', date: 'nope' }, NOW);
  assert.ok(r.errors.type && r.errors.amount && r.errors.date);
  for (const body of [null, undefined, 'string', 42, []]) {
    assert.ok(validateTransaction(body, NOW).errors);
  }
});
