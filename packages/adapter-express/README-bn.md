<div align="center">
  <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="120" alt="AskChokro Logo" />
  <h1>AskChokro</h1>
  <p><strong>Node.js-এর জন্য এআই (AI) ডেটা ইঞ্জিন</strong></p>
  <p>মাত্র ১০ মিনিটে আপনার যেকোনো SaaS অ্যাপে "Ask your data" ফিচার যুক্ত করুন। এম্বেড করার জন্য তৈরি, সহজ ও নিখুঁত।</p>
  
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

## তাৎক্ষণিকভাবে এটি কাজ করতে দেখুন

কোনো সেটআপ নেই, কোনো অ্যাকাউন্ট খোলার দরকার নেই, শুধু একটি টার্মিনালই যথেষ্ট।

```bash
npx @digitalchokro/cli demo
```
এটি স্যাম্পল ই-কমার্স ডেটা সহ একটি লোকাল SQLite ডেটাবেস চালু করবে, স্বয়ংক্রিয়ভাবে **Ollama, OpenAI, বা Anthropic** ডিটেক্ট করবে এবং `localhost:3000` এ একটি চমৎকার চ্যাট ইউআই (Chat UI) ওপেন করবে।

### ডেমো ডেটাবেস স্কিমা
ইন-মেমরি (in-memory) SQLite ডেটাবেসটি একটি পূর্ণাঙ্গ ই-কমার্স স্কিমা দিয়ে সাজানো হয়েছে, যাতে আপনি জটিল সব কুয়েরি পরীক্ষা করে দেখতে পারেন:
- `users` (id, name, email, country, created_at)
- `products` (id, name, category, price, stock)
- `orders` (id, user_id, total_amount, status, created_at)
- `order_items` (id, order_id, product_id, quantity, price)
- `carts` (id, user_id, created_at)
- `cart_items` (id, cart_id, product_id, quantity)

*এই ধরনের প্রশ্ন করে দেখতে পারেন: "Who has items in their cart right now?", "Which category generates the most revenue?", "List all pending orders with amounts", অথবা "Show me products under $100".*

### অ্যান্টি-হ্যালুসিনেশন ফলব্যাক (ভুল তথ্য রোধ)
AskChokro ইঞ্জিন একটি অত্যন্ত কঠোর সিস্টেম প্রম্পট ব্যবহার করে। আপনি যদি ডেটাবেস স্কিমায় নেই এমন কোনো ডেটা সম্পর্কে প্রশ্ন করেন, তবে মডেলটি নিরাপদে প্রম্পটটি বাতিল করে দেবে এবং ভুয়া টেবিল বা SQL জেনারেট করার বদলে সরাসরি `CANNOT_ANSWER` রিটার্ন করবে।

> **নোট:** AskChokro শুধুমাত্র সিঙ্গেল-স্টেটমেন্ট SQL অনুমোদন করে - এআই (AI) কে নির্দেশ দেওয়া হয়েছে যেন এটি প্রতিবার ঠিক একটি `SELECT` স্টেটমেন্ট তৈরি করে। একাধিক অংশের প্রশ্নের জন্য প্রতিটি অংশ আলাদাভাবে জিজ্ঞাসা করুন।

### লোকাল মডেল ব্যবহার (Ollama)
আপনি চাইলে কোনো নির্দিষ্ট প্রোভাইডার বা মডেল ব্যবহারের জন্য এনভায়রনমেন্ট ভেরিয়েবল (environment variables) ব্যবহার করতে পারেন:

```bash
# নির্দিষ্ট মডেল সহ Ollama ব্যবহার বাধ্য করা (আপনার এনভায়রনমেন্টের যেকোনো API কী উপেক্ষা করবে)
ASKCHOKRO_PROVIDER=ollama ASKCHOKRO_MODEL=qwen2.5-coder npx @digitalchokro/cli demo

# Anthropic ব্যবহার বাধ্য করা
ASKCHOKRO_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npx @digitalchokro/cli demo
```

---

## কেন AskChokro ব্যবহার করবেন?

