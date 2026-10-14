"""Check original text, source archives and original-image file hashes."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
class TextReader(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.parts=[]
        self.feed(html)
    def handle_data(self, data):
        self.parts.append(data)

source=json.loads((ROOT/'content/source.json').read_text(encoding='utf-8'))
errors=[]
page_results={}
for slug,page in source['pages'].items():
    archive=ROOT/page['sourcePath']
    archive_checked=archive.exists()
    digest=hashlib.sha256(archive.read_bytes()).hexdigest() if archive_checked else page['sourceSha256']
    if archive_checked and digest != page['sourceSha256']:
        errors.append(f'{slug}: original archive hash changed')
    blocks=[b for section in page['sections'] for b in section['blocks']]
    for block in blocks:
        if block['kind'] in ['richtext','button']:
            original_text=''.join(TextReader(block['originalHtml']).parts)
            if original_text != block['text']:
                errors.append(f'{block["id"]}: baseline differs from original module text')
            text=''.join(TextReader(block['html']).parts)
            if text != block['text']:
                errors.append(f'{block["id"]}: clean HTML changed exact text')
    exact_text=''.join(b['text'] for b in blocks if b['kind'] in ['richtext','button'])
    page_results[slug]={'sections':len(page['sections']),'blocks':len(blocks),'textCharacters':len(exact_text),'textSha256':hashlib.sha256(exact_text.encode()).hexdigest(),'sourceSha256':digest,'archiveChecked':archive_checked}
for asset in source['assets']:
    image=ROOT/asset['path']
    if not image.exists() or hashlib.sha256(image.read_bytes()).hexdigest()!=asset['sha256']:
        errors.append(f'{asset["path"]}: original image hash mismatch')
report={'passed':not errors,'errors':errors,'pages':page_results,'assetsVerified':len(source['assets'])}
(ROOT/'content/verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':not errors,'errors':errors,'pages':len(page_results),'blocks':sum(p['blocks'] for p in page_results.values()),'assetsVerified':len(source['assets'])}))
raise SystemExit(1 if errors else 0)
