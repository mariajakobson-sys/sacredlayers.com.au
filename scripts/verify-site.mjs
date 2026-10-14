import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slugs = ['home', 'treatments', 'about', 'testimonials', 'partners', 'contact'];
const authorizedOmissions = ['home-6-1', 'home-7-1', 'contact-3-1', 'contact-2-2'];
const bookingUrl = 'https://www.phorest.com/salon/revivalhealthlabs/book/service-selection?showSpecialOffers=false';
const footerContactMarkup = '<a href="/contact"><span><u>Contact</u></span></a><br><br><br>';
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const json = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const isFormReference = (value) => /(?:docs\.google\.com\/forms|forms\.gle\/|Get in Touch\s*[—–-]\s*Enquiry Form|(?:Begin|Start) Your Journey)/i.test(value);

function validateAsset(relative, context) {
  if (typeof relative !== 'string' || !/^assets\/[A-Za-z0-9._-]+$/.test(relative)) {
    errors.push(`${context}: invalid local asset path ${JSON.stringify(relative)}`);
    return null;
  }
  const absolute = path.resolve(root, relative);
  const assetRoot = path.resolve(root, 'assets') + path.sep;
  check(absolute.startsWith(assetRoot), `${context}: asset escapes the assets directory`);
  if (!fs.existsSync(absolute)) {
    errors.push(`${context}: asset does not exist (${relative})`);
    return null;
  }
  const real = fs.realpathSync(absolute);
  check(real.startsWith(fs.realpathSync(path.join(root, 'assets')) + path.sep), `${context}: asset resolves outside the assets directory`);
  check(fs.statSync(absolute).isFile(), `${context}: asset is not a file (${relative})`);
  return absolute;
}