আপনি যদি আপনার SaaS-এ "এআই অ্যানালিটিক্স (AI analytics)" ফিচার যুক্ত করার চেষ্টা করে থাকেন, তবে আপনি এই সমস্যাগুলোর সাথে পরিচিত:
- **পাইথন র‍্যাপারস (Python wrappers):** শুধুমাত্র LangChain বা LlamaIndex চালানোর জন্য আপনাকে একটি আলাদা পাইথন মাইক্রোসার্ভিস ডিপ্লয় করতে হয়।
- **ভারী BI টুলস:** WrenAI বা Superset এর মতো টুলগুলো মূলত সম্পূর্ণ আলাদা প্ল্যাটফর্ম। কিন্তু আপনি হয়তো চান শুধুমাত্র একটি সাধারণ API এন্ডপয়েন্ট, যা আপনার নিজস্ব React অ্যাপের চ্যাট বক্সে কাজ করবে।
- **নিরাপত্তার ঝুঁকি:** এআই (AI) যাতে ভুল করে `DROP TABLE` না করে বসে বা "Tenant A" এর ডেটা "Tenant B" কে না দেখিয়ে দেয়, তা আপনি কীভাবে নিশ্চিত করবেন?

**AskChokro পুরোপুরি আলাদা:**
১. **১০০% টাইপস্ক্রিপ্ট (TypeScript)।** এটি সরাসরি আপনার Node.js ব্যাকএন্ডেই (Next.js, Express, Fastify) রান করে।
২. **জিরো-কনফিগ (Zero-Config)।** `AskChokro` র‍্যাপার স্বয়ংক্রিয়ভাবে `DATABASE_URL`, `OPENAI_API_KEY`, এবং `ANTHROPIC_API_KEY` ডিটেক্ট করে - এবং কোনো কী (keys) না পেলে নিজে থেকেই লোকাল Ollama-তে সুইচ করে।
৩. **AST-লেভেল সিকিউরিটি।** আমরা শুধু প্রম্পট ইঞ্জিনিয়ারিংয়ের ওপর নির্ভর করি না। আমরা LLM-এর জেনারেট করা SQL-কে একটি Abstract Syntax Tree (AST)-তে পার্স করি, এটি যে শুধুই রিড-ওনলি `SELECT` কুয়েরি তা কড়াকড়িভাবে ভ্যালিডেট করি, এবং এক্সিকিউট করার আগেই ট্যানান্ট স্কোপিং নিশ্চিত করতে *স্বয়ংক্রিয়ভাবে AST রিরাইট (rewrite)* করি।

## কুইক স্টার্ট (কিভাবে শুরু করবেন - Next.js App Router)

কোর ইঞ্জিন এবং Next.js অ্যাডাপ্টার ইন্সটল করুন:

```bash
npm install @digitalchokro/askchokro @digitalchokro/adapter-nextjs @digitalchokro/provider-openai @digitalchokro/db-postgres
```

`app/api/ask/route.ts` এ একটি রাউট হ্যান্ডলার তৈরি করুন:

```typescript
// app/api/ask/route.ts
import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroRoute } from '@digitalchokro/adapter-nextjs';

// স্বয়ংক্রিয়ভাবে process.env.DATABASE_URL এবং process.env.OPENAI_API_KEY ডিটেক্ট করে
const agent = new AskChokro();

export const POST = createAskChokroRoute(agent);
```

আপনার ফ্রন্টএন্ডে:

```javascript
const res = await fetch('/api/ask', {
  method: 'POST',
  body: JSON.stringify({ question: 'Who are my top 5 customers this month?' })
});

const { answer, sql, rows } = await res.json();
console.log(sql);  // "SELECT name, SUM(amount) FROM orders GROUP BY name ORDER BY SUM(amount) DESC LIMIT 5"
console.table(rows);
```

ব্যাস, এতটুকুই! আপনি সফলভাবে আপনার অ্যাপে এআই ডেটা অ্যানালিটিক্স যুক্ত করে ফেলেছেন।

## মাল্টি-ট্যানান্ট সিকিউরিটি (AST রিরাইটিং)

B2B SaaS-এ এআই (AI) এম্বেড করার সময় ট্যানান্ট আইসোলেশন (এক ইউজারের ডেটা থেকে অন্য ইউজারকে আলাদা রাখা) সবচেয়ে কঠিন কাজ। সাধারণ স্ট্রিং-অ্যাপেন্ডিং (`WHERE tenant_id = X`) তখন ব্যর্থ হয় যখন এআই (AI) এমন কোনো সাব-কুয়েরি বা জটিল `JOIN` জেনারেট করে যা ফিল্টারকে বাইপাস করে যায়।

