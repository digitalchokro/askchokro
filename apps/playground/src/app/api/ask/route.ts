import { NextRequest, NextResponse } from 'next/server';
import { AskChokro } from 'askchokro';
import { SQLiteAdapter } from '@askchokro/db-sqlite';

// Default demo DB
const defaultDb = new SQLiteAdapter({ path: ':memory:' });
const agentWithDefaultDb = new AskChokro({ db: defaultDb });

// Pre-seed the default DB
defaultDb.execute(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, created_at DATETIME);
  CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER);
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER, total_amount INTEGER, created_at DATETIME);
  CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, quantity INTEGER);
  
  INSERT OR IGNORE INTO users (id, name, email, created_at) VALUES 
    (1, 'Alice', 'alice@example.com', '2024-01-01'), 
    (2, 'Bob', 'bob@example.com', '2024-01-15');
    
  INSERT OR IGNORE INTO products (id, name, price) VALUES 
    (1, 'Laptop', 1200), 
    (2, 'Mouse', 25);
    
  INSERT OR IGNORE INTO orders (id, user_id, total_amount, created_at) VALUES 
    (1, 1, 1200, '2024-02-01'),
    (2, 2, 25, '2024-02-05');

  INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity) VALUES 
    (1, 1, 1, 1),
    (2, 2, 2, 1);
`).catch(console.error);


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = body.question;
    
    if (!question || typeof question !== 'string') {
      return NextResponse.json({
        error: { code: 'BAD_REQUEST', message: 'A "question" string field is required.' }
      }, { status: 400 });
    }

    const customDbUrl = req.headers.get('x-database-url');
    let agent = agentWithDefaultDb;
    
    if (customDbUrl) {
      agent = new AskChokro({ db: customDbUrl });
    }

    const result = await agent.ask(question);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string; suggestion?: string };
    const status = error.code === 'VALIDATION_ERROR' ? 400 : 500;
    return NextResponse.json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred.',
        suggestion: error.suggestion
      }
    }, { status });
  }
}
