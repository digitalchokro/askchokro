import express from 'express';
import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroMiddleware } from '@digitalchokro/adapter-express';
import { SQLiteAdapter } from '@digitalchokro/db-sqlite';

async function run() {
  console.log('Testing Express integration...');
  
  // Verify core instantiation
  const db = new SQLiteAdapter({ path: ':memory:' });
  const agent = new AskChokro({ db });
  
  if (!agent) {
    throw new Error('Failed to instantiate AskChokro agent');
  }

  // Verify adapter compilation and exports
  const middleware = createAskChokroMiddleware(agent);
  if (typeof middleware !== 'function') {
    throw new Error('Express middleware is not a function');
  }

  console.log('Express integration test passed.');
}

run().catch((err) => {
  console.error('Express test failed:', err);
  process.exit(1);
});
