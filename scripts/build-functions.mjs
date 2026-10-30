// Gera .vercel/output (Build Output API v3): estáticos do web + função /api bundlada com esbuild.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'apps/web/dist');
const out = path.join(root, '.vercel/output');
const funcDir = path.join(out, 'functions/api.func');

if (!existsSync(dist)) throw new Error('apps/web/dist não existe: rode o build do web antes.');

rmSync(out, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });
cpSync(dist, path.join(out, 'static'), { recursive: true });

await build({
  entryPoints: [path.join(root, 'packages/server/src/vercelEntry.ts')],
  outfile: path.join(funcDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Dependências CJS bundladas em ESM podem precisar de require.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});

writeFileSync(
  path.join(funcDir, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs' }, null, 2),
);
writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/api/(.*)', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log('Build Output API gerado em .vercel/output');
