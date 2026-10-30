import { fileURLToPath } from 'node:url';
import { loadEnv, type Plugin } from 'vite';

const serverDir = fileURLToPath(new URL('../../../packages/server/src/', import.meta.url));

type Loader = (path: string) => Promise<Record<string, any>>;

/** Extrai só as variáveis do servidor de um mapa de ambiente. */
export function pickServerEnv(env: Record<string, string>) {
  return {
    SUPABASE_URL: env.SUPABASE_URL || undefined,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY || undefined,
    SETUP_TOKEN: env.SETUP_TOKEN || undefined,
  };
}

/** Constrói (uma vez por ambiente) as dependências reais via createDeps do servidor. */
export function createDevDepsProvider(load: Loader, env: Record<string, string>) {
  let cached: unknown;
  return async () => {
    if (!cached) {
      const mod = await load(`${serverDir}deps.ts`);
      cached = mod.createDeps(pickServerEnv(env));
    }
    return cached;
  };
}

/**
 * Monta o roteador de @vtt/server em /api/* no dev server. As variáveis do servidor
 * são lidas só aqui (loadEnv sem prefixo, do envDir) e nunca entram no bundle do cliente.
 */
export function apiDevPlugin(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: 'vtt-api-dev',
    apply: 'serve',
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir, '');
    },
    configureServer(server) {
      const getDeps = createDevDepsProvider((p) => server.ssrLoadModule(p), env);
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const mod = await server.ssrLoadModule(`${serverDir}nodeAdapter.ts`);
          const deps = await getDeps();
          const handler = mod.toNodeHandler(() => deps);
          // O connect remove o prefixo /api de req.url; o roteador espera o caminho completo.
          req.url = req.originalUrl ?? `/api${req.url ?? ''}`;
          await handler(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
