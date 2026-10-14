import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Google Sites image URLs are signed per page load. Import original resource
// bytes collected by the browser, mapping unchanged source URLs by DOM slots.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = process.argv[2] || path.join(root, '..', 'work', 'browser-assets.json');
const manifests = JSON.parse(await readFile(inputPath, 'utf8'));
const source = JSON.parse(await readFile(path.join(root, 'content', 'source.json'), 'utf8'));
const extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg','image/avif':'avif'};
const mappings = [];

for (const [slug, page] of Object.entries(source.pages)) {
  const manifest = manifests[slug];
  if (!manifest?.bundle?.assets) throw new Error(`Missing browser bundle for ${slug}; capture all six pages first.`);
  if (manifest.bundle.failures?.length) throw new Error(`${slug}: browser bundle contains failed downloads.`);
  const assets = manifest.bundle.assets.filter(item => item.url && !item.url.startsWith('inline-svg:') && item.kind === 'image');
  const byUrl = new Map(assets.map(item => [item.url, item]));
  const domImages = manifest.dom?.images;
  const domBackgrounds = manifest.dom?.backgrounds;
  if (domImages && domImages.length !== page.images.length) throw new Error(`${slug}: source/browser image count differs (${page.images.length}/${domImages.length}).`);
  const used = new Set();
  for (let i = 0; i < page.images.length; i++) {
    const original = page.images[i];
    const observedUrl = domImages ? domImages[i].src : original.src;
    const observed = byUrl.get(observedUrl);
    if (!observed) throw new Error(`${slug}: no downloaded original resource matches image slot ${i+1}.`);
    used.add(observed.url);
    mappings.push({slug, type:'image', sourceUrl:original.src, observed});
  }
  const backgroundSlots = page.sections.flatMap(section => section.backgroundImages.map(background => ({sectionId:section.id,background})));
  if (domBackgrounds && domBackgrounds.length !== backgroundSlots.length) throw new Error(`${slug}: source/browser background count differs (${backgroundSlots.length}/${domBackgrounds.length}).`);
  for (const slot of backgroundSlots) {
    let observed;
    if (domBackgrounds) {
      const domSlot = domBackgrounds.find(item => item.sectionId === slot.sectionId);
      if (!domSlot) throw new Error(`${slug}: browser background section ID absent: ${slot.sectionId}`);
      observed = byUrl.get(domSlot.url);
    } else {
      const remaining = assets.filter(item => !used.has(item.url));
      if (backgroundSlots.length !== 1 || remaining.length !== 1) throw new Error(`${slug}: omitted DOM metadata cannot unambiguously identify background.`);
      observed = remaining[0];
    }
    if (!observed) throw new Error(`${slug}: downloaded original background absent: ${slot.sectionId}`);
    used.add(observed.url);
    mappings.push({slug,type:'background',sourceUrl:slot.background.url,observed});
  }
}

// Validate every mapping before writing the imported baseline.
await mkdir(path.join(root,'assets'), {recursive:true});
const inventory = new Map();
const pageLookups = new Map();
for (const mapping of mappings) {
  const bytes = await readFile(mapping.observed.path);
  const mime = mapping.observed.contentType.split(';')[0];
  const ext = extensions[mime];
  if (!ext) throw new Error(`Unexpected original resource content type: ${mime}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const localPath = `assets/original-${sha256.slice(0,16)}.${ext}`;
  await writeFile(path.join(root,localPath), bytes);
  const provenance = {page:mapping.slug,browserObservedUrl:mapping.observed.url,method:'browser-resource-bundle'};
  const prior = inventory.get(mapping.sourceUrl);
  if (prior && prior.sha256 !== sha256) throw new Error(`One original source URL resolved to differing bytes: ${mapping.sourceUrl}`);
  if (prior) prior.provenance.push(provenance);
  else inventory.set(mapping.sourceUrl,{url:mapping.sourceUrl,path:localPath,sha256,mime,bytes:bytes.length,browserObservedUrl:mapping.observed.url,provenance:[provenance]});
  if (!pageLookups.has(mapping.slug)) pageLookups.set(mapping.slug,new Map());
  pageLookups.get(mapping.slug).set(mapping.sourceUrl,{asset:localPath,browserObservedUrl:mapping.observed.url});
}
function attach(value, lookup) {
  if (Array.isArray(value)) { value.forEach(item => attach(item,lookup)); return; }
  if (!value || typeof value !== 'object') return;
  const mapping = lookup.get(value.src || value.url);
  if (mapping) Object.assign(value,mapping);
  Object.values(value).forEach(item => attach(item,lookup));
}
for (const [slug,page] of Object.entries(source.pages)) attach(page,pageLookups.get(slug));
source.assets = [...inventory.values()];
source.assetImport = {method:'browser-resource-bundle', importedAt:new Date().toISOString(),mappedSlots:mappings.length};
await writeFile(path.join(root,'assets','original-image-inventory.json'),JSON.stringify(source.assets,null,2)+'\n');
await writeFile(path.join(root,'content','source.json'),JSON.stringify(source,null,2)+'\n');
console.log(JSON.stringify({pages:Object.keys(source.pages).length,mappedSlots:mappings.length,sourceUrls:source.assets.length,uniqueFiles:new Set(source.assets.map(item=>item.path)).size,totalUniqueBytes:[...new Map(source.assets.map(item=>[item.path,item.bytes])).values()].reduce((a,b)=>a+b,0)}));
