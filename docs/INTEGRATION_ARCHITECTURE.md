# AskChokro Integration Architecture

AskChokro is designed to be a **secure backend-only engine**. Because it requires direct access to your database and API keys, it cannot and should not run directly on a client device (like a mobile phone or a user's web browser). 

Here is the architectural breakdown of how to integrate AskChokro across different environments, from custom apps to CMS platforms.

---

## 1. Custom Apps (Web, Flutter, iOS/Android)

The architecture for custom apps is always a **Client-Server** model.

### The Backend (Node.js)
You must host AskChokro on a Node.js server (e.g., using Express, Fastify, or a Next.js route handler). This server sits between your database and your frontend.
1. It connects to your database (Postgres, SQLite, etc.).
2. It holds the AI API keys (OpenAI, Anthropic) or connects to a local AI.
3. It exposes a single, secure REST API endpoint, typically `POST /api/ask`.

### The Frontend (Flutter, React, Vue, Vanilla JS)
Your frontend application simply acts as a dumb UI. It renders a chat box, takes the user's typed question, and sends it to your backend.

**Example: Flutter Integration**
```dart
// Inside your Flutter App
Future<void> askQuestion(String question) async {
  final response = await http.post(
    Uri.parse('https://api.yourdomain.com/ask'),
    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_AUTH_TOKEN'},
    body: jsonEncode({'question': question}),
  );

  final data = jsonDecode(response.body);
  print(data['answer']); // "You have 5 orders."
  print(data['rows']);   // The raw JSON data to render in a Flutter DataTable or Chart.
}
```

**Example: Web App (React / Vanilla JS)**
```javascript
// Inside your React app or plain HTML website
const response = await fetch('https://api.yourdomain.com/ask', {
  method: 'POST',
  body: JSON.stringify({ question: 'Show me my top products' })
});
const { answer, rows } = await response.json();
```

---

## 2. Connecting Local Self-Hosted AI (e.g., Ollama)

If you want to use a local, self-hosted AI model (for complete data privacy or to avoid API costs), the connection happens entirely on your backend network.

**Architecture:**
1. **Ollama Server:** You run Ollama on a server you control (e.g., `http://10.0.0.5:11434`).
2. **Node.js Backend:** Your Node.js server running AskChokro points to the Ollama server.
   ```bash
   ASKCHOKRO_PROVIDER=ollama OLLAMA_BASE_URL=http://10.0.0.5:11434 node server.js
   ```
3. **Client Apps (Flutter / Web):** The Flutter app on the user's phone **never talks to Ollama directly**. It just talks to your Node.js `/api/ask` endpoint. The Node.js server handles the heavy lifting of talking to Ollama, getting the SQL, querying the database, and sending the final answer back to the phone.

---

## 3. Platform Integrations (Shopify, WordPress, Webflow)

To achieve a "drag-and-drop" experience for users on platforms like Shopify or WordPress, AskChokro needs to be packaged as a Platform App or Plugin. 

Because these platforms don't run Node.js natively, you have to bridge the gap.

### WordPress / WooCommerce
To make a drag-and-drop WordPress widget:
1. **The WP Plugin (PHP/React):** You build a WordPress plugin that provides a Gutenberg Block or Elementor Widget for the Chat UI.
2. **The Microservice (Node.js):** Since WP is PHP, you must host a small Node.js microservice running AskChokro alongside the WordPress installation.
3. **The Connection:** The WP plugin exposes a shortcode `[askchokro_chat]`. When a visitor types a question, the WP frontend sends it to the Node.js microservice, which connects directly to the WordPress MySQL database to answer questions about WooCommerce products or posts.

### Shopify
Shopify is a closed, hosted platform, so you cannot connect AskChokro directly to Shopify's internal database. 
To build a Shopify App with AskChokro:
1. **Data Syncing:** Your Node.js Shopify App must listen to Shopify Webhooks (e.g., `orders/create`, `products/update`) and sync the merchant's data into your own managed PostgreSQL database.
2. **AskChokro Engine:** You point AskChokro at your PostgreSQL replica.
3. **Theme App Extension (Drag & Drop):** You build a Shopify Theme App Extension. This provides a "Block" that the merchant can visually drag and drop anywhere on their storefront. When a customer uses the block, it pings your external Node.js server to get the answers.

> [!TIP]
> **Building a SaaS?** If you plan to offer AskChokro to Shopify or WordPress users, you are essentially building a B2B SaaS. You would host a multi-tenant Node.js + Postgres architecture, and use AskChokro's **Tenant Scope Rewriter** to ensure that when a Shopify merchant asks a question, AskChokro automatically scopes the SQL to `WHERE store_id = 'their_store'`.
