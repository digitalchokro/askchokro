CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

-- Seed some test data
INSERT INTO businesses (id, name) VALUES (1, 'Acme Corp'), (2, 'Globex');
INSERT INTO users (id, business_id, name, email) VALUES (1, 1, 'Alice', 'alice@acme.com'), (2, 2, 'Bob', 'bob@globex.com');
INSERT INTO products (id, business_id, name, price, stock_quantity) VALUES (1, 1, 'Widget', 10.00, 100), (2, 2, 'Sprocket', 20.00, 50);
INSERT INTO orders (id, business_id, user_id, total_amount, status) VALUES (1, 1, 1, 10.00, 'completed'), (2, 2, 2, 40.00, 'pending');
INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES (1, 1, 1, 1, 10.00), (2, 2, 2, 2, 20.00);
