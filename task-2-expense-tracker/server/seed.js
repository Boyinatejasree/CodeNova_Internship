// Optional sample data for demos and screenshots: npm run seed
// Only inserts when the table is empty, unless you pass --force.
const db = require('./db');
const { validateTransaction } = require('./validate');

const force = process.argv.includes('--force');
const existing = db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
if (existing > 0 && !force) {
  console.log(`Table already has ${existing} rows. Use "npm run seed -- --force" to add sample data anyway.`);
  process.exit(0);
}

const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const samples = [
  { type: 'income', amount: '45000', category: 'Salary', description: 'Monthly stipend', date: daysAgo(9) },
  { type: 'income', amount: '3500', category: 'Freelance', description: 'Landing page project', date: daysAgo(6) },
  { type: 'expense', amount: '12000', category: 'Rent', description: 'Hostel rent', date: daysAgo(8) },
  { type: 'expense', amount: '850.50', category: 'Food', description: 'Groceries', date: daysAgo(5) },
  { type: 'expense', amount: '320', category: 'Transport', description: 'Metro card top-up', date: daysAgo(4) },
  { type: 'expense', amount: '999', category: 'Bills', description: 'Internet bill', date: daysAgo(3) },
  { type: 'expense', amount: '1499', category: 'Shopping', description: 'Headphones', date: daysAgo(2) },
  { type: 'expense', amount: '250', category: 'Entertainment', description: 'Movie night', date: daysAgo(1) },
  { type: 'expense', amount: '180.75', category: 'Food', description: 'Lunch with friends', date: daysAgo(0) },
];

const insert = db.prepare(
  'INSERT INTO transactions (type, amount_cents, category, description, date) VALUES (?, ?, ?, ?, ?)'
);
const run = db.transaction(() => {
  for (const s of samples) {
    const { errors, value } = validateTransaction(s);
    if (errors) throw new Error(`Bad seed row: ${JSON.stringify(errors)}`);
    insert.run(value.type, value.amount_cents, value.category, value.description, value.date);
  }
});
run();
console.log(`Inserted ${samples.length} sample transactions.`);
