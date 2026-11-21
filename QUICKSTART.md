# AskChokro 60-Second Quickstart

Get AskChokro running locally with pre-seeded sample data in under one minute.

## Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- (Optional) [Ollama](https://ollama.ai/) running locally on host (`ollama run qwen2.5:0.5b`), or an OpenAI / Gemini / Anthropic API key.

## 1. Start the Quickstart Container

```bash
docker compose -f docker-compose.quickstart.yml up -d --build
```

The container automatically:
1. Provisions a local SQLite database (`quickstart.db`).
2. Populates sample e-commerce data: businesses, users, products, orders, order items, and reviews.
3. Exposes the AskChokro AI microservice on `http://localhost:4000`.

## 2. Verify Health

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{"status":"ok","engine":"AskChokro Microservice","database":"connected"}
```

## 3. Query Your Data Using Natural Language

### Using Local Ollama (Default)
Ensure Ollama is running on your machine:
```bash
ollama run qwen2.5:0.5b
```

Send a question:
```bash
curl -X POST http://localhost:4000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How many completed orders are there?"}'
```

### Using OpenAI / Claude / Gemini
Pass your API key when launching:
```bash
ASKCHOKRO_PROVIDER=openai OPENAI_API_KEY="sk-..." docker compose -f docker-compose.quickstart.yml up -d
```

## 4. Teardown
```bash
docker compose -f docker-compose.quickstart.yml down -v
```
