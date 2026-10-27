import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = 4177;
const host = '127.0.0.1';
const distDir = resolve(fileURLToPath(new URL('../dist', import.meta.url)));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveFile(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = requestedPath === '/'
    ? join(distDir, 'index.html')
    : join(distDir, requestedPath);
  const normalizedPath = normalize(filePath);

  if (!normalizedPath.startsWith(distDir)) {
    return null;
  }

  if (existsSync(normalizedPath) && statSync(normalizedPath).isFile()) {
    return normalizedPath;
  }

  return join(distDir, 'index.html');
}

const server = createServer((request, response) => {
  const filePath = resolveFile(request.url ?? '/');

  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Arquivo nao encontrado.');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    process.exit(0);
  }

  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`RPG Codex aberto em http://${host}:${port}/`);
});
