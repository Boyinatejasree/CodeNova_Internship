const CATEGORIES = require('./categories');

const MAX_AMOUNT_CENTS = 100000000000; // 1,000,000,000.00
const MAX_DESCRIPTION = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Parses "12", "12.5", "12.50" (or the equivalent number) into integer cents without floating-point math.
// Returns null for anything else: negatives, 3+ decimals, exponents, letters, empty strings.
function parseAmountToCents(raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const s = String(raw).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

// True only for real calendar dates in YYYY-MM-DD format (rejects 2026-02-31, 2026-13-01, etc.).
function isRealDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function validateTransaction(body, now = new Date()) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};

  const type = b.type;
  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Type must be "income" or "expense".';
  }

  const amountCents = parseAmountToCents(b.amount);
  if (amountCents === null) {
    errors.amount = 'Enter a positive amount with at most 2 decimal places.';
  } else if (amountCents <= 0) {
    errors.amount = 'Amount must be greater than zero.';
  } else if (amountCents > MAX_AMOUNT_CENTS) {
    errors.amount = 'Amount is too large.';
  }

  if (!errors.type) {
    if (typeof b.category !== 'string' || !CATEGORIES[type].includes(b.category)) {
      errors.category = `Choose a valid ${type} category.`;
    }
  }

  if (!isRealDate(b.date)) {
    errors.date = 'Enter a valid date (YYYY-MM-DD).';
  } else {
    const maxDate = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10); // 1-day timezone tolerance
    if (b.date < '2000-01-01') errors.date = 'Date must be 2000-01-01 or later.';
    else if (b.date > maxDate) errors.date = 'Date cannot be in the future.';
  }

  let description = '';
  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== 'string') {
      errors.description = 'Description must be text.';
    } else {
      description = b.description.trim();
      if (description.length > MAX_DESCRIPTION) {
        errors.description = `Description must be ${MAX_DESCRIPTION} characters or fewer.`;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors: null,
    value: { type, amount_cents: amountCents, category: b.category, description, date: b.date },
  };
}

module.exports = { validateTransaction, parseAmountToCents, isRealDate, MAX_DESCRIPTION };
