<div align="center">
  <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="120" alt="AskChokro Logo" />
  <h1>AskChokro</h1>
  <p><strong>Node.js ডেভেলপারদের জন্য একটি শক্তিশালী AI Data Engine</strong></p>
  <p>আপনার যেকোনো SaaS অ্যাপে "Ask your data" ফিচার জুড়ে দিন মাত্র ১০ মিনিটে। এটা বানানোই হয়েছে অন্যান্য অ্যাপের ভেতর সহজে বসিয়ে দেওয়ার জন্য।</p>
  
  [![npm version](https://img.shields.io/npm/v/@digitalchokro/askchokro.svg?style=flat-square)](https://www.npmjs.com/package/@digitalchokro/askchokro)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
</div>

<div align="center">
  <em>(Looking for English? <a href="./README.md">Read in English</a>)</em>
</div>

<br/>
<p align="center">
  <picture>
    <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="800" height="2" style="background: linear-gradient(90deg, transparent, #8e9eab, #eef2f3, #8e9eab, transparent); border-radius: 5px;"/>
  </picture>
</p>
<br/>

## একবার চালিয়েই দেখুন না!

কোনো ঝামেলা নেই, অ্যাকাউন্ট খোলারও দরকার নেই, শুধু টার্মিনালে কমান্ডটি দিন:

```bash
npx @digitalchokro/cli demo
```
এই কমান্ডটা দিলেই লোকাল মেমোরিতে একটি SQLite ডেটাবেস চালু হয়ে যাবে (যেখানে আগে থেকেই কিছু ই-কমার্স ডেটা দেওয়া আছে)। এরপর এটি নিজে থেকেই আপনার পিসিতে থাকা **Ollama, OpenAI, বা Anthropic** ডিটেক্ট করে `localhost:3000` এ একটি সুন্দর চ্যাট ইউজার-ইন্টারফেস (Chat UI) ওপেন করে দেবে।

### ডেমো ডেটাবেস স্কিমা
এই ইন-মেমরি (in-memory) SQLite ডেটাবেসটি এমনভাবে সাজানো হয়েছে যেন আপনি চাইলেই বেশ কিছু জটিল কুয়েরি (Query) করে দেখতে পারেন:
- `users` (id, name, email, country, created_at)
- `products` (id, name, category, price, stock)
- `orders` (id, user_id, total_amount, status, created_at)
- `order_items` (id, order_id, product_id, quantity, price)
- `carts` (id, user_id, created_at)
- `cart_items` (id, cart_id, product_id, quantity)

*কিছু প্রশ্ন করে ট্রাই করতে পারেন, যেমন: "Who has items in their cart right now?", "Which category generates the most revenue?", "List all pending orders with amounts", অথবা "Show me products under $100".*

### ভুয়া ডেটা প্রতিরোধের ব্যবস্থা (Anti-Hallucination)
AskChokro-র ব্যাকএন্ডে আমরা বেশ কড়া সিস্টেম প্রম্পট ব্যবহার করেছি। ইউজার যদি এমন কোনো প্রশ্ন করে যার ডেটা আপনার স্কিমায় নেই, তখন মডেল নিজে থেকে ভুয়া টেবিল বা উল্টাপাল্টা SQL না বানিয়ে সোজা বলে দেবে `CANNOT_ANSWER`।

> **নোট:** AskChokro এখন একসাথে একাধিক আলাদা আলাদা প্রশ্নের উত্তর দিতে পারে। এটি ব্যাকএন্ডে নিজে থেকেই স্ক্যালার সাব-কুয়েরি (scalar subqueries) ব্যবহার করে আপনার সবগুলো প্রশ্নের উত্তর একটিমাত্র রেজাল্ট সেটে নিয়ে আসে, যাতে ডেটাবেস ড্রাইভার ক্র্যাশ না করে।

### লোকাল মডেল ব্যবহার (Ollama)
আপনি চাইলে কোনো নির্দিষ্ট প্রোভাইডার বা মডেল ব্যবহারের জন্য এনভায়রনমেন্ট ভেরিয়েবল (Environment variables) সেট করে দিতে পারেন:

```bash
# নির্দিষ্ট মডেল সহ Ollama ব্যবহার বাধ্য করা (আপনার এনভায়রনমেন্টের যেকোনো API কী উপেক্ষা করবে)
ASKCHOKRO_PROVIDER=ollama ASKCHOKRO_MODEL=qwen2.5-coder npx @digitalchokro/cli demo

# Anthropic ব্যবহার করতে চাইলে
ASKCHOKRO_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npx @digitalchokro/cli demo
```

---

## কেন AskChokro ব্যবহার করবেন?

আপনার SaaS অ্যাপে যদি "AI analytics" ফিচার ঢোকানোর কথা ভেবে থাকেন, তাহলে এই প্যারাগুলো আপনার খুব পরিচিত লাগবে:
- **Python wrappers:** শুধু LangChain বা LlamaIndex চালানোর জন্য আপনাকে আলাদা একটা পাইথন মাইক্রোসার্ভিস সার্ভারে তুলতে হয়।
- **ভারী BI টুলস:** WrenAI বা Superset এর মতো টুলগুলো দেখতে দারুণ, কিন্তু এগুলো আস্ত একটা প্ল্যাটফর্ম। আপনার হয়তো শুধু একটা সাধারণ API এন্ডপয়েন্ট দরকার, যেটা দিয়ে আপনি নিজের React অ্যাপে একটা চ্যাট বক্স বসাতে পারবেন।
- **নিরাপত্তার চিন্তা:** AI ভুল করে আপনার ডেটাবেসে `DROP TABLE` চালিয়ে দেবে না, বা 'Tenant A' এর গোপন ডেটা 'Tenant B' কে দেখিয়ে দেবে না- এটার গ্যারান্টি কে দেবে?

**ঠিক এই জায়গাগুলোতেই AskChokro আলাদা:**
১. **১০০% টাইপস্ক্রিপ্ট (TypeScript):** এটি সরাসরি আপনার Node.js ব্যাকএন্ডেই (Next.js, Express, Fastify) রান করবে। আলাদা কোনো সার্ভার বা ল্যাঙ্গুয়েজের দরকার নেই।
২. **জিরো-কনফিগ (Zero-Config):** AskChokro নিজে থেকেই আপনার `DATABASE_URL`, `OPENAI_API_KEY`, এবং `ANTHROPIC_API_KEY` বুঝে নেবে। আর যদি কোনো API-কী না পায়, তবে চুপচাপ লোকাল Ollama তে সুইচ করে যাবে।
৩. **AST-লেভেল সিকিউরিটি:** আমরা শুধু প্রম্পট ইঞ্জিনিয়ারিং করে বসে নেই। AI যে SQL টা জেনারেট করে, আমরা সেটাকে Abstract Syntax Tree (AST)-তে ভেঙে ফেলি। এরপর খুব কড়াকড়িভাবে চেক করি এটা শুধুই রিড-ওনলি `SELECT` কুয়েরি কি না। সবশেষে, এক ইউজারের ডেটা যেন অন্য ইউজার না দেখে, সেজন্য আমরা *কুয়েরিটা অটোমেটিক রিরাইট (rewrite)* করে ফেলি।

## কুইক স্টার্ট (Next.js App Router দিয়ে)

প্রথমে কোর ইঞ্জিন এবং Next.js অ্যাডাপ্টার ইন্সটল করে নিন:

```bash
npm install @digitalchokro/askchokro @digitalchokro/adapter-nextjs @digitalchokro/provider-openai @digitalchokro/db-postgres
```

এবার `app/api/ask/route.ts` ফোল্ডারে একটি রাউট হ্যান্ডলার তৈরি করুন:

```typescript
// app/api/ask/route.ts
import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroRoute } from '@digitalchokro/adapter-nextjs';

// এটি নিজে থেকেই process.env.DATABASE_URL এবং process.env.OPENAI_API_KEY নিয়ে নেবে
const agent = new AskChokro();

export const POST = createAskChokroRoute(agent);
```

আপনার ফ্রন্টএন্ডে बस এতটুকুই লিখতে হবে:

```javascript
const res = await fetch('/api/ask', {
  method: 'POST',
  body: JSON.stringify({ question: 'Who are my top 5 customers this month?' })
});

const { answer, sql, rows } = await res.json();
console.log(sql);  // "SELECT name, SUM(amount) FROM orders GROUP BY name ORDER BY SUM(amount) DESC LIMIT 5"
console.table(rows);
```

হয়ে গেলো! আপনার অ্যাপে এখন AI ডেটা অ্যানালিটিক্স কাজ করছে।

## মাল্টি-ট্যানান্ট সিকিউরিটি (AST রিরাইটিং)

B2B SaaS-এ AI এম্বেড করার সময় সবথেকে বড় প্যারা হলো ট্যানান্ট আইসোলেশন (অর্থাৎ এক ইউজারের ডেটা থেকে আরেক ইউজারকে আলাদা রাখা)। সাধারণ স্ট্রিং-অ্যাপেন্ডিং (`WHERE tenant_id = X`) তখনই ফেল মারে যখন AI কোনো সাব-কুয়েরি বা জটিল `JOIN` লিখে ফেলে, যা আপনার ফিল্টারকে সহজেই বাইপাস করে যায়।

এই সমস্যা সমাধানে AskChokro একটি অত্যন্ত অ্যাডভান্সড **AST Scope Rewriter** ব্যবহার করে।

```typescript
import { DatabaseAgent } from '@digitalchokro/core';
import { PostgresAdapter } from '@digitalchokro/db-postgres';
import { OpenAIProvider } from '@digitalchokro/provider-openai';

const agent = new DatabaseAgent({
  db: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  ai: new OpenAIProvider({ model: 'gpt-4o' }),
  options: {
    tenantScoping: {
      enabled: true,
      column: 'organization_id',
      // আপনার রিকোয়েস্ট কনটেক্সট থেকে বর্তমান ইউজারের অর্গ আইডি (org ID) নিয়ে নিচ্ছে
      getValue: (ctx) => ctx.orgId, 
    }
  }
});
```

যদি আপনি `tenantScoping` এনাবল করে রাখেন, আর AI নিচের এই কুয়েরি জেনারেট করে:
```sql
SELECT o.id, u.email FROM orders o JOIN users u ON o.user_id = u.id
```

তখন AskChokro-র AST রিরাইটার মাঝপথেই কুয়েরিটা ধরে ফেলবে, এর সিনট্যাক্স ট্রি পার্স করবে, এবং ডেটাবেসে হিট করার ঠিক আগ মুহূর্তে *প্রতিটি* টেবিল রেফারেন্সের ভেতর আপনার ট্যানান্ট লজিক ঢুকিয়ে দেবে:
```sql
SELECT o.id, u.email 
FROM orders o 
JOIN users u ON o.user_id = u.id AND u.organization_id = 'org_123'
WHERE o.organization_id = 'org_123'
```

*আমাদের ফেইল-ক্লোজড (fail-closed) ডিজাইন আপনার ডেটাবেসের রিস্ক জিরোতে নামিয়ে আনে। এই ৯-স্তরের সিকিউরিটি সিস্টেম নিয়ে আরও জানতে আমাদের [সিকিউরিটি গাইড (Security Guide)](./docs/SECURITY.md) পড়ে দেখতে পারেন।*

## অ্যাকুরেসি বেঞ্চমার্ক (নির্ভুলতা)

১৯৮টি জটিল SQL সিনারিওর একটি কড়া ওপেন-সোর্স ডেটাসেট দিয়ে আমরা AskChokro-কে প্রতিনিয়ত টেস্ট করি।

| মডেল | ওভারঅল | অ্যাগ্রিগেশনস | মাল্টি-টেবিল JOINs | ট্যানান্ট স্কোপিং |
|---|---|---|---|---|
| **GPT-4o** | **৯৫.৯%** | ৯৮% | ৯৫% | ১০০% |
| **Claude 3.5 Sonnet** | **৯৬.৫%** | ৯৯% | ৯৬% | ১০০% |
| **Qwen 2.5 Coder (লোকাল)** | **৮৭.৮%** | ৮৮% | ৮৫% | ১০০% |

*(ফুল মেথডলজি জানতে আমাদের CI eval harness দেখুন).*

## বর্তমান সীমাবদ্ধতাগুলো

AskChokro-কে বানানোই হয়েছে সিম্পল এবং সিকিউর রাখার উদ্দেশ্যে। আর এজন্যই ইচ্ছাকৃতভাবে কিছু জায়গায় আমাদের ছাড় দিতে হয়েছে:
- **মাল্টি-পার্ট প্রশ্ন (Multi-Part Questions):** ইঞ্জিন এখন একসাথে একাধিক প্রশ্নের উত্তর দিতে পারে স্ক্যালার সাব-কুয়েরির (scalar subqueries) মাধ্যমে। তবে সব ডেটাবেস ড্রাইভারের সাথে কাজ করার জন্য দিনশেষে এটিকে একটিমাত্র রেজাল্ট সেটে (tabular structure) রূপান্তর হতে হয়।
- **কোনো মিউটেশন নেই (DML):** এটি ১০০ ভাগ রিড-ওনলি। `INSERT`, `UPDATE`, `DELETE`, এবং `DROP` স্টেটমেন্টগুলোকে আমরা AST লেভেলেই পুরোপুরি ব্লক করে দিয়েছি।
- **খুব জটিল অ্যাগ্রিগেশন:** সাধারণ জয়েন বা অ্যাগ্রিগেশনে কোনো সমস্যা না হলেও, মারাত্মক জটিল উইন্ডো ফাংশন (window functions) বা রিকার্সিভ CTE-এর ক্ষেত্রে ছোট লোকাল মডেলগুলো মাঝে মাঝে খেই হারিয়ে ফেলতে পারে।

## খুব শীঘ্রই আসছে: ওয়ার্ডপ্রেস প্লাগিন (WordPress Plugin)

আপনাদের জন্য আমরা অফিসিয়াল **AskChokro WordPress Plugin** এর কাজ শুরু করে দিয়েছি।
এর মাধ্যমে আপনি কোনো কোড ছাড়াই আপনার WooCommerce ড্যাশবোর্ডে সরাসরি একটি AI ডেটা অ্যাসিস্ট্যান্ট বসিয়ে দিতে পারবেন।

**আমাদের ওয়ার্ডপ্রেস রোডম্যাপ:**
- **ফেজ ১:** AskChokro Node.js মাইক্রোসার্ভিস (আগে থেকে কনফিগার করা Docker কন্টেইনার)
- **ফেজ ২:** WordPress PHP Plugin (Settings UI ও Gutenberg Blocks)
- **ফেজ ৩:** মাল্টি-ভেন্ডর প্ল্যাটফর্মের জন্য অটোমেটিক ট্যানান্ট আইসোলেশন

পর্দার আড়ালে সিস্টেমটা কীভাবে কাজ করবে তা জানতে চাইলে আমাদের [ইন্টিগ্রেশন আর্কিটেকচার (Integration Architecture)](/docs/INTEGRATION_ARCHITECTURE.md) গাইডটি পড়ে দেখতে পারেন।

## সচরাচর জিজ্ঞাসিত প্রশ্ন (FAQ)

**AskChokro আসলে কি?**  
AskChokro হলো Node.js ডেভেলপারদের জন্য বানানো একটি ওপেন-সোর্স AI ডেটা ইঞ্জিন। এটি আপনাকে খুব সহজেই যেকোনো অ্যাপে ন্যাচারাল ল্যাঙ্গুয়েজ থেকে SQL (Text-to-SQL) ফিচার যুক্ত করার সুবিধা দেয়। সাধারণ মানুষের ভাষায় প্রশ্ন করেই ডেটাবেস থেকে সঠিক তথ্য বের করা এখন ডালভাত!

**AskChokro কি মাল্টি-ট্যানান্ট (Multi-tenant) SaaS-এর জন্য আসলেই নিরাপদ?**  
জ্বি, ১০০ ভাগ নিরাপদ। AskChokro সরাসরি AST (Abstract Syntax Tree) লেভেলে কুয়েরি রিরাইট করে ডেটাবেসের সর্বোচ্চ সিকিউরিটি নিশ্চিত করে। ফলে AI কোনোভাবেই এক ইউজারের ডেটা আরেক ইউজারকে দেখাতে পারবে না।

**লোকাল এআই (Local LLM) সাপোর্ট করে কি?**  
অবশ্যই। আপনি Ollama ব্যবহার করে সম্পূর্ণ অফলাইনে লোকাল এআই মডেল (যেমন: Qwen, Llama 3) দিয়ে AskChokro চালাতে পারবেন। এতে আপনার ডেটাবেস স্কিমা ও ভেতরের ডেটা থার্ড-পার্টি কোনো সার্ভারে যাওয়ার কোনো সম্ভাবনাই থাকে না। এছাড়া এটি OpenAI, Anthropic এবং Gemini-ও সাপোর্ট করে।

**AskChokro কি বানিয়ে বানিয়ে ভুল তথ্য বা ভুয়া ডেটাবেস টেবিল বানাতে পারে?**  
না। AskChokro খুব কড়া RAG (Retrieval-Augmented Generation) মেকানিজম ব্যবহার করে। ইউজার ডেটাবেসের বাইরের কোনো উল্টাপাল্টা প্রশ্ন করলে এটি ভুল উত্তর বা ভুয়া SQL না বানিয়ে সরাসরি `CANNOT_ANSWER` রিটার্ন করবে।

**কোন কোন ডেটাবেস সাপোর্ট করে?**  
AskChokro অফিসিয়ালি PostgreSQL, MySQL এবং SQLite সাপোর্ট করে।

## ডকুমেন্টেশন

- [Quick Start](./docs/QUICK_START.md) - মাত্র ৫-মিনিটের সম্পূর্ণ ইন্টিগ্রেশন গাইড।
- [Security Model](./docs/SECURITY.md) - AST ভ্যালিডেশন, কলাম মাস্কিং এবং রিড-ওনলি স্যান্ডবক্সিং নিয়ে একদম ডিপ ডাইভ।
- [Plugin Development](./docs/PLUGINS.md) - কীভাবে আপনার নিজের `AIProvider` বা `DatabaseAdapter` বানাবেন তা শিখে নিন।
- [Integration Architecture](/docs/INTEGRATION_ARCHITECTURE.md) - বিভিন্ন প্ল্যাটফর্মে AskChokro কীভাবে এম্বেড করবেন তার বিস্তারিত।

## আমাদের সাথে কাজ করতে চাইলে (Contributing)

আমরা অ্যাকটিভলি নতুন কন্ট্রিবিউটর খুঁজছি! আমাদের [Contributing Guide](CONTRIBUTING.md) দেখুন এবং `good first issue` ট্যাগ দেওয়া ইস্যুগুলো খুঁজে বের করে কাজ শুরু করে দিন।

আপনি যদি MySQL, Gemini, Google Vertex বা Fastify এর জন্য সাপোর্ট যোগ করতে চান, তবে আমাদের কাছে আপনার জন্য আগে থেকেই অটোমেটেড টেমপ্লেট রেডি করা আছে।

## লাইসেন্স

MIT © Digital Chokro
