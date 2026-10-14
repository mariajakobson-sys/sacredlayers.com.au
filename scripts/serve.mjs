import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const routes = new Set(['/', '/home', '/treatments', '/about', '/testimonials', '/partners', '/contact']);
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/\/$/, '') || '/';
    const relative = routes.has(pathname) ? 'index.html' : pathname.replace(/^\//, '');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    const info = await stat(target);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    response.end(await readFile(target));
  } catch {
    response.writeHead(404, {'Content-Type':'text/plain'});
    response.end('Page not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/design-explorer.html`));
