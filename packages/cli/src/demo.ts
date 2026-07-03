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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Fira+Code:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #09090b;
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.1);
      --primary: #8b5cf6;
      --primary-hover: #7c3aed;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --error-bg: rgba(239, 68, 68, 0.1);
      --error-border: rgba(239, 68, 68, 0.3);
      --error-text: #fca5a5;
    }
    body { 
      font-family: 'Outfit', sans-serif; 
      background: var(--bg); 
      color: var(--text); 
      margin: 0; 
      padding: 2rem; 
      display: flex; 
      flex-direction: column; 
      align-items: center;
      min-height: 100vh;
      background-image: radial-gradient(circle at 50% -20%, rgba(139, 92, 246, 0.15), transparent 60%);
    }
    main { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 1.5rem; }
    h1 { margin: 0; font-size: 2.5rem; font-weight: 600; text-align: center; background: linear-gradient(to right, #c4b5fd, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p.subtitle { text-align: center; color: var(--text-muted); font-size: 1.1rem; margin-top: -1rem; margin-bottom: 2rem; }
    
    .glass-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    }

    /* Schema Collapsible */
    details { margin-bottom: 1rem; }
    summary {
      cursor: pointer;
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      user-select: none;
      padding: 0.5rem 0;
    }
    summary::-webkit-details-marker { display: none; }
    summary::before {
      content: '▶';
      font-size: 0.8rem;
      transition: transform 0.2s;
    }
    details[open] summary::before { transform: rotate(90deg); }
    
    .schema-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .schema-table {
      background: rgba(0,0,0,0.2);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
    }
    .schema-table h4 { margin: 0 0 0.5rem 0; color: #c4b5fd; font-family: 'Fira Code', monospace; }
    .schema-table ul { list-style: none; padding: 0; margin: 0; font-family: 'Fira Code', monospace; font-size: 0.85rem; }
    .schema-table li { display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .schema-table li:last-child { border-bottom: none; }
    .col-type { color: #5eead4; }
    .pk { color: #fcd34d; font-size: 0.75rem; margin-left: 0.25rem; }

    /* Input */
    form { display: flex; gap: 0.75rem; margin-top: 1rem; }
    input { 
      flex: 1; 
      padding: 1rem 1.5rem; 
      border-radius: 12px; 
      border: 1px solid var(--card-border); 
      background: rgba(0,0,0,0.3); 
      color: #fff; 
      font-family: inherit;
      font-size: 1.1rem; 
      outline: none; 
      transition: all 0.2s; 
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
    }
    input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
    button { 
      padding: 1rem 2rem; 
      border-radius: 12px; 
      border: none; 
      background: var(--primary); 
      color: #fff; 
      font-family: inherit;
      font-size: 1.1rem; 
      font-weight: 600; 
      cursor: pointer; 
      transition: all 0.2s; 
    }
    button:hover { background: var(--primary-hover); transform: translateY(-1px); }
    button:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
    
    /* Results */
    #result { margin-top: 1.5rem; display: none; flex-direction: column; gap: 1.5rem; }
    .card-title { margin: 0 0 1rem 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }
    pre { margin: 0; white-space: pre-wrap; font-family: 'Fira Code', monospace; font-size: 0.95rem; color: #a78bfa; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
    
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.95rem; }
    th, td { text-align: left; padding: 1rem; border-bottom: 1px solid var(--card-border); }
    th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }

    /* Error State */
    .error-card {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }
    .error-card svg { flex-shrink: 0; width: 24px; height: 24px; color: #ef4444; }
    .error-card .err-msg { color: var(--error-text); font-size: 1rem; margin: 0; line-height: 1.5; }

  </style>
</head>
<body>
  <main>
    <h1>AskChokro</h1>
    <p class="subtitle">Natural language to SQL agent</p>
    
    <details class="glass-card" id="schemaDetails">
      <summary>Database Schema Explorer</summary>
      <div class="schema-grid" id="schemaGrid">
        <p style="color: var(--text-muted); font-size: 0.9rem;">Loading schema...</p>
      </div>
    </details>

    <form id="askForm">
      <input type="text" id="question" placeholder="e.g. Which category generates the most revenue?" required autocomplete="off" />
      <button type="submit" id="submitBtn">Ask</button>
    </form>

    <div id="result">
      <div id="errorContainer" style="display: none;"></div>
      
      <div id="successContainer" style="display: none; flex-direction: column; gap: 1.5rem;">
        <div class="glass-card">
          <h3 class="card-title">Generated SQL</h3>
          <pre id="sqlOut"></pre>
        </div>
        <div class="glass-card" id="tableCard">
          <h3 class="card-title">Results</h3>
          <div id="tableOut" style="overflow-x: auto;"></div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const form = document.getElementById('askForm');
    const input = document.getElementById('question');
    const btn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const successContainer = document.getElementById('successContainer');
    const errorContainer = document.getElementById('errorContainer');
    const sqlOut = document.getElementById('sqlOut');
    const tableOut = document.getElementById('tableOut');
    const tableCard = document.getElementById('tableCard');
    const schemaGrid = document.getElementById('schemaGrid');

    // Load Schema
    async function loadSchema() {
      try {
        const res = await fetch('/api/schema');
        const data = await res.json();
        
        let html = '';
        for (const table of data.tables) {
          html += \`<div class="schema-table">
            <h4>\${table.tableName}</h4>
            <ul>\`;
          for (const col of table.columns) {
            const pkTag = col.isPrimaryKey ? '<span class="pk" title="Primary Key">🔑</span>' : '';
            html += \`<li><span>\${col.columnName}\${pkTag}</span> <span class="col-type">\${col.dataType}</span></li>\`;
          }
          html += \`</ul></div>\`;
        }
        schemaGrid.innerHTML = html;
      } catch (err) {
        schemaGrid.innerHTML = '<p style="color:#ef4444;">Failed to load schema.</p>';
      }
    }
    loadSchema();

    // Handle Query
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = input.value.trim();
      if (!question) return;

      btn.disabled = true;
      btn.textContent = 'Thinking...';
      resultDiv.style.display = 'flex';
      successContainer.style.display = 'none';
      errorContainer.style.display = 'none';

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error?.message || data.error || 'Something went wrong processing your request.');
        }

        successContainer.style.display = 'flex';
        sqlOut.textContent = data.sql;
        
        if (data.rows && data.rows.length > 0) {
          tableCard.style.display = 'block';
          const keys = Object.keys(data.rows[0]);
          let html = '<table><thead><tr>';
          for (const k of keys) html += "<th>" + k + "</th>";
          html += '</tr></thead><tbody>';
          
          for (const row of data.rows) {
            html += '<tr>';
            for (const k of keys) html += "<td>" + (row[k] === null ? '<em>null</em>' : row[k]) + "</td>";
            html += '</tr>';
          }
          html += '</tbody></table>';
          tableOut.innerHTML = html;
        } else {
          tableCard.style.display = 'block';
          tableOut.innerHTML = '<p style="color:var(--text-muted); margin:0; padding: 1rem 0;">No rows returned.</p>';
        }

      } catch (err) {
        errorContainer.style.display = 'block';
        errorContainer.innerHTML = \`
          <div class="error-card">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p class="err-msg">\${err.message}</p>
          </div>
        \`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Ask';
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
      ('Diana', 'diana@example.com', 'US', '2024-03-05'),
      ('Eve', 'eve@example.com', 'AU', '2024-04-20');
    
    INSERT INTO products (name, category, price, stock) VALUES 
      ('MacBook Pro', 'Electronics', 1999.99, 50), 
      ('Logitech Mouse', 'Electronics', 49.99, 200),
      ('Razer Gaming Mouse', 'Electronics', 129.99, 150),
      ('Apple Magic Mouse', 'Electronics', 79.00, 300),
      ('Mechanical Keyboard', 'Electronics', 149.99, 75),
      ('Coffee Mug', 'Home', 14.99, 500),
      ('Desk Chair', 'Furniture', 299.99, 30);
      
    INSERT INTO carts (user_id, created_at) VALUES 
      (3, '2024-07-01'),
      (4, '2024-07-02'),
      (5, '2024-07-03');
      
    INSERT INTO cart_items (cart_id, product_id, quantity) VALUES
      (1, 2, 1),
      (1, 4, 2),
      (2, 1, 1),
      (3, 3, 1);
    INSERT INTO orders (user_id, total_amount, status, created_at) VALUES 
      (1, 2049.98, 'delivered', '2024-02-01'),
      (2, 14.99,   'shipped',   '2024-02-05'),
      (1, 149.99,  'pending',   '2024-03-10'),
      (3, 129.99,  'pending',   '2024-03-11'),
      (4, 2129.98, 'pending',   '2024-04-15'),
      (5, 79.00,   'pending',   '2024-04-21'),
      (2, 299.99,  'delivered', '2024-05-01'),
      (4, 49.99,   'shipped',   '2024-05-10');
      
    INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
      (1, 1, 1, 1999.99),
      (1, 2, 1, 49.99),
      (2, 6, 1, 14.99),
      (3, 5, 1, 149.99),
      (4, 3, 1, 129.99),
      (5, 4, 1, 79.00),
      (6, 1, 1, 1999.99),
      (6, 3, 1, 129.99);
  `);
  
  console.log('✅ Seeded in-memory SQLite database');

  // 2. Initialize Agent
  const agent = new AskChokro({ db });
  console.log('✅ AskChokro Agent initialized');

  // 3. Start Express server
  const app = express();
  app.use(express.json());
  
  app.get('/', (req, res) => {
    res.send(HTML_UI);
  });
  
  app.get('/api/schema', async (req, res) => {
    try {
      const schema = await db.introspectSchema();
      res.json(schema);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error });
    }
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
