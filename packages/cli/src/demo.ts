import express from 'express';
import open from 'open';
import { AskChokro } from '@digitalchokro/askchokro';
import { SQLiteAdapter } from '@digitalchokro/db-sqlite';
import { createAskChokroMiddleware } from '@digitalchokro/adapter-express';

const HTML_UI = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AskChokro Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #000; color: #fff; margin: 0; padding: 2rem; display: flex; flex-direction: column; align-items: center; }
    main { width: 100%; max-width: 800px; display: flex; flex-direction: column; gap: 1rem; }
    h1 { margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
    h1 span { color: #888; font-size: 1rem; font-weight: normal; }
    form { display: flex; gap: 0.5rem; }
    input { flex: 1; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #333; background: #111; color: #fff; font-size: 1rem; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #666; }
    button { padding: 0.75rem 1.5rem; border-radius: 8px; border: none; background: #fff; color: #000; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    button:hover { opacity: 0.8; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #result { margin-top: 2rem; display: none; flex-direction: column; gap: 1rem; }
    .card { background: #111; border: 1px solid #333; border-radius: 12px; padding: 1.5rem; }
    .card h3 { margin: 0 0 1rem 0; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
    pre { margin: 0; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.875rem; color: #4ade80; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #333; }
    th { color: #888; font-weight: normal; }
    .error { color: #f87171; }
  </style>
</head>
<body>
  <main>
    <h1>AskChokro <span>Demo</span></h1>
    <p style="color:#888; margin-bottom: 2rem;">Connected to in-memory SQLite database. Auto-detecting Ollama/OpenAI.</p>
    
    <form id="askForm">
      <input type="text" id="question" placeholder="e.g. Which users signed up this month?" required autocomplete="off" />
      <button type="submit" id="submitBtn">Ask</button>
    </form>

    <div id="result">
      <div class="card">
        <h3>Generated SQL</h3>
        <pre id="sqlOut"></pre>
      </div>
      <div class="card">
        <h3>Results</h3>
        <div id="tableOut" style="overflow-x: auto;"></div>
      </div>
    </div>
  </main>

  <script>
    const form = document.getElementById('askForm');
    const input = document.getElementById('question');
    const btn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const sqlOut = document.getElementById('sqlOut');
    const tableOut = document.getElementById('tableOut');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = input.value.trim();
      if (!question) return;

      btn.disabled = true;
      btn.textContent = 'Thinking...';
      resultDiv.style.display = 'none';

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error?.message || 'Something went wrong');
        }

        sqlOut.className = '';
        sqlOut.textContent = data.sql;
        
        if (data.rows && data.rows.length > 0) {
          const keys = Object.keys(data.rows[0]);
          let html = '<table><thead><tr>';
          for (const k of keys) html += "<th>" + k + "</th>";
          html += '</tr></thead><tbody>';
          
          for (const row of data.rows) {
            html += '<tr>';
            for (const k of keys) html += "<td>" + row[k] + "</td>";
            html += '</tr>';
          }
          html += '</tbody></table>';
          tableOut.innerHTML = html;
        } else {
          tableOut.innerHTML = '<p style="color:#888; margin:0;">No rows returned.</p>';
        }

      } catch (err) {
        sqlOut.className = 'error';
        sqlOut.textContent = err.message;
        tableOut.innerHTML = '';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Ask';
        resultDiv.style.display = 'flex';
      }
    });
  </script>
</body>
</html>`;

export async function runDemo(): Promise<void> {
  console.log('\n🚀 Starting AskChokro Demo...');
  
  // 1. Setup in-memory DB and seed it
  const db = new SQLiteAdapter({ path: ':memory:' });
  await db.execute(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, country TEXT, created_at DATETIME);
    CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL, stock INTEGER);
    CREATE TABLE carts (id INTEGER PRIMARY KEY, user_id INTEGER, created_at DATETIME);
    CREATE TABLE cart_items (id INTEGER PRIMARY KEY, cart_id INTEGER, product_id INTEGER, quantity INTEGER);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, total_amount REAL, status TEXT, created_at DATETIME);
    CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, quantity INTEGER, price REAL);
    
    INSERT INTO users (name, email, country, created_at) VALUES 
      ('Alice', 'alice@example.com', 'US', '2024-01-01'), 
      ('Bob', 'bob@example.com', 'CA', '2024-01-15'),
      ('Charlie', 'charlie@example.com', 'UK', '2024-02-10'),
      ('Diana', 'diana@example.com', 'US', '2024-03-05');
    
    INSERT INTO products (name, category, price, stock) VALUES 
      ('MacBook Pro', 'Electronics', 1999.99, 50), 
      ('Logitech Mouse', 'Electronics', 49.99, 200),
      ('Mechanical Keyboard', 'Electronics', 149.99, 75),
      ('Coffee Mug', 'Home', 14.99, 500),
      ('Desk Chair', 'Furniture', 299.99, 30);
      
    INSERT INTO carts (user_id, created_at) VALUES 
      (3, '2024-07-01'),
      (4, '2024-07-02');
      
    INSERT INTO cart_items (cart_id, product_id, quantity) VALUES
      (1, 2, 1),
      (1, 4, 2),
      (2, 1, 1);
      
    INSERT INTO orders (user_id, total_amount, status, created_at) VALUES 
      (1, 2049.98, 'DELIVERED', '2024-02-01'),
      (2, 14.99, 'SHIPPED', '2024-02-05'),
      (1, 299.99, 'PENDING', '2024-03-10');
      
    INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
      (1, 1, 1, 1999.99),
      (1, 2, 1, 49.99),
      (2, 4, 1, 14.99),
      (3, 5, 1, 299.99);
  `);
  
  console.log('✅ Seeded in-memory SQLite database');

  // 2. Initialize Agent
  const agent = new AskChokro({ db });
  type InternalAgent = { config: { ai: { constructor: { name: string } } } };
  console.log(`✅ AskChokro Agent initialized (AI: ${(agent as unknown as InternalAgent).config.ai.constructor.name})`);

  // 3. Start Express server
  const app = express();
  app.use(express.json());
  
  app.get('/', (req, res) => {
    res.send(HTML_UI);
  });
  
  app.post('/api/ask', createAskChokroMiddleware(agent));

  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`\n🎉 Demo is live! Opening http://localhost:${String(PORT)} in your browser...\n`);
    open(`http://localhost:${String(PORT)}`).catch(() => {
      console.log(`Could not open browser automatically. Please visit http://localhost:${String(PORT)}`);
    });
  });
}
