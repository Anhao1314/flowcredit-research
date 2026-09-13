"""Faithful text-layer extraction. No OCR, summaries or financial interpretation."""
import json
import sys
import pymupdf

if pymupdf.VersionBind != '1.26.5':
    raise RuntimeError('PDF parser requires pinned PyMuPDF 1.26.5')
doc = pymupdf.open(sys.argv[1])
if doc.needs_pass:
    raise ValueError('Encrypted PDF is unsupported')
units = []
for page in doc:
    blocks = [b for b in page.get_text('blocks', sort=True) if b[6] == 0 and b[4].strip()]
    text = '\n'.join(b[4] for b in blocks)
    if text.strip():
        units.append({'text': text, 'page': page.number + 1,
                      'section': 'PDF page ' + str(page.number + 1),
                      'rawLocator': {'type': 'pdf_page', 'page': page.number + 1,
                                     'bbox': [0, 0, page.rect.width, page.rect.height]}})
if not units:
    raise ValueError('No usable text layer; OCR is not enabled')
print(json.dumps({'units': units, 'pageCount': len(doc)}, ensure_ascii=False))
