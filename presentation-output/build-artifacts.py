import html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / 'presentation-data.json').read_text(encoding='utf-8'))

presenter_colors = {'Malik': '#EA580C', 'Mahmod': '#0D9488', 'Haya': '#0369A1'}

def script_paragraphs(text):
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    cut = max(1, (len(sentences) + 1) // 2)
    return [' '.join(sentences[:cut]), ' '.join(sentences[cut:])] if sentences[cut:] else [text]

def fmt_seconds(seconds):
    seconds = round(seconds)
    return f'{seconds // 60}:{seconds % 60:02d}'

totals = {}
for name in presenter_colors:
    slides = [s for s in DATA['slides'] if s['presenter'] == name]
    totals[name] = {
        'words': sum(s['word_count'] for s in slides),
        'seconds': sum(s['estimated_speaking_seconds'] for s in slides),
        'slides': [s['slide_number'] for s in slides]
    }

timeline = ''.join(
    f'''<div class="timeline-segment {name.lower()}" style="flex:{v['seconds']:.1f}" title="{name}: slides {', '.join(map(str,v['slides']))}">
      <span>{name}</span><small>Slides {min(v['slides'])}–{max(v['slides'])} · {fmt_seconds(v['seconds'])}</small>
    </div>''' for name, v in totals.items()
)

cards = []
for s in DATA['slides']:
    paras = ''.join(f'<p>{html.escape(p)}</p>' for p in script_paragraphs(s['script']))
    handoff = '' if not s['handoff'] else f'''<div class="handoff"><span>Handoff</span><strong>{html.escape(s['handoff'])}</strong></div>'''
    visual_refs = ', '.join(html.escape(v['id'].replace('_',' ').title()) for v in s.get('visual_references', [])) or 'Designed presentation graphic'
    cards.append(f'''
    <article class="slide-card" id="slide-{s['slide_number']}" data-presenter="{s['presenter']}" data-index="{s['slide_number']-1}" style="--speaker:{presenter_colors[s['presenter']]}">
      <div class="card-rail"></div>
      <header class="card-head">
        <div class="slide-id"><span>{s['slide_number']:02d}</span><small>SLIDE</small></div>
        <div class="card-title"><span class="speaker"><i>{s['presenter'][0]}</i>{s['presenter']}</span><h2>{html.escape(s['slide_title'])}</h2><p>{html.escape(s['slide_purpose'])}</p></div>
        <div class="duration"><strong>{html.escape(s['estimated_duration_label'])}</strong><small>{s['word_count']} words</small></div>
      </header>
      <div class="card-body">
        <section class="script"><div class="eyebrow">EXACT SCRIPT</div>{paras}</section>
        <aside class="cues">
          <div class="cue"><span>Slide change</span><p>{html.escape(s['slide_change_cue'])}</p></div>
          {handoff}
          <div class="visual"><span>On screen</span><p>{visual_refs}</p></div>
        </aside>
      </div>
    </article>''')

timing_rows = ''.join(
    f'''<div class="timing-row"><span class="dot" style="background:{presenter_colors[name]}"></span><strong>{name}</strong><span>Slides {min(v['slides'])}–{max(v['slides'])}</span><b>{v['words']} words</b><em>{fmt_seconds(v['seconds'])}</em></div>'''
    for name, v in totals.items()
)

data_json = json.dumps(DATA, ensure_ascii=False).replace('</', '<\\/')
html_doc = f'''<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OptiCart Speaker Guide</title>
<style>
:root{{--orange:#EA580C;--orange-dark:#9A3412;--teal:#0D9488;--blue:#0369A1;--radius:18px;--shadow:0 18px 45px rgba(28,25,23,.12)}}
html[data-theme="dark"]{{--bg:#151311;--panel:#201d1a;--panel2:#292522;--text:#fafaf9;--sub:#c9c3bd;--muted:#908983;--line:#3a342f;--soft:#302b27;--chip:#322b25;--hero:#24160f}}
html[data-theme="light"]{{--bg:#f5f5f4;--panel:#fff;--panel2:#fafaf9;--text:#1c1917;--sub:#57534e;--muted:#8b8179;--line:#e7e5e4;--soft:#f0eeec;--chip:#fff7ed;--hero:#fffaf5}}
*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55;transition:.2s background,.2s color}}button{{font:inherit}}.wrap{{width:min(1180px,calc(100% - 32px));margin:auto}}.topbar{{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}}.topbar-inner{{height:64px;display:flex;align-items:center;gap:18px}}.brand{{font-weight:800;font-size:21px;letter-spacing:-.5px}}.brand span{{color:var(--orange)}}.progress-track{{height:3px;background:var(--line)}}#progress{{height:100%;width:0;background:linear-gradient(90deg,var(--orange),var(--teal));transition:width .1s}}.spacer{{flex:1}}.icon-btn,.filter-btn,.timer-btn{{border:1px solid var(--line);color:var(--text);background:var(--panel);border-radius:999px;cursor:pointer}}.icon-btn{{width:38px;height:38px;display:grid;place-items:center}}.hero{{padding:58px 0 32px;background:radial-gradient(circle at 80% 20%,color-mix(in srgb,var(--orange) 16%,transparent),transparent 34%),var(--hero);border-bottom:1px solid var(--line)}}.kicker,.eyebrow{{font-size:11px;font-weight:800;letter-spacing:.12em;color:var(--orange)}}h1{{font-size:clamp(34px,6vw,68px);line-height:1.03;letter-spacing:-.055em;margin:14px 0 18px;max-width:820px}}.hero-copy{{font-size:18px;color:var(--sub);max-width:720px}}.summary-grid{{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:38px}}.metric{{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px}}.metric strong{{display:block;font-size:20px}}.metric span{{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}}.control-panel{{padding:26px 0;border-bottom:1px solid var(--line);background:var(--bg)}}.control-grid{{display:grid;grid-template-columns:1.2fr .8fr;gap:22px;align-items:center}}.timeline{{display:flex;height:76px;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:var(--panel)}}.timeline-segment{{padding:14px 16px;color:white;min-width:110px;display:flex;flex-direction:column;justify-content:center}}.timeline-segment span{{font-weight:800}}.timeline-segment small{{opacity:.78}}.timeline-segment.malik{{background:#b94008}}.timeline-segment.mahmod{{background:#08766d}}.timeline-segment.haya{{background:#075985}}.rehearsal{{display:flex;align-items:center;justify-content:flex-end;gap:10px}}#timer{{font-variant-numeric:tabular-nums;font-weight:800;font-size:28px;min-width:94px}}.timer-btn{{padding:8px 14px}}.filters{{display:flex;gap:8px;align-items:center;padding:24px 0 8px;flex-wrap:wrap}}.filter-btn{{padding:8px 14px}}.filter-btn.active{{background:var(--orange);color:#fff;border-color:var(--orange)}}.hint{{color:var(--muted);font-size:12px;margin-left:auto}}main{{padding-bottom:70px}}.slide-card{{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;margin:18px 0;scroll-margin-top:94px}}.slide-card.current{{outline:2px solid color-mix(in srgb,var(--speaker) 65%,transparent);outline-offset:3px}}.card-rail{{height:5px;background:var(--speaker)}}.card-head{{display:grid;grid-template-columns:72px 1fr 90px;gap:18px;padding:24px 28px;border-bottom:1px solid var(--line)}}.slide-id span{{font-size:30px;font-weight:800;color:var(--speaker);display:block;line-height:1}}.slide-id small,.duration small{{font-size:10px;color:var(--muted);letter-spacing:.12em}}.speaker{{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:var(--speaker);text-transform:uppercase;letter-spacing:.08em}}.speaker i{{font-style:normal;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--speaker)}}.card-title h2{{font-size:27px;line-height:1.18;letter-spacing:-.025em;margin:8px 0 6px}}.card-title>p{{margin:0;color:var(--sub);font-size:14px}}.duration{{text-align:right}}.duration strong{{display:block;font-size:20px}}.card-body{{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(260px,.7fr);gap:0}}.script{{padding:30px 32px 34px}}.script p{{font-size:18px;line-height:1.75;margin:14px 0;color:var(--text)}}.script p:first-of-type::first-letter{{font-size:27px;font-weight:800;color:var(--speaker)}}.cues{{padding:30px;background:var(--panel2);border-left:1px solid var(--line);display:flex;flex-direction:column;gap:14px}}.cue,.handoff,.visual{{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--panel)}}.cue span,.handoff span,.visual span{{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}}.cue p,.visual p{{margin:6px 0 0;color:var(--sub);font-size:13px}}.handoff{{border-color:color-mix(in srgb,var(--speaker) 45%,var(--line));background:color-mix(in srgb,var(--speaker) 8%,var(--panel))}}.handoff strong{{display:block;color:var(--speaker);margin-top:5px}}.timing{{margin-top:34px;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:26px}}.timing h2{{margin:0 0 8px}}.timing-sub{{color:var(--sub);margin:0 0 20px}}.timing-row{{display:grid;grid-template-columns:12px 90px 1fr 90px 65px;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}}.dot{{width:8px;height:8px;border-radius:50%}}.timing-row span,.timing-row b,.timing-row em{{font-size:13px;color:var(--sub);font-style:normal}}.timing-total{{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--line);margin-top:4px;padding-top:18px;font-weight:800}}.footer-note{{color:var(--muted);font-size:12px;margin-top:14px}}.hidden{{display:none!important}}body.large-script .script p{{font-size:23px;line-height:1.78}}body.large-script .card-body{{grid-template-columns:1fr}}body.large-script .cues{{border-left:0;border-top:1px solid var(--line)}}
@media(max-width:850px){{.summary-grid{{grid-template-columns:repeat(2,1fr)}}.control-grid{{grid-template-columns:1fr}}.rehearsal{{justify-content:flex-start}}.card-body{{grid-template-columns:1fr}}.cues{{border-left:0;border-top:1px solid var(--line)}}.hint{{width:100%;margin:6px 0 0}}}}
@media(max-width:560px){{.wrap{{width:min(100% - 20px,1180px)}}.topbar-inner{{gap:9px}}.brand{{font-size:18px}}.summary-grid{{grid-template-columns:repeat(2,1fr)}}.timeline{{height:auto;flex-direction:column}}.timeline-segment{{min-height:66px}}.card-head{{grid-template-columns:54px 1fr;padding:20px}}.duration{{grid-column:2;text-align:left}}.script,.cues{{padding:22px}}.script p{{font-size:17px}}.timing-row{{grid-template-columns:10px 70px 1fr}}.timing-row b,.timing-row em{{display:none}}}}
@media print{{.topbar,.control-panel,.filters{{display:none}}body{{background:#fff;color:#111}}.hero{{padding-top:20px}}.slide-card{{break-inside:avoid;box-shadow:none}}}}
</style>
</head>
<body>
<div class="topbar"><div class="wrap topbar-inner"><div class="brand">Opti<span>Cart</span></div><span style="color:var(--muted);font-size:12px">Speaker Guide</span><div class="spacer"></div><button class="icon-btn" id="large" title="Enlarge script">Aa</button><button class="icon-btn" id="theme" title="Toggle theme">☼</button></div><div class="progress-track"><div id="progress"></div></div></div>
<header class="hero"><div class="wrap"><div class="kicker">PRESENTATION CONTROL CENTER</div><h1>{html.escape(DATA['presentation_title'])}</h1><p class="hero-copy">A synchronized rehearsal guide for Malik, Mahmod, and Haya—built directly from the canonical presentation data.</p><div class="summary-grid"><div class="metric"><strong>{DATA['estimated_total_runtime']}</strong><span>Total runtime</span></div><div class="metric"><strong>{len(DATA['slides'])}</strong><span>Slides</span></div><div class="metric"><strong>{DATA['total_word_count']}</strong><span>Spoken words</span></div><div class="metric"><strong>3</strong><span>Presenters</span></div><div class="metric"><strong>{DATA['speaking_rate_wpm']}</strong><span>Words / minute</span></div><div class="metric"><strong>{DATA['transition_allowance_seconds']} sec</strong><span>Transitions</span></div></div></div></header>
<section class="control-panel"><div class="wrap control-grid"><div class="timeline">{timeline}</div><div class="rehearsal"><span id="timer">0:00</span><button class="timer-btn" id="start">Start</button><button class="timer-btn" id="reset">Reset</button></div></div></section>
<main class="wrap"><nav class="filters"><button class="filter-btn active" data-filter="all">All slides</button><button class="filter-btn" data-filter="Malik">Malik only</button><button class="filter-btn" data-filter="Mahmod">Mahmod only</button><button class="filter-btn" data-filter="Haya">Haya only</button><span class="hint">↑/↓ or J/K moves between scripts</span></nav>{''.join(cards)}
<section class="timing"><div class="eyebrow">TIMING DASHBOARD</div><h2>Balanced, contiguous speaker sections</h2><p class="timing-sub">Spoken timing uses {DATA['speaking_rate_wpm']} words per minute. The full estimate includes {DATA['transition_allowance_seconds']} seconds for slide changes and handoffs.</p>{timing_rows}<div class="timing-total"><span>Total: {DATA['total_word_count']} words</span><span>Spoken {fmt_seconds(DATA['estimated_spoken_seconds'])} + transitions = {DATA['estimated_total_runtime']}</span></div><p class="footer-note">Target window: 3:30–3:50. Hard maximum: 4:00.</p></section>
</main>
<script type="application/json" id="canonical-data">{data_json}</script>
<script>
const root=document.documentElement, cards=[...document.querySelectorAll('.slide-card')];let current=0,timerId=null,startAt=0,elapsed=0;
const requested=new URLSearchParams(location.search).get('theme'),saved=localStorage.getItem('opticart-guide-theme');if(requested)root.dataset.theme=requested;else if(saved)root.dataset.theme=saved;
document.querySelector('#theme').onclick=()=>{{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('opticart-guide-theme',root.dataset.theme)}};
document.querySelector('#large').onclick=()=>document.body.classList.toggle('large-script');
document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{{document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');cards.forEach(c=>c.classList.toggle('hidden',b.dataset.filter!=='all'&&c.dataset.presenter!==b.dataset.filter));current=0;focusCurrent()}});
function focusCurrent(){{const visible=cards.filter(c=>!c.classList.contains('hidden'));if(!visible.length)return;current=Math.max(0,Math.min(current,visible.length-1));cards.forEach(c=>c.classList.remove('current'));visible[current].classList.add('current');visible[current].scrollIntoView({{behavior:'smooth',block:'start'}})}}
addEventListener('keydown',e=>{{if(['ArrowDown','j','J'].includes(e.key)){{e.preventDefault();current++;focusCurrent()}}if(['ArrowUp','k','K'].includes(e.key)){{e.preventDefault();current--;focusCurrent()}}}});
function showTime(ms){{const s=Math.floor(ms/1000);document.querySelector('#timer').textContent=`${{Math.floor(s/60)}}:${{String(s%60).padStart(2,'0')}}`}}
document.querySelector('#start').onclick=()=>{{const btn=document.querySelector('#start');if(timerId){{clearInterval(timerId);timerId=null;elapsed=Date.now()-startAt;btn.textContent='Resume'}}else{{startAt=Date.now()-elapsed;timerId=setInterval(()=>showTime(Date.now()-startAt),250);btn.textContent='Pause'}}}};
document.querySelector('#reset').onclick=()=>{{if(timerId)clearInterval(timerId);timerId=null;elapsed=0;showTime(0);document.querySelector('#start').textContent='Start'}};
addEventListener('scroll',()=>{{const max=document.documentElement.scrollHeight-innerHeight;document.querySelector('#progress').style.width=(max?scrollY/max*100:0)+'%'}});
</script>
</body></html>'''

(ROOT / 'OptiCart-Speaker-Guide.html').write_text(html_doc, encoding='utf-8')
print('Created OptiCart-Speaker-Guide.html')