AskChokro একটি অত্যন্ত উন্নত **AST Scope Rewriter** ব্যবহার করে।

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
      // আপনার রিকোয়েস্ট কনটেক্সট থেকে বর্তমান ইউজারের অর্গ আইডি (org ID) ইনজেক্ট করে
      getValue: (ctx) => ctx.orgId, 
    }
  }
});
```

`tenantScoping` এনাবল থাকলে, যদি এআই (AI) জেনারেট করে:
```sql
SELECT o.id, u.email FROM orders o JOIN users u ON o.user_id = u.id
```

AskChokro-এর AST রিরাইটার সরাসরি কুয়েরিটি আটকে দেয়, সিনট্যাক্স ট্রি পার্স করে, এবং ডেটাবেসে পাঠানোর আগেই *প্রতিটি* টেবিল রেফারেন্সে আপনার ট্যানান্ট লজিক ইনজেক্ট করে দেয়:
```sql
SELECT o.id, u.email 
FROM orders o 
JOIN users u ON o.user_id = u.id AND u.organization_id = 'org_123'
WHERE o.organization_id = 'org_123'
```

*AskChokro এর ফেইল-ক্লোজড (fail-closed) ডিজাইন ঝুঁকি অনেকাংশে কমিয়ে দেয়। ৯-স্তরের প্রতিরক্ষা ব্যবস্থা সম্পর্কে বিস্তারিত জানতে আমাদের [সিকিউরিটি গাইড (Security Guide)](./docs/SECURITY.md) দেখুন।*

## অ্যাকুরেসি বেঞ্চমার্ক (নির্ভুলতা)

আমরা ১৯৮টি জটিল SQL সিনারিওর একটি কঠোর এবং ওপেন-সোর্স ডেটাসেট দিয়ে AskChokro-কে পরীক্ষা করেছি।

| মডেল | সামগ্রিক | অ্যাগ্রিগেশনস | মাল্টি-টেবিল JOINs | ট্যানান্ট স্কোপিং |
|---|---|---|---|---|
| **GPT-4o** | **৯৫.৯%** | ৯৮% | ৯৫% | ১০০% |
| **Claude 3.5 Sonnet** | **৯৬.৫%** | ৯৯% | ৯৬% | ১০০% |
| **Qwen 2.5 Coder (লোকাল)** | **৮৭.৮%** | ৮৮% | ৮৫% | ১০০% |

*(পূর্ণাঙ্গ মেথডলজির জন্য, আমাদের CI eval harness দেখুন).*

## বর্তমান সীমাবদ্ধতা

AskChokro-কে সহজ এবং সুরক্ষিত রাখার উদ্দেশ্যেই ডিজাইন করা হয়েছে, যার মানে এটি ইচ্ছাকৃতভাবেই কিছু ট্রেড-অফ (trade-offs) মেনে চলে:
- **শুধুমাত্র সিঙ্গেল স্টেটমেন্ট:** জটিল স্ক্রিপ্ট ইনজেকশন রোধ করতে ইঞ্জিন প্রতি রিকোয়েস্টে ঠিক একটি `SELECT` স্টেটমেন্ট বাধ্যতামূলক করে।
- **কোনো DML (মিউটেশনস) নেই:** এটি কঠোরভাবে রিড-ওনলি। `INSERT`, `UPDATE`, `DELETE`, এবং `DROP` স্টেটমেন্টগুলোকে AST লেভেলেই ব্লক করা আছে।
- **জটিল অ্যাগ্রিগেশন:** এটি সাধারণ জয়েন এবং অ্যাগ্রিগেশন ভালোভাবে সামলাতে পারলেও, অত্যন্ত জটিল উইন্ডো ফাংশন (window functions) বা রিকার্সিভ CTE-এর ক্ষেত্রে ছোট লোকাল মডেলগুলো বিভ্রান্ত হতে পারে।

## খুব শীঘ্রই আসছে: ওয়ার্ডপ্রেস প্লাগিন (WordPress Plugin)

আমরা অফিসিয়াল **AskChokro WordPress Plugin** তৈরি নিয়ে কাজ করছি।
এর সাহায্যে আপনি কোনো কোড ছাড়াই আপনার WooCommerce ড্যাশবোর্ডে সরাসরি একটি এআই (AI) ডেটা অ্যাসিস্ট্যান্ট বসিয়ে দিতে পারবেন।

**ওয়ার্ডপ্রেস রোডম্যাপ:**
- **ফেজ ১:** AskChokro Node.js মাইক্রোসার্ভিস (Pre-configured Docker container)
- **ফেজ ২:** WordPress PHP Plugin (Settings UI ও Gutenberg Blocks)
- **ফেজ ৩:** মাল্টি-ভেন্ডর সেটআপের জন্য অটোমেটিক ট্যানান্ট আইসোলেশন

পর্দার আড়ালে এটি কীভাবে কাজ করে তা জানতে আমাদের [ইন্টিগ্রেশন আর্কিটেকচার (Integration Architecture)](./docs/INTEGRATION_ARCHITECTURE.md) পড়ুন।

## সচরাচর জিজ্ঞাসিত প্রশ্ন (FAQ)

**AskChokro আসলে কি?**  
AskChokro হলো Node.js-এর জন্য একটি ওপেন-সোর্স এআই (AI) ডেটা ইঞ্জিন। এটি ডেভেলপারদের খুব সহজেই তাদের অ্যাপ্লিকেশনে ন্যাচারাল ল্যাঙ্গুয়েজ থেকে SQL (Text-to-SQL) ফিচার যুক্ত করতে সাহায্য করে। এর মাধ্যমে সাধারণ মানুষের ভাষায় প্রশ্ন করেই ডেটাবেস থেকে সঠিক তথ্য বের করা যায়।

**AskChokro কি মাল্টি-ট্যানান্ট (Multi-tenant) SaaS-এর জন্য নিরাপদ?**  
হ্যাঁ, সম্পূর্ণ নিরাপদ। AskChokro AST (Abstract Syntax Tree) লেভেলে কুয়েরি রিরাইট করে ডেটাবেসের সর্বোচ্চ নিরাপত্তা নিশ্চিত করে, যাতে এআই (AI) কোনোভাবেই এক ইউজারের ডেটা অন্য ইউজারকে দেখাতে না পারে।

**AskChokro কি অফলাইনে লোকাল এআই (Local LLM) সাপোর্ট করে?**  
অবশ্যই। আপনি Ollama ব্যবহার করে সম্পূর্ণ অফলাইনে লোকাল এআই মডেল (যেমন: Qwen, Llama 3) দিয়ে AskChokro চালাতে পারবেন, যা আপনার ডেটাবেস স্কিমা ও ডেটাকে থার্ড-পার্টি সার্ভার থেকে শতভাগ সুরক্ষিত রাখে। এছাড়া এটি OpenAI, Anthropic এবং Gemini-ও সাপোর্ট করে।

**AskChokro কি ভুল তথ্য বা ভুয়া ডেটাবেস টেবিল (Hallucination) বানাতে পারে?**  
না। AskChokro অত্যন্ত কঠোর RAG (Retrieval-Augmented Generation) পদ্ধতি ব্যবহার করে। যদি কোনো ইউজার ডেটাবেসের বাইরের কোনো অবান্তর প্রশ্ন করে, তবে এটি ভুল উত্তর বা ভুয়া SQL জেনারেট না করে সরাসরি `CANNOT_ANSWER` রিটার্ন করে।

**AskChokro কোন কোন ডেটাবেস সাপোর্ট করে?**  
AskChokro অফিসিয়ালি PostgreSQL, MySQL এবং SQLite সাপোর্ট করে।

## ডকুমেন্টেশন

- [Quick Start](./docs/QUICK_START.md) - সম্পূর্ণ ৫-মিনিটের ইন্টিগ্রেশন গাইড।
- [Security Model](./docs/SECURITY.md) - AST ভ্যালিডেশন, কলাম মাস্কিং এবং রিড-ওনলি স্যান্ডবক্সিং নিয়ে বিস্তারিত আলোচনা।
- [Plugin Development](./docs/PLUGINS.md) - কীভাবে আপনার নিজস্ব `AIProvider` বা `DatabaseAdapter` তৈরি করবেন তা শিখুন।
- [Integration Architecture](./docs/INTEGRATION_ARCHITECTURE.md) - বিভিন্ন প্ল্যাটফর্মে AskChokro কীভাবে এম্বেড করবেন তা জানুন।

## অবদান রাখুন (Contributing)

আমরা নতুন কন্ট্রিবিউটর খুঁজছি! আমাদের [Contributing Guide](CONTRIBUTING.md) দেখুন এবং `good first issue` ট্যাগ দেওয়া ইস্যুগুলো খুঁজে বের করুন।

আপনি যদি MySQL, Gemini, Google Vertex বা Fastify এর জন্য সাপোর্ট যুক্ত করতে চান, তবে আমাদের কাছে আপনার জন্য অটোমেটেড টেমপ্লেট প্রস্তুত আছে।

## লাইসেন্স

MIT © Digital Chokro
