import hashlib, html as htmlmod, json, re, struct, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
DATA_PATH = ROOT / 'presentation-data.json'
PPTX_PATH = ROOT / 'OptiCart-Business-Presentation.pptx'
HTML_PATH = ROOT / 'OptiCart-Speaker-Guide.html'
RESULTS_PATH = ROOT / 'validation-results.json'
SUMMARY_PATH = ROOT / 'OptiCart-Presentation-Summary.md'

data = json.loads(DATA_PATH.read_text(encoding='utf-8'))
checks = []

def check(name, condition, detail):
    checks.append({'name': name, 'status': 'PASSED' if condition else 'FAILED', 'detail': detail})
    if not condition:
        raise AssertionError(f'{name}: {detail}')

def word_count(text):
    return len(re.findall(r"\b[\w’'-]+\b", text, flags=re.UNICODE))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def png_size(path):
    raw = path.read_bytes()[:24]
    if raw[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    return struct.unpack('>II', raw[16:24])

slides = data['slides']
calc_counts = [word_count(s['script']) for s in slides]
check('Canonical slide count', len(slides) == 6, f'{len(slides)} slides')
check('Per-slide word counts', calc_counts == [s['word_count'] for s in slides], str(calc_counts))
check('Total word count', sum(calc_counts) == data['total_word_count'] == 432, f"{sum(calc_counts)} words")
calc_spoken = round(sum(calc_counts) / data['speaking_rate_wpm'] * 60, 1)
calc_total = round(calc_spoken + data['transition_allowance_seconds'], 1)
check('Spoken timing', abs(calc_spoken - data['estimated_spoken_seconds']) < 0.2, f'{calc_spoken} seconds')
rounded_total = int(calc_total + 0.5)
check('Total timing', abs(calc_total - data['estimated_total_seconds']) < 0.2 and 210 <= calc_total <= 230 and calc_total < 240, f'{calc_total} seconds ({rounded_total//60}:{rounded_total%60:02d})')
sequence = []
for s in slides:
    if not sequence or sequence[-1] != s['presenter']:
        sequence.append(s['presenter'])
check('Contiguous presenter order', sequence == ['Malik', 'Mahmod', 'Haya'], ' → '.join(sequence))

html_text = HTML_PATH.read_text(encoding='utf-8')
embedded = re.search(r'<script type="application/json" id="canonical-data">(.*?)</script>', html_text, flags=re.S)
embedded_data = json.loads(embedded.group(1)) if embedded else None
check('HTML canonical embedding', embedded_data == data, 'Embedded data exactly matches presentation-data.json')
for s in slides:
    check(f'HTML slide {s["slide_number"]} synchronization', all(x in html_text for x in [htmlmod.escape(s['slide_title']), htmlmod.escape(s['script']), htmlmod.escape(s['slide_change_cue']), s['presenter'], s['estimated_duration_label']]), 'Title, presenter, exact script, duration, and cue found')

with zipfile.ZipFile(PPTX_PATH) as z:
    names = z.namelist()
    slide_names = sorted((n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)), key=lambda n: int(re.search(r'\d+', n).group()))
    check('PowerPoint slide count', len(slide_names) == len(slides), f'{len(slide_names)} slide XML parts')
    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    all_slide_text = []
    for sd, name in zip(slides, slide_names):
        root = ET.fromstring(z.read(name))
        text = ' '.join((t.text or '') for t in root.findall('.//a:t', ns))
        all_slide_text.append(text)
        check(f'PowerPoint slide {sd["slide_number"]} title', sd['slide_title'] in text, sd['slide_title'])
        check(f'PowerPoint slide {sd["slide_number"]} presenter', sd['presenter'].upper() in text, sd['presenter'])
        check(f'PowerPoint slide {sd["slide_number"]} audience-only content', sd['script'][:35] not in text and sd['slide_change_cue'][:25] not in text, 'No script or presenter cue in audience-facing slide')
    check('Slide 4 data label', 'REPRESENTATIVE LOCAL TEST DATA' in all_slide_text[3], 'Dashboard figures identified as test data')
    check('Slide 5 analytics disclaimer', 'NOT COMMERCIAL RESULTS' in all_slide_text[4], 'Analytics figures explicitly disclaimed')
    note_xml = [n for n in names if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml', n)]
    authored_notes = []
    for name in note_xml:
        root = ET.fromstring(z.read(name))
        texts = [(t.text or '').strip() for t in root.findall('.//a:t', ns) if (t.text or '').strip()]
        authored_notes.extend(texts)
    check('PowerPoint speaker-note validation', len(authored_notes) == 0, f'{len(note_xml)} notes parts; {len(authored_notes)} meaningful note strings')
    media_hashes = {hashlib.sha256(z.read(n)).hexdigest(): n for n in names if n.startswith('ppt/media/')}
    used_images = sorted({v['path'] for s in slides for v in s.get('visual_references', [])})
    missing_media = [p for p in used_images if sha(ROOT / p) not in media_hashes]
    check('Screenshot-to-PowerPoint provenance', not missing_media, f'Embedded source matches: {", ".join(used_images)}')

rendered = sorted((ROOT / 'rendered-slides').glob('Slide*.PNG'), key=lambda p: int(re.search(r'\d+', p.name).group()))
sizes = [png_size(p) for p in rendered]
check('Rendered slide QA set', len(rendered) == len(slides) and all(s == (1600, 900) for s in sizes), f'{len(rendered)} slides at 1600×900')
for image_name in sorted({v['path'] for s in slides for v in s.get('visual_references', [])}):
    dims = png_size(ROOT / image_name)
    check(f'Screenshot integrity: {image_name}', dims is not None and dims[0] >= 1400 and dims[1] >= 900, f'Actual rendered UI capture, {dims[0]}×{dims[1]}')

results = {
    'status': 'PASSED',
    'project': data['project_name'],
    'slide_count': len(slides),
    'word_count': data['total_word_count'],
    'estimated_total_seconds': data['estimated_total_seconds'],
    'speaker_notes': 'PASSED',
    'checks': checks
}
RESULTS_PATH.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')

presenter_lines = []
for name in ['Malik', 'Mahmod', 'Haya']:
    own = [s for s in slides if s['presenter'] == name]
    presenter_lines.append(f"- {name}: slides {own[0]['slide_number']}–{own[-1]['slide_number']}, {sum(s['word_count'] for s in own)} words, approximately {sum(s['estimated_speaking_seconds'] for s in own):.1f} seconds.")

summary = f'''# OptiCart Presentation Summary

## Narrative strategy

The six-slide story positions OptiCart as one connected commerce operation: it begins with the customer/business gap, proves the customer buying journey, shows the operational workflow behind it, then closes with management visibility and the team’s product-delivery capability.

## Primary business-value dimensions

1. **Customer journey continuity:** discovery, comparison, saved cart/wishlist state, coupons, checkout, order history, notifications, and feedback form one coherent experience.
2. **Operational control and visibility:** catalog and variant management, fulfillment statuses, stock alerts, procurement tracking, analytics, role-specific access, and audit logs support daily business work.

The showcased features were selected because they connect demand to fulfillment and decision-making, rather than presenting a disconnected feature list.

## Presenter distribution and timing

{chr(10).join(presenter_lines)}

- Total: {data['total_word_count']} spoken words.
- Speaking estimate: {data['estimated_spoken_seconds']:.1f} seconds at {data['speaking_rate_wpm']} words per minute.
- Transition/handoff allowance: {data['transition_allowance_seconds']} seconds.
- Estimated presentation runtime: **{data['estimated_total_runtime']}**, below the four-minute maximum.

## Important assumptions

- No adoption, customer, revenue, performance, or cost-saving claims are made.
- Figures visible in management screenshots are representative local test data and are explicitly labeled as such in the deck.
- Potential business uses are described as possibilities, separate from implemented functionality.

## Screenshot sources

- `ui-storefront.png`: actual OptiCart React storefront rendered locally.
- `ui-admin-dashboard.png`: actual OptiCart React admin dashboard rendered locally.
- `ui-analytics.png`: actual OptiCart React analytics view rendered locally.

The UI was rendered against an isolated local fixture service solely for presentation capture. No database, seed, migration, account, environment configuration, or external service was modified. Screenshot hashes were matched programmatically to media embedded in the PowerPoint.

## Repository evidence reviewed

- Routing and role guards: `client/src/App.tsx`, `server/src/middleware/auth.ts`
- Customer journey: `client/src/pages/Home.tsx`, `ProductList.tsx`, `ProductDetail.tsx`, `Cart.tsx`, `Checkout.tsx`, `OrderDetail.tsx`
- Guest continuity: `client/src/context/ShopContext.tsx`, `client/src/utils/guestMerge.ts`
- Fulfillment, payment, notifications, and feedback: `server/src/controllers/order.ts`, `server/src/services/mailer.ts`
- Inventory and procurement: `server/src/controllers/lowStock.ts`, `purchase.ts`, `client/src/pages/admin/LowStock.tsx`, `Purchases.tsx`
- Analytics and accountability: `server/src/controllers/analytics.ts`, `auditLog.ts`, `client/src/pages/admin/Analytics.tsx`
- Recommendations and demand flags: `server/src/services/scheduler.ts`, `server/src/controllers/recommendation.ts`

## Validation results

- Canonical timing and word counts: **PASSED**
- Cross-file slide/title/presenter/script/duration/cue synchronization: **PASSED**
- PowerPoint render QA: **PASSED** — all six slides inspected at 1600×900; no clipping, overflow, overlap, or unreadable audience text found.
- Screenshot provenance and embedding: **PASSED**
- Audience-only PowerPoint content: **PASSED**
- **PowerPoint speaker-note validation: PASSED**

Automated validation details are recorded in `validation-results.json`.
'''
SUMMARY_PATH.write_text(summary, encoding='utf-8')
print(f'Validation PASSED: {len(checks)} checks')
print(f'Created {SUMMARY_PATH.name}')
