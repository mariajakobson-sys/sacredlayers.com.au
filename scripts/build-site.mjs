import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(await readFile(path.join(root, 'content/source.json'), 'utf8'));
const config = JSON.parse(await readFile(path.join(root, 'content/site-config.json'), 'utf8'));
const omitted = new Set(config.omittedBlocks);
const dataDirectory = path.join(root, 'site-data');
await mkdir(dataDirectory, {recursive: true});
let bytes = 0;
function publishedBlock(block, footer) {
  const removeContact = config.removeFooterContact && footer && block.kind === 'richtext';
  return {
    id: block.id, kind: block.kind,
    text: removeContact ? block.text.replace(/^Contact\n?/, '') : block.text,
    html: removeContact ? block.html.replace(/<a href="\/contact"><span><u>Contact<\/u><\/span><\/a>(?:<br>){3}/, '') : block.html,
    images: block.images.map(({src, alt, asset}) => ({src, alt, asset})),
    links: removeContact ? block.links.filter(link => link.href !== '/contact') : block.links,
    embeds: block.embeds.map(({src, title}) => ({src, title}))
  };
}
for (const [slug, original] of Object.entries(baseline.pages)) {
  const page = {
    title: original.title,
    navigation: baseline.navigation,
    bookingUrl: config.bookingUrl,
    sections: original.sections.map((section, index) => ({
      id: section.id,
      backgroundImages: config.hideContactHeroPhoto && slug === 'contact' && index === 0 ? [] : section.backgroundImages.map(({url, asset}) => ({url, asset})),
      blocks: section.blocks.filter(block => !omitted.has(block.id)).map(block => publishedBlock(block, index === original.sections.length - 1))
    }))
  };
  const content = JSON.stringify(page) + '\n';
  bytes += Buffer.byteLength(content);
  await writeFile(path.join(dataDirectory, `${slug}.json`), content);
}
const dist = path.join(root, 'dist');
await mkdir(dist, {recursive: true});
for (const file of ['index.html', 'app.js', 'site.css', 'design-explorer.html', 'explorer.css']) await cp(path.join(root, file), path.join(dist, file));
await cp(dataDirectory, path.join(dist, 'site-data'), {recursive: true});
await cp(path.join(root, 'assets'), path.join(dist, 'assets'), {recursive: true});
for (const slug of Object.keys(baseline.pages)) {
  await mkdir(path.join(dist, slug), {recursive: true});
  await cp(path.join(root, 'index.html'), path.join(dist, slug, 'index.html'));
}
console.log(JSON.stringify({pages: Object.keys(baseline.pages).length, pageDataBytes: bytes, baselineBytes: Buffer.byteLength(JSON.stringify(baseline)), omittedModules: omitted.size}));
