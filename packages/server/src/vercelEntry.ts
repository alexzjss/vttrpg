import { createDeps } from './deps';
import type { ServerDeps } from './http';
import { toNodeHandler } from './nodeAdapter';

let cached: ServerDeps | undefined;

export default toNodeHandler(() => {
  cached ??= createDeps({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SETUP_TOKEN: process.env.SETUP_TOKEN,
  });
  return cached;
});
