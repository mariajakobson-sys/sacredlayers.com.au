// Presentation is separate from the unchanged original-content baseline.
const supportedPages = new Set(['home', 'treatments', 'about', 'testimonials', 'partners', 'contact']);
const requestedPage = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '') || 'home';
const pageKey = supportedPages.has(requestedPage) ? requestedPage : 'home';
const main = document.querySelector('#main');
const footer = document.querySelector('#footer');
const renderedBlocks = new Set();
const treatmentIds = ['restorative-massage', 'healing-bodywork', 'oncology-massage', 'body-scrub-ritual', 'deep-rest-therapy'];

try {
  const response = await fetch(`/site-data/${pageKey}.json`);
  if (!response.ok) throw new Error('Page content could not be loaded.');
  const page = await response.json();
  document.body.className = `page-${pageKey}`;
  document.title = page.title;
  renderNavigation(page.navigation, page.bookingUrl);
  renderPage(page);
  document.documentElement.dataset.contentReady = 'true';
  openLinkedTreatment();
} catch (error) {
  const message = document.createElement('p');
  message.className = 'load-error';
  message.textContent = 'Sacred Layers';
  main.append(message);
  console.error(error.message);
}

function localLink(href) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, location.origin);
  url.searchParams.delete('design');
  return `${url.pathname}${url.search}${url.hash}`;
}

function bookingLink(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'booking-link';
  a.textContent = 'Book Session';
  return a;
}

function renderNavigation(items, bookingUrl) {
  const nav = document.querySelector('#navigation');
  for (const item of items) {
    const a = document.createElement('a');
    a.href = localLink(item.href);
    a.textContent = item.label;
    if (item.href.replace('/', '') === pageKey) a.setAttribute('aria-current', 'page');
    if (item.href === '/contact') a.className = 'nav-contact';
    nav.append(a);
  }
  nav.append(bookingLink(bookingUrl));
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('#menu-toggle');
  const setMenu = open => {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  header.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setMenu(false); toggle.focus(); }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setMenu(false);
  });
  matchMedia('(max-width: 760px)').addEventListener('change', () => setMenu(false));
}

function decorateContent(wrapper) {
  for (const a of wrapper.querySelectorAll('a')) {
    const href = a.getAttribute('href');
    if (href) { a.dataset.sourceHref = href; a.href = localLink(href); }
    if (a.target === '_blank') a.rel = 'noopener noreferrer';
    if (['Learn More', 'More About Me'].includes(a.textContent.trim())) {
      a.classList.add('action-link');
      if (a.parentElement.matches('h1,h2,h3')) a.parentElement.classList.add('link-heading');
    }
  }
  for (const node of wrapper.querySelectorAll('p,h1,h2,h3,h4,h5,h6')) {
    if (!node.textContent.trim()) node.classList.add('source-spacer');
    if (/^\s*(?:\d+\s*min|Approx\s*\d+\s*Hours)[\s\S]*—[\s\S]*\$/i.test(node.textContent)) node.classList.add('price-line');
  }
}

function renderBlock(block) {
  renderedBlocks.add(block.id);
  const wrapper = document.createElement(block.kind === 'image' ? 'figure' : 'div');
  wrapper.dataset.sourceBlock = block.id;
  wrapper.className = block.kind === 'image' ? 'image-block' : 'rich-text';
  if (block.kind === 'image') {
    for (const original of block.images) {
      const img = document.createElement('img');
      img.src = `/${original.asset}`;
      img.dataset.sourceUrl = original.src;
      img.alt = original.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      const originalLink = block.links[0];
      if (originalLink) {
        const a = document.createElement('a');
        a.href = localLink(originalLink.href);
        a.dataset.sourceHref = originalLink.href;
        if (originalLink.target) a.target = originalLink.target;
        if (a.target === '_blank') a.rel = 'noopener noreferrer';
        if (originalLink.label) a.setAttribute('aria-label', originalLink.label);
        if (!original.alt && !originalLink.label && pageKey === 'partners') a.setAttribute('aria-label', originalLink.href.includes('revivalhealthlabs') ? 'Revival Health Labs' : 'Oncology Massage');
        a.append(img);
        wrapper.append(a);
      } else wrapper.append(img);
    }
  } else if (block.kind === 'embed') {
    wrapper.className = 'embed-wrap';
    wrapper.innerHTML = block.html;
    for (const original of block.embeds) {
      if (!original.src) continue;
      const iframe = document.createElement('iframe');
      iframe.src = original.src;
      iframe.className = 'contact-map';
      iframe.title = original.title || 'Revival Health Labs';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      wrapper.append(iframe);
    }
  } else {
    wrapper.innerHTML = block.html;
    decorateContent(wrapper);
  }
  return wrapper;
}

function makeSection(className, original) {
  const section = document.createElement('section');
  section.className = className;
  if (original) section.dataset.sourceSection = original.id;
  const inner = document.createElement('div');
  inner.className = 'section-inner';
  section.append(inner);
  return {section, inner};
}

function semanticHeading(wrapper, tag) {
  const heading = [...wrapper.querySelectorAll('h1,h2,h3')].find(node => node.textContent.trim());
  if (!heading || heading.tagName.toLowerCase() === tag) return;
  const replacement = document.createElement(tag);
  while (heading.firstChild) replacement.append(heading.firstChild);
  replacement.className = heading.className;
  heading.replaceWith(replacement);
}

