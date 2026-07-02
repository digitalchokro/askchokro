import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroRoute } from '@digitalchokro/adapter-nextjs';
import { SQLiteAdapter } from '@digitalchokro/db-sqlite';

async function run() {
  console.log('Testing Next.js integration...');
  
  // Verify core instantiation
  const db = new SQLiteAdapter({ path: ':memory:' });
  const agent = new AskChokro({ db });
  
  if (!agent) {
    throw new Error('Failed to instantiate AskChokro agent');
  }

  // Verify adapter compilation and exports
  const route = createAskChokroRoute(agent);
  if (typeof route !== 'function') {
    throw new Error('Next.js route handler is not a function');
  }

  console.log('Next.js integration test passed.');
}

run().catch((err) => {
  console.error('Next.js test failed:', err);
  process.exit(1);
});
