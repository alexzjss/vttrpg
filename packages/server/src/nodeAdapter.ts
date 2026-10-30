import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, json, readJsonBody, type ApiRequest, type ApiResponse, type ServerDeps } from './http';
import { route } from './router';

function send(res: ServerResponse, out: ApiResponse): void {
  res.statusCode = out.status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(out.body ?? null));
}

export function toNodeHandler(
  getDeps: () => ServerDeps,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
      }
      const apiReq: ApiRequest = {
        method: req.method ?? 'GET',
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers,
        body: await readJsonBody(req),
      };
      send(res, await route(apiReq, getDeps()));
    } catch (err) {
      if (err instanceof HttpError) return send(res, json(err.status, { error: err.code }));
      console.error(err);
      send(res, json(500, { error: 'internal' }));
    }
  };
}
