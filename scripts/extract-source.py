"""Extract immutable original content using only the Python standard library."""
from html.parser import HTMLParser
from pathlib import Path
from html import escape
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
KEEP = set('p h1 h2 h3 h4 h5 h6 ul ol li a span br strong b em i u s sup sub blockquote'.split())

class Node:
    def __init__(self, tag='', attrs=(), parent=None, start=0, open_end=0):
        self.tag = tag
        self.attrs = dict(attrs)
        self.parent = parent
        self.children = []
        self.start = start
        self.open_end = open_end
        self.close_start = open_end
        self.end = open_end
    def hasclass(self, value):
        return value in (self.attrs.get('class') or '').split()
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()
    def text(self):
        return ''.join(child.text() if isinstance(child, Node) else child for child in self.children)

class Tree(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.offsets = [0]
        for match in re.finditer('\n', source):
            self.offsets.append(match.end())
        self.root = Node('document')
        self.current = self.root
        self.feed(source)
    def pos(self):
        line, column = self.getpos()
        return self.offsets[line-1] + column
    def handle_starttag(self, tag, attrs):
        start = self.pos()
        raw = self.get_starttag_text()
        node = Node(tag, attrs, self.current, start, start + len(raw))
        self.current.children.append(node)
        if tag not in VOID:
            self.current = node
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.current = self.current.parent
    def handle_endtag(self, tag):
        node = self.current
        while node != self.root and node.tag != tag:
            node = node.parent
        if node == self.root:
            return
        pos = self.pos()
        end = self.source.find('>', pos) + 1
        close = self.current
        while close != node:
            close.close_start = pos
            close.end = pos
            close = close.parent
        node.close_start = pos
        node.end = end
        self.current = node.parent
    def handle_data(self, data):
        self.current.children.append(data)
    def raw(self, node):
        return self.source[node.start:node.end]
    def inner(self, node):
        return self.source[node.open_end:node.close_start]

def clean(node):
    if isinstance(node, str):
        return escape(node, quote=False)
    if node.tag in {'script', 'style', 'svg', 'iframe'} or node.attrs.get('aria-hidden') == 'true' or node.hasclass('PPhIP'):
        return ''
    inside = ''.join(clean(child) for child in node.children)
    if node.tag not in KEEP:
        return inside
    if node.tag == 'br':
        return '<br>'
    attrs = ''
    if node.tag == 'a':
        if node.attrs.get('aria-label') == 'Copy heading link':
            return ''
        for name in ['href', 'target', 'rel', 'title', 'aria-label']:
            if node.attrs.get(name):
                attrs += f' {name}="{escape(node.attrs[name], quote=True)}"'
    if node.tag == 'span':
        style = node.attrs.get('style') or ''
        if re.search(r'font-weight:\s*(?:[6-9]00|bold)\b', style):
            inside = f'<strong>{inside}</strong>'
        if re.search(r'font-style:\s*italic\b', style):
            inside = f'<em>{inside}</em>'
        if re.search(r'text-decoration:\s*underline\b', style):
            inside = f'<u>{inside}</u>'
        return f'<span>{inside}</span>'
    return f'<{node.tag}{attrs}>{inside}</{node.tag}>'

def plain_text(node):
    if isinstance(node, str):
        return node
    if node.tag in {'script','style','svg'} or node.attrs.get('aria-hidden') == 'true' or node.hasclass('PPhIP'):
        return ''
    return ''.join(plain_text(child) for child in node.children)

def links(node):
    out = []
    for item in node.walk():
        if item.tag == 'a' and item.attrs.get('href') and item.attrs.get('aria-label') != 'Copy heading link':
            out.append({'href': item.attrs['href'], 'text': plain_text(item), 'label':item.attrs.get('aria-label', ''), 'target':item.attrs.get('target', '')})
    return out

def image(node):
    return {key: node.attrs.get(key, '') for key in ['src','alt','width','height']}

def embeds(node, tree):
    codes = [item.attrs['data-code'] for item in node.walk() if item.attrs.get('data-code')]
    if codes:
        out = []
        for code in codes:
            embedded = Tree(code)
            for frame in embedded.root.walk():
                if frame.tag == 'iframe':
                    out.append({**frame.attrs, 'originalHtml': code})
        return out
    return [{**item.attrs, 'originalHtml':tree.raw(item)} for item in node.walk() if item.tag == 'iframe']

def backgrounds(node):
    out = []
    for item in node.walk():
        style = item.attrs.get('style') or ''
        for match in re.finditer(r'background-image:\s*url\(([^)]+)\)', style):
            out.append({'url': match.group(1).strip('\"\''), 'style': style})
    return out

def nearest_id(node, stop):
    while node and node != stop:
        if node.attrs.get('id'):
            return node.attrs['id']
        node = node.parent
    return ''

def capture_page(info):
    source = (ROOT / info['sourcePath']).read_text(encoding='utf-8')
    tree = Tree(source)
    sections = []
    all_nodes = list(tree.root.walk())
    for order, section in enumerate(n for n in all_nodes if n.tag == 'section' and n.hasclass('yaqOZd')):
        sid = section.attrs.get('id') or f'section-{order+1}'
        blocks = []
        for num, unit in enumerate(n for n in section.walk() if n.hasclass('tyJCtd')):
            text = plain_text(unit)
            imgs = [image(n) for n in unit.walk() if n.tag == 'img' and n.attrs.get('src')]
            frames = embeds(unit, tree)
            hrefs = links(unit)
            kind = 'embed' if frames else 'image' if imgs and not text.strip() else 'button' if unit.hasclass('N0neUc') else 'social' if not text.strip() and hrefs else 'richtext'
            cleaned = ''.join(clean(child) for child in unit.children)
            text_nodes = [{'tag':n.tag,'text':plain_text(n),'html':clean(n)} for n in unit.walk() if n.tag in {'p','h1','h2','h3','h4','h5','h6','li'}]
            blocks.append({'id':f'{info["slug"]}-{order+1}-{num+1}', 'sourceId':nearest_id(unit, section), 'kind':kind, 'text':text, 'html':cleaned, 'originalHtml':tree.inner(unit), 'textNodes':text_nodes, 'images':imgs, 'links':hrefs, 'embeds':frames})
        sections.append({'id':sid, 'order':order, 'classes':section.attrs.get('class',''), 'originalHtml':tree.raw(section), 'backgroundImages':backgrounds(section), 'blocks':blocks})
    title = next((n.text() for n in all_nodes if n.tag == 'title'),info['slug'].title())
    nav = []
    seen = set()
    for node in all_nodes:
        if node.tag == 'a' and node.attrs.get('data-navtype') and node.attrs.get('href','').startswith('/'):
            label = plain_text(node).strip()
            href = node.attrs['href']
            if label and (label,href) not in seen:
                seen.add((label,href)); nav.append({'label':label,'href':href})
    return {'slug':info['slug'],'url':info['url'],'title':title,'sourcePath':info['sourcePath'],'sourceSha256':info['sha256'],'navigation':nav,'sections':sections,'images':[image(n) for n in all_nodes if n.tag=='img' and n.attrs.get('src')],'backgroundImages':backgrounds(tree.root),'links':links(tree.root),'embeds':embeds(tree.root, tree)}

capture = json.loads((ROOT / 'source-snapshots/capture.json').read_text(encoding='utf-8'))
pages = {info['slug']:capture_page(info) for info in capture['pages']}
inventory_path = ROOT/'assets/original-image-inventory.json'
inventory = json.loads(inventory_path.read_text(encoding='utf-8')) if inventory_path.exists() else []
asset_lookup = {item['url']:item for item in inventory}
def attach_assets(value):
    if isinstance(value,list):
        for item in value:
            attach_assets(item)
    elif isinstance(value,dict):
        if value.get('src') in asset_lookup:
            asset = asset_lookup[value['src']]
            value['asset'] = asset['path']
            if asset.get('browserObservedUrl'):
                value['browserObservedUrl'] = asset['browserObservedUrl']
        if value.get('url') in asset_lookup:
            asset = asset_lookup[value['url']]
            value['asset'] = asset['path']
            if asset.get('browserObservedUrl'):
                value['browserObservedUrl'] = asset['browserObservedUrl']
        for item in value.values():
            attach_assets(item)
attach_assets(pages)
output = {'schemaVersion':1,'capturedAt':capture['capturedAt'],'sourceBase':capture['sourceBase'],'navigation':pages['home']['navigation'],'pages':pages,'assets':inventory}
(ROOT/'content').mkdir(exist_ok=True)
(ROOT/'content/source.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
requests = sorted({i['src'] for p in pages.values() for i in p['images']} | {b['url'] for p in pages.values() for b in p['backgroundImages']})
(ROOT/'content/asset-requests.json').write_text(json.dumps(requests, indent=2)+'\n',encoding='utf-8')
print(json.dumps({slug:{'sections':len(page['sections']),'blocks':sum(len(s['blocks']) for s in page['sections']),'images':len(page['images']),'embeds':len(page['embeds'])} for slug,page in pages.items()}))
