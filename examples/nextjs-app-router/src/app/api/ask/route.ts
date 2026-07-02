import { AskChokro } from 'askchokro';
import { createAskChokroRoute } from '@askchokro/adapter-nextjs';

// 1. Initialize the wrapper (auto-detects environment variables)
const agent = new AskChokro();

// 2. Export the POST handler
export const POST = createAskChokroRoute(agent);
