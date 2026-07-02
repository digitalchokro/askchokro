import express from 'express';
import { AskChokro } from 'askchokro';
import { createAskChokroMiddleware } from '@askchokro/adapter-express';

// 1. Initialize the wrapper (auto-detects environment variables)
const agent = new AskChokro();

// 2. Setup Express
const app = express();
app.use(express.json());

// 3. Mount the adapter
app.post('/api/ask', createAskChokroMiddleware(agent));

app.listen(3000, () => {
  console.log('AskChokro Express Example running on http://localhost:3000');
  console.log('Try: curl -X POST http://localhost:3000/api/ask -H "Content-Type: application/json" -d \'{"question": "How many users?"}\'');
});
