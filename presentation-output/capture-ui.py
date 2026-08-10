import asyncio, base64, json, os, subprocess, time, urllib.request
from pathlib import Path
import websockets

ROOT = Path(__file__).resolve().parent
CDP = 'http://127.0.0.1:9223/json'
REPO = ROOT.parent

async def shot(ws_url, route, filename, authenticated=False, full_page=False):
    async with websockets.connect(ws_url, max_size=None) as ws:
        seq = 0
        async def call(method, params=None):
            nonlocal seq
            seq += 1
            await ws.send(json.dumps({'id': seq, 'method': method, 'params': params or {}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get('id') == seq:
                    return msg.get('result', {})
        await call('Page.enable')
        await call('Runtime.enable')
        await call('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 900, 'deviceScaleFactor': 1.25, 'mobile': False})
        await call('Page.navigate', {'url': 'http://127.0.0.1:4173/'})
        await asyncio.sleep(2)
        if authenticated:
            await call('Runtime.evaluate', {'expression': "localStorage.setItem('opticart_has_session','1')"})
        else:
            await call('Runtime.evaluate', {'expression': "localStorage.removeItem('opticart_has_session')"})
        await call('Page.navigate', {'url': f'http://127.0.0.1:4173{route}'})
        await asyncio.sleep(5)
        if full_page:
            metrics = await call('Page.getLayoutMetrics')
            size = metrics['contentSize']
            await call('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': int(min(size['height'], 1800)), 'deviceScaleFactor': 1.25, 'mobile': False})
            await asyncio.sleep(1)
        result = await call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': full_page, 'fromSurface': True})
        (ROOT / filename).write_bytes(base64.b64decode(result['data']))

async def main():
    targets = json.load(urllib.request.urlopen(CDP))
    page = next(t for t in targets if t['type'] == 'page')
    ws = page['webSocketDebuggerUrl']
    await shot(ws, '/', 'ui-storefront.png', authenticated=False)
    await shot(ws, '/admin/dashboard', 'ui-admin-dashboard.png', authenticated=True)
    await shot(ws, '/admin/orders', 'ui-orders.png', authenticated=True)
    await shot(ws, '/admin/low-stock', 'ui-low-stock.png', authenticated=True)
    await shot(ws, '/admin/analytics', 'ui-analytics.png', authenticated=True)

if __name__ == '__main__':
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
    env = os.environ.copy()
    env['VITE_API_URL'] = 'http://127.0.0.1:5055/api'
    chrome_profile = ROOT / 'chrome-profile'
    chrome_profile.mkdir(exist_ok=True)
    logs = []
    procs = []
    try:
        mock_log = open(ROOT / 'mock-api.log', 'w', encoding='utf-8'); logs.append(mock_log)
        vite_log = open(ROOT / 'vite.log', 'w', encoding='utf-8'); logs.append(vite_log)
        chrome_log = open(ROOT / 'chrome.log', 'w', encoding='utf-8'); logs.append(chrome_log)
        procs.append(subprocess.Popen(['node', str(ROOT / 'mock-api.mjs')], cwd=REPO, stdout=mock_log, stderr=subprocess.STDOUT, creationflags=flags))
        procs.append(subprocess.Popen(['node', 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], cwd=REPO / 'client', env=env, stdout=vite_log, stderr=subprocess.STDOUT, creationflags=flags))
        for _ in range(40):
            try:
                urllib.request.urlopen('http://127.0.0.1:5055/api/categories', timeout=.5)
                urllib.request.urlopen('http://127.0.0.1:4173/', timeout=.5)
                break
            except Exception:
                time.sleep(.25)
        else:
            raise RuntimeError('Local capture services did not start.')
        chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
        procs.append(subprocess.Popen([
            chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--remote-debugging-port=9223', f'--user-data-dir={chrome_profile}',
            '--no-first-run', '--no-default-browser-check', 'about:blank'
        ], cwd=REPO, stdout=chrome_log, stderr=subprocess.STDOUT, creationflags=flags))
        for _ in range(40):
            try:
                urllib.request.urlopen(CDP, timeout=.5)
                break
            except Exception:
                time.sleep(.25)
        else:
            raise RuntimeError('Chrome debugging endpoint did not start.')
        asyncio.run(main())
    finally:
        for proc in reversed(procs):
            if proc.poll() is None:
                proc.terminate()
        for proc in reversed(procs):
            try: proc.wait(timeout=5)
            except subprocess.TimeoutExpired: proc.kill()
        for log in logs: log.close()
