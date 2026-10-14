import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Capture original published HTML without changing text or image data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['home', 'treatments', 'about', 'testimonials', 'partners', 'contact'];
const base = 'https://www.sacredlayers.com.au';
await mkdir(path.join(root, 'source-snapshots'), { recursive: true });
const metadata = await Promise.all(pages.map(async slug => {
  const url = `${base}/${slug === 'home' ? '' : slug}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const sourcePath = `source-snapshots/${slug}.html`;
  await writeFile(path.join(root, sourcePath), buffer);
  return { slug, url, sourcePath, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'), contentType: response.headers.get('content-type') };
}));
await writeFile(path.join(root, 'source-snapshots', 'capture.json'), JSON.stringify({ capturedAt: new Date().toISOString(), sourceBase: base, pages: metadata }, null, 2) + '\n');
console.log(JSON.stringify(metadata.map(({slug,bytes}) => ({slug,bytes}))));
