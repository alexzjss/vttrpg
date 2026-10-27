import { toNodeHandler } from './nodeAdapter';

export default toNodeHandler(() => ({
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SETUP_TOKEN: process.env.SETUP_TOKEN,
  },
}));