function renderHero(page) {
  const {section, inner} = makeSection('hero', page.sections[0]);
  const copy = document.createElement('div');
  copy.className = 'hero-copy';
  const originals = [page.sections[0]];
  if (['testimonials', 'contact', 'partners'].includes(pageKey)) originals.push(page.sections[1]);
  for (const original of originals) for (const block of original.blocks) copy.append(renderBlock(block));
  semanticHeading(copy, 'h1');
  copy.append(bookingLink(page.bookingUrl));
  const media = document.createElement(pageKey === 'contact' ? 'div' : 'figure');
  media.className = 'hero-media';
  if (pageKey === 'contact') {
    media.classList.add('layer-art');
    media.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 3; index++) {
      const layer = document.createElement('span');
      media.append(layer);
    }
  }
  for (const original of page.sections[0].backgroundImages) {
    const img = document.createElement('img');
    img.src = `/${original.asset}`;
    img.dataset.sourceBackground = original.url;
    img.alt = '';
    img.fetchPriority = 'high';
    img.decoding = 'async';
    media.append(img);
  }
  inner.append(copy, media);
  main.append(section);
}

function renderHome(page) {
  const intro = makeSection('welcome', page.sections[1]);
  for (const block of page.sections[1].blocks) {
    const content = renderBlock(block);
    semanticHeading(content, 'h2');
    intro.inner.append(content);
  }
  main.append(intro.section);
  const services = makeSection('services', page.sections[2]);
  services.inner.classList.add('service-grid');
  let card;
  let serviceIndex = -1;
  for (const block of [...page.sections[2].blocks, ...page.sections[3].blocks]) {
    if (block.kind === 'image') {
      serviceIndex++;
      card = document.createElement('article');
      card.className = 'service-card';
      card.id = treatmentIds[serviceIndex];
      services.inner.append(card);
    }
    const content = renderBlock(block);
    for (const a of content.querySelectorAll('a[data-source-href="/treatments"]')) a.href = `/treatments#${treatmentIds[serviceIndex]}`;
    card.append(content);
  }
  main.append(services.section);
  const meet = makeSection('meet', page.sections[4]);
  for (const block of page.sections[4].blocks) meet.inner.append(renderBlock(block));
  main.append(meet.section);
}

function renderTreatments(page) {
  const list = makeSection('treatments');
  for (const [index, original] of page.sections.slice(1, 6).entries()) {
    const details = document.createElement('details');
    details.className = 'treatment';
    details.id = treatmentIds[index];
    details.dataset.sourceSection = original.id;
    details.open = index === 0;
    const summary = document.createElement('summary');
    summary.append(renderBlock(original.blocks[0]));
    const body = document.createElement('div');
    body.className = 'treatment-body';
    for (const block of original.blocks.slice(1)) body.append(renderBlock(block));
    details.append(summary, body);
    list.inner.append(details);
  }
  main.append(list.section);
}

function renderAbout(page) {
  const about = makeSection('about-copy', page.sections[1]);
  for (const block of page.sections[1].blocks) about.inner.append(renderBlock(block));
  main.append(about.section);
}

function renderTestimonials(page) {
  const reviews = makeSection('reviews', page.sections[2]);
  reviews.inner.classList.add('review-grid');
  for (const block of page.sections[2].blocks) {
    const article = document.createElement('article');
    article.className = 'review';
    article.append(renderBlock(block));
    reviews.inner.append(article);
  }
  main.append(reviews.section);
}

function renderPartners(page) {
  const partners = makeSection('partners');
  partners.inner.classList.add('partner-grid');
  for (const original of page.sections.slice(2, -1)) for (const block of original.blocks) if (block.kind === 'image') partners.inner.append(renderBlock(block));
  main.append(partners.section);
}

function renderContact(page) {
  const contact = makeSection('contact-details');
  contact.inner.classList.add('contact-grid');
  for (const original of page.sections.slice(3, 5)) {
    for (const block of original.blocks) {
      const content = renderBlock(block);
      if (block.id === 'contact-4-1') {
        content.classList.add('contact-person');
        const phone = [...content.querySelectorAll('span')].find(span => span.textContent.trim() === '0434 058 468');
        if (phone && !phone.closest('a')) {
          const link = document.createElement('a');
          link.href = 'tel:0434058468';
          phone.replaceWith(link);
          link.append(phone);
        }
      } else content.classList.add('contact-location');
      contact.inner.append(content);
    }
  }
  main.append(contact.section);
  const map = makeSection('map-section', page.sections[5]);
  for (const block of page.sections[5].blocks) map.inner.append(renderBlock(block));
  main.append(map.section);
}

function renderPage(page) {
  renderHero(page);
  ({home: renderHome, treatments: renderTreatments, about: renderAbout, testimonials: renderTestimonials, partners: renderPartners, contact: renderContact})[pageKey](page);
  const footerInner = document.createElement('div');
  footerInner.className = 'footer-inner';
  for (const block of page.sections.at(-1).blocks) footerInner.append(renderBlock(block));
  footer.append(footerInner);
  // Keep original whitespace modules without carrying the old empty layout.
  const reserve = document.createElement('div');
  reserve.hidden = true;
  for (const original of page.sections) {
    for (const block of original.blocks) {
      if (renderedBlocks.has(block.id)) continue;
      if (block.text.trim() || block.images.length || block.embeds.length) {
        const remainder = makeSection('additional-content', original);
        remainder.inner.append(renderBlock(block));
        main.append(remainder.section);
      } else reserve.append(renderBlock(block));
    }
  }
  main.append(reserve);
}

function openLinkedTreatment() {
  if (pageKey !== 'treatments' || !location.hash) return;
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const details = document.getElementById(id);
  if (!details?.matches('details.treatment')) return;
  details.open = true;
  requestAnimationFrame(() => details.scrollIntoView({block: 'start'}));
}
window.addEventListener('hashchange', openLinkedTreatment);
