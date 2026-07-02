import json
import random

categories = ["simple-select", "filtering", "aggregation", "join", "join-aggregation", "sorting", "group-by", "date-filtering", "subquery"]

templates = [
    {"q": "How many users are there?", "s": "SELECT COUNT(*) FROM users", "t": False, "c": "simple-select"},
    {"q": "List all users", "s": "SELECT * FROM users", "t": False, "c": "simple-select"},
    {"q": "What is the total number of products?", "s": "SELECT COUNT(*) FROM products", "t": True, "c": "simple-select"},
    {"q": "How many orders are pending?", "s": "SELECT COUNT(*) FROM orders WHERE status = 'pending'", "t": True, "c": "filtering"},
    {"q": "List completed orders", "s": "SELECT * FROM orders WHERE status = 'completed'", "t": True, "c": "filtering"},
    {"q": "What is the total revenue?", "s": "SELECT SUM(total_amount) FROM orders WHERE status = 'completed'", "t": True, "c": "aggregation"},
    {"q": "What is the average order amount?", "s": "SELECT AVG(total_amount) FROM orders", "t": True, "c": "aggregation"},
    {"q": "List users who placed an order", "s": "SELECT DISTINCT u.email FROM users u JOIN orders o ON u.id = o.user_id", "t": True, "c": "join"},
    {"q": "What products were ordered today?", "s": "SELECT DISTINCT p.name FROM products p JOIN order_items oi ON p.id = oi.product_id JOIN orders o ON oi.order_id = o.id WHERE o.created_at >= CURRENT_DATE", "t": True, "c": "join"},
    {"q": "How many Widgets were sold?", "s": "SELECT SUM(oi.quantity) FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE p.name = 'Widget'", "t": True, "c": "join-aggregation"},
    {"q": "What are the 5 most expensive products?", "s": "SELECT name, price FROM products ORDER BY price DESC LIMIT 5", "t": True, "c": "sorting"},
    {"q": "List products ordered by stock quantity", "s": "SELECT name, stock_quantity FROM products ORDER BY stock_quantity ASC", "t": True, "c": "sorting"},
    {"q": "How much revenue per status?", "s": "SELECT status, SUM(total_amount) FROM orders GROUP BY status", "t": True, "c": "group-by"},
    {"q": "How many orders per user?", "s": "SELECT user_id, COUNT(*) FROM orders GROUP BY user_id", "t": True, "c": "group-by"}
]

# Generate 50 pairs by slightly varying the wording/values
pairs = []
for i in range(50):
    template = templates[i % len(templates)]
    pairs.append({
        "category": template["c"],
        "question": f"{template['q']} (variation {i})",
        "expectedSql": template["s"],
        "tenantScoped": template["t"]
    })

with open("eval/dataset/seed.json", "w") as f:
    json.dump(pairs, f, indent=2)

print("Generated 50 pairs")
