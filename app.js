// Every content module comes from the captured live site. Layout is separate.
const designs = new Set(['spacious', 'immersive', 'classic']);
const requestedDesign = new URLSearchParams(location.search).get('design');
const design = designs.has(requestedDesign) ? requestedDesign : 'spacious';
document.body.dataset.design = design;
const slug = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '') || 'home';
const pageKey = slug === 'index.html' ? 'home' : slug;
const baseline = await fetch('/content/source.json').then(response => {
  if (!response.ok) throw new Error('The captured content could not be loaded.');
  return response.json();
});
const page = baseline.pages[pageKey] || baseline.pages.home;
document.body.classList.add(`page-${pageKey}`);
document.title = page.title;

function localLink(href) {
  if (href.startsWith('/') && !href.startsWith('//')) {
    const url = new URL(href, location.origin);
    url.searchParams.set('design', design);
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return href;
}

for (const item of baseline.navigation) {
  const link = document.createElement('a');
  link.href = localLink(item.href);
  link.textContent = item.label;
  if (item.href.replace('/', '') === pageKey) link.setAttribute('aria-current', 'page');
  document.querySelector('#navigation').append(link);
}

if (design === 'classic') {
  const header = document.querySelector('.site-header');
  const brand = document.createElement('a');
  brand.className = 'site-brand';
  brand.href = localLink('/home');
  brand.textContent = 'Sacred Layers';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'menu-toggle';
  toggle.setAttribute('aria-label', 'Navigation');
  toggle.setAttribute('aria-controls', 'navigation');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span>';
  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  header.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setMenu(false); toggle.focus(); }
  });
  header.prepend(brand);
  header.append(toggle);
}

function decorateLinks(container) {
  for (const link of container.querySelectorAll('a')) {
    const href = link.getAttribute('href');
    if (href) {
      link.dataset.sourceHref = href;
      link.setAttribute('href', localLink(href));
    }
    if (link.target === '_blank') link.rel = 'noopener noreferrer';
    const label = link.textContent.trim();
    if (label === 'Learn More' || label === 'More About Me' || label === 'Get in Touch — Enquiry Form') {
      link.classList.add('action-link');
    }
  }
  for (const node of container.querySelectorAll('p,h1,h2,h3,h4,h5,h6')) {
    if (!node.textContent.trim()) node.classList.add('source-spacer');
  }
}

function renderBlock(block) {
  const wrapper = document.createElement(block.kind === 'image' ? 'figure' : 'div');
  wrapper.dataset.sourceBlock = block.id;
  wrapper.className = block.kind === 'image' ? 'image-block' : 'rich-text';
  if (block.kind === 'image') {
    for (const original of block.images) {
      const img = document.createElement('img');
      img.src = original.asset ? `/${original.asset}` : original.src;
      img.dataset.sourceUrl = original.src;
      img.alt = original.alt || '';
      img.loading = 'lazy';
      const linkInfo = block.links[0];
      if (linkInfo) {
        const a = document.createElement('a');
        a.href = localLink(linkInfo.href);
        a.dataset.sourceHref = linkInfo.href;
        if (linkInfo.target) a.target = linkInfo.target;
        if (a.target === '_blank') a.rel = 'noopener noreferrer';
        if (linkInfo.label) a.setAttribute('aria-label', linkInfo.label);
        a.append(img);
        wrapper.append(a);
      } else wrapper.append(img);
    }
  } else if (block.kind === 'embed') {
    wrapper.className = 'embed-wrap';
    // Keep the original module's literal text, then its original embedded map.
    wrapper.innerHTML = block.html;
    for (const original of block.embeds) {
      if (!original.src) continue;
      const iframe = document.createElement('iframe');
      iframe.src = original.src;
      iframe.className = 'embed-block';
      iframe.title = original.title || 'Map';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      wrapper.append(iframe);
    }
  } else {
    wrapper.innerHTML = block.html;
    decorateLinks(wrapper);
  }
  return wrapper;
}

function renderSection(section, index) {
  const wrapper = document.createElement('section');
  wrapper.className = 'page-section text-section';
  wrapper.dataset.sourceSection = section.id;
  const inner = document.createElement('div');
  inner.className = 'section-inner';
  wrapper.append(inner);
  const isFooter = index === page.sections.length - 1;
  const hasContent = section.blocks.some(block => block.text.trim() || block.images.length || block.embeds.length);
  if (!hasContent && !section.backgroundImages.length) wrapper.classList.add('empty-section');

  if (index === 0) {
    wrapper.className = `page-section hero${pageKey === 'home' ? '' : ' page-hero'}`;
    for (const background of section.backgroundImages) {
      const image = document.createElement('img');
      image.src = background.asset ? `/${background.asset}` : background.url;
      image.dataset.sourceBackground = background.url;
      image.alt = '';
      image.className = 'hero-image';
      image.fetchPriority = 'high';
      wrapper.prepend(image);
    }
  } else if (pageKey === 'home' && !isFooter) {
    const classNames = ['', 'intro', 'services', 'deep-rest', 'meet', 'journey', 'enquiry', 'empty-section'];
    wrapper.className = `page-section ${classNames[index] || 'text-section'}`;
  }

  if (pageKey === 'home' && index === 2) {
    let card;
    for (const block of section.blocks) {
      if (block.kind === 'image') {
        card = document.createElement('article');
        card.className = 'service-card';
        inner.append(card);
      }
      (card || inner).append(renderBlock(block));
    }
  } else if (pageKey === 'treatments' && index >= 1 && index <= 5) {
    wrapper.className = 'page-section treatment-section';
    const details = document.createElement('details');
    details.className = 'treatment';
    const summary = document.createElement('summary');
    summary.append(renderBlock(section.blocks[0]));
    const body = document.createElement('div');
    body.className = 'treatment-body';
    for (const block of section.blocks.slice(1)) body.append(renderBlock(block));
    details.append(summary, body);
    inner.append(details);
  } else {
    for (const block of section.blocks) inner.append(renderBlock(block));
  }

  if (isFooter) {
    document.querySelector('#footer').append(inner);
  } else document.querySelector('#main').append(wrapper);
}

page.sections.forEach(renderSection);
document.documentElement.dataset.contentReady = 'true';
