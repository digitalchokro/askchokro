-- ============================================================
-- AskChokro Eval Dataset Schema + Seed Data
-- ============================================================
-- SQLite-compatible (uses INTEGER PRIMARY KEY instead of SERIAL)

CREATE TABLE businesses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  stock_quantity INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  total_amount REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price REAL NOT NULL
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---- Seed Data ----

INSERT INTO businesses (id, name) VALUES
  (1, 'Acme Corp'),
  (2, 'Globex');

INSERT INTO users (id, business_id, name, email, created_at) VALUES
  (1, 1, 'Alice',   'alice@acme.com',   datetime('now', '-60 days')),
  (2, 1, 'Charlie', 'charlie@acme.com', datetime('now', '-30 days')),
  (3, 1, 'Diana',   'diana@acme.com',   datetime('now', '-5 days')),
  (4, 2, 'Bob',     'bob@globex.com',   datetime('now', '-90 days')),
  (5, 2, 'Eve',     'eve@globex.com',   datetime('now', '-10 days'));

INSERT INTO products (id, business_id, name, price, stock_quantity, category) VALUES
  (1, 1, 'Widget',        10.00, 100, 'hardware'),
  (2, 1, 'Gadget',        25.00,  40, 'electronics'),
  (3, 1, 'Doohickey',      5.00, 200, 'hardware'),
  (4, 1, 'Thingamajig',   50.00,  10, 'electronics'),
  (5, 2, 'Sprocket',      20.00,  50, 'hardware'),
  (6, 2, 'Cog',            8.00, 150, 'hardware');

INSERT INTO orders (id, business_id, user_id, total_amount, status, created_at) VALUES
  (1,  1, 1,  10.00, 'completed', datetime('now', '-50 days')),
  (2,  1, 1,  75.00, 'completed', datetime('now', '-20 days')),
  (3,  1, 2,  50.00, 'completed', datetime('now', '-15 days')),
  (4,  1, 2,  25.00, 'pending',   datetime('now', '-2 days')),
  (5,  1, 3,   5.00, 'pending',   datetime('now', '-1 days')),
  (6,  2, 4,  40.00, 'completed', datetime('now', '-45 days')),
  (7,  2, 4,  16.00, 'refunded',  datetime('now', '-10 days')),
  (8,  2, 5,  20.00, 'completed', datetime('now', '-3 days'));

INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES
  (1, 1, 1, 1,  10.00),
  (2, 2, 2, 2,  25.00),
  (3, 2, 4, 1,  25.00),
  (4, 3, 4, 1,  50.00),
  (5, 4, 2, 1,  25.00),
  (6, 5, 3, 1,   5.00),
  (7, 6, 5, 2,  20.00),
  (8, 7, 6, 2,   8.00),
  (9, 8, 5, 1,  20.00);

INSERT INTO reviews (id, business_id, product_id, user_id, rating, comment) VALUES
  (1, 1, 1, 1, 5, 'Great widget!'),
  (2, 1, 2, 1, 4, 'Good gadget'),
  (3, 1, 2, 2, 3, 'Average'),
  (4, 2, 5, 4, 5, 'Excellent sprocket'),
  (5, 2, 6, 5, 2, 'Disappointing cog');
