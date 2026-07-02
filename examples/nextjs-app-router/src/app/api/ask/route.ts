import { AskChokro } from '@digitalchokro/askchokro';
import { createAskChokroRoute } from '@digitalchokro/adapter-nextjs';

// 1. Initialize the wrapper (auto-detects environment variables)
const agent = new AskChokro();

// 2. Export the POST handler
export const POST = createAskChokroRoute(agent);
