const { Client } = require('./node_modules/pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_uwgqFW46ryYb@ep-damp-term-b4kxob0n-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const tables = ['users', 'stores', 'products', 'delivery_windows', 'orders', 'order_items', 'checkouts', 'settings', 'order_events'];
  for (const t of tables) {
    const cols = await client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', [t]);
    console.log('=== ' + t + ' ===');
    console.log(cols.rows.map(c => c.column_name + ' (' + c.data_type + ')').join(', '));
  }
  await client.end();
}
main().catch(err => { console.error(err); process.exit(1); });
