import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

export function startServer(port = 4273) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end('Method not allowed'); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const base = pathname.startsWith('/lib/') ? path.join(root, 'lib') : path.join(root, 'web');
      const relative = pathname.startsWith('/lib/') ? pathname.slice(5) : pathname === '/' ? 'index.html' : pathname.slice(1);
      const target = path.resolve(base, relative);
      const inside = file => !path.relative(base, file).startsWith('..') && !path.isAbsolute(path.relative(base, file));
      if (!inside(target) || !types[path.extname(target)]) { res.writeHead(404).end('Not found'); return; }
      const actual = await realpath(target);
      if (!inside(actual) || !(await stat(actual)).isFile()) { res.writeHead(404).end('Not found'); return; }
      const body = await readFile(actual);
      res.writeHead(200, { 'Content-Type': types[path.extname(actual)], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end('Not found'); }
  });
  server.on('error', error => { console.error(`Traceglass: ${error.code === 'EADDRINUSE' ? `port ${port} is in use. Choose another with --port.` : error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  traceglass · local network workbench\n\n  Local: http://127.0.0.1:${server.address().port}\n  No uploads. No runtime dependencies.\n\n  Press Ctrl+C to stop.\n`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const port = i >= 0 ? Number(process.argv[i + 1]) : Number(process.env.PORT || 4273);
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error('Port must be an integer from 0 to 65535.'); process.exitCode = 1; }
  else startServer(port);
}
