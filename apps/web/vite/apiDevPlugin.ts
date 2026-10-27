import { fileURLToPath } from 'node:url';
import { loadEnv, type Plugin } from 'vite';

const serverDir = fileURLToPath(new URL('../../../packages/server/src/', import.meta.url));

/**
 * Monta o roteador de @vtt/server em /api/* no dev server. As variáveis do servidor
 * são lidas só aqui (loadEnv sem prefixo) e nunca entram no bundle do cliente.
 */
export function apiDevPlugin(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: 'vtt-api-dev',
    apply: 'serve',
    configResolved(config) {
      env = loadEnv(config.mode, config.root, '');
    },
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const mod = await server.ssrLoadModule(`${serverDir}nodeAdapter.ts`);
          const handler = mod.toNodeHandler(() => ({
            env: {
              SUPABASE_URL: env.SUPABASE_URL || undefined,
              SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY || undefined,
              SETUP_TOKEN: env.SETUP_TOKEN || undefined,
            },
          }));
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