function inspectRuntime(value, context) {
  if (typeof value === 'string') {
    check(!isFormReference(value), `${context}: removed form or journey content is still present`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectRuntime(item, `${context}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      check(!['originalHtml', 'textNodes'].includes(key), `${context}: archival ${key} must not be sent to visitors`);
      inspectRuntime(child, `${context}.${key}`);
    }
  }
}

function compareImages(original = [], runtime = [], context, background = false) {
  check(Array.isArray(runtime), `${context}: images must be an array`);
  if (!Array.isArray(runtime)) return;
  check(runtime.length === original.length, `${context}: image count changed`);
  runtime.forEach((image, index) => {
    const reference = original[index];
    if (!reference) return;
    const keys = background ? ['url', 'asset'] : ['src', 'alt', 'asset'];
    for (const key of keys) {
      check(image[key] === reference[key], `${context}[${index}]: original ${key} changed`);
    }
    validateAsset(image.asset, `${context}[${index}]`);
  });
}

try {
  const source = json('content/source.json');
  const config = json('content/site-config.json');
  check(source.schemaVersion === 1, 'Unsupported baseline source schema');
  check(equal(Object.keys(source.pages).sort(), [...slugs].sort()), 'Baseline must contain precisely the six original pages');
  check(Array.isArray(config.omittedBlocks), 'Omission policy must be an array');
  check(equal([...(config.omittedBlocks || [])].sort(), [...authorizedOmissions].sort()), 'Omission policy must contain precisely the four user-authorized module IDs');
  check(config.removeFooterContact === true, 'Footer Contact removal must be explicitly enabled');
  check(config.hideContactHeroPhoto === true, 'Contact decorative hero photo removal must be explicitly enabled');
  check(config.bookingUrl === bookingUrl, 'Booking URL must match the exact user-provided URL');
  check(source.navigation.length === 6, 'Baseline navigation must contain six entries');
  const omitted = new Set(authorizedOmissions);
  const seenSourceIds = new Set();
  let retained = 0;

  for (const slug of slugs) {
    const originalPage = source.pages[slug];
    if (!originalPage) continue;
    const runtime = json(`site-data/${slug}.json`);
    inspectRuntime(runtime, slug);
    check(runtime.title === originalPage.title, `${slug}: original page title changed`);
    check(equal(runtime.navigation, source.navigation), `${slug}: original navigation labels or targets changed`);
    check(runtime.bookingUrl === bookingUrl, `${slug}: exact booking URL is missing from runtime content`);
    check(Array.isArray(runtime.sections), `${slug}: sections must be an array`);
    if (!Array.isArray(runtime.sections)) continue;

    const originalSections = new Map(originalPage.sections.map((section) => [section.id, section]));
    const sourceFooter = originalPage.sections.at(-1).blocks.find(block => block.links.some(link => link.href === '/contact'));
    check(!!sourceFooter, `${slug}: expected source footer Contact link was not found`);
    if (sourceFooter) {
      check(sourceFooter.html.includes(footerContactMarkup), `${slug}: original footer Contact markup changed unexpectedly`);
      check(sourceFooter.text.startsWith('Contact'), `${slug}: original footer Contact wording changed unexpectedly`);
    }
    const originalBlocks = new Map();
    for (const section of originalPage.sections) {
      for (const block of section.blocks) {
        check(!seenSourceIds.has(block.id), `Baseline has duplicate module ${block.id}`);
        seenSourceIds.add(block.id);
        if (!omitted.has(block.id)) originalBlocks.set(block.id, { block, sectionId: section.id });
      }
    }

    const seenSections = new Set();
    const seenBlocks = new Set();
    for (const section of runtime.sections) {
      check(!seenSections.has(section.id), `${slug}: duplicate section ${section.id}`);
      seenSections.add(section.id);
      const originalSection = originalSections.get(section.id);
      check(!!originalSection, `${slug}: unexpected section ${section.id}`);
      if (!originalSection) continue;
      const hiddenContactHero = slug === 'contact' && section.id === originalPage.sections[0].id;
      if (hiddenContactHero) check(originalSection.backgroundImages.length === 1, 'Expected exactly one original Contact hero background image');
      compareImages(hiddenContactHero ? [] : originalSection.backgroundImages, section.backgroundImages, `${slug}.${section.id}.backgroundImages`, true);
      check(Array.isArray(section.blocks), `${slug}.${section.id}: blocks must be an array`);
      if (!Array.isArray(section.blocks)) continue;
      for (const block of section.blocks) {
        check(!seenBlocks.has(block.id), `${slug}: duplicate module ${block.id}`);
        seenBlocks.add(block.id);
        check(!omitted.has(block.id), `${slug}: explicitly removed module ${block.id} is still present`);
        const reference = originalBlocks.get(block.id);
        check(!!reference, `${slug}: unexpected module ${block.id}`);
        if (!reference) continue;
        check(reference.sectionId === section.id, `${block.id}: module moved to an unrelated source section`);
        const footerBlock = block.id === sourceFooter?.id;
        const expected = footerBlock ? {
          ...reference.block,
          html: reference.block.html.replace(footerContactMarkup, ''),
          text: reference.block.text.replace(/^Contact\n?/, ''),
          links: reference.block.links.filter(link => link.href !== '/contact'),
        } : reference.block;
        for (const field of ['kind', 'text', 'html']) {
          check(block[field] === expected[field], `${block.id}: ${footerBlock ? 'authorized footer' : 'original'} ${field} is not byte-identical`);
        }
        compareImages(reference.block.images, block.images, `${block.id}.images`);
        const semanticLinks = (links = []) => links.map(({ href, text, label, target }) => ({ href, text, label, target }));
        check(equal(semanticLinks(block.links), semanticLinks(expected.links)), `${block.id}: ${footerBlock ? 'authorized footer' : 'original'} link wording or target changed`);
        check(equal((block.embeds || []).map(({ src }) => src), (reference.block.embeds || []).map(({ src }) => src)), `${block.id}: original embed source changed`);
      }
    }
    for (const [id] of originalBlocks) {
      check(seenBlocks.has(id), `${slug}: retained source module ${id} is missing`);
      retained += Number(seenBlocks.has(id));
    }
    for (const section of originalPage.sections) {
      if ((section.backgroundImages || []).length) {
        check(seenSections.has(section.id), `${slug}: original background-image section ${section.id} is missing`);
      }
    }
  }

  for (const id of omitted) check(seenSourceIds.has(id), `Authorized omission ${id} is absent from the baseline`);
  const originalMap = source.pages.contact.sections.flatMap(section => section.blocks).find(block => block.id === 'contact-6-1');
  check(originalMap?.embeds.length === 1 && originalMap.embeds[0].src.startsWith('https://www.google.com/maps/embed'), 'Original Contact map must remain in the retained content');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  check(app.includes('page.bookingUrl') && app.includes('Book Session'), 'Website renderer must consume the runtime booking URL and label it Book Session');
  check(retained === 65, `Expected 65 retained source modules, found ${retained}`);
  check(source.assets.length === 14, `Expected 14 original image assets, found ${source.assets.length}`);
  const seenAssets = new Set();
  let hashes = 0;
  for (const asset of source.assets) {
    check(!seenAssets.has(asset.path), `Duplicate baseline asset ${asset.path}`);
    seenAssets.add(asset.path);
    const absolute = validateAsset(asset.path, 'Baseline');
    if (!absolute) continue;
    const actual = createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    check(actual === asset.sha256, `Original image bytes changed (${asset.path})`);
    hashes += Number(actual === asset.sha256);
  }

  if (errors.length) {
    console.error(`Site verification failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
    errors.slice(0, 25).forEach((error) => console.error(`- ${error}`));
    if (errors.length > 25) console.error(`- ${errors.length - 25} additional issues`);
    process.exitCode = 1;
  } else {
    console.log(`Verified: 6 pages, ${retained} retained modules, 4 authorized omissions, 6 footer Contact links removed, Contact map retained, exact booking URL, ${hashes} original image hashes.`);
  }
} catch (error) {
  console.error(`Site verification failed: ${error.message}`);
  process.exitCode = 1;
}
