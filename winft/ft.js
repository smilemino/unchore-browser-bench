// 윈도 첫 탭 시험: node ft.js <label> <profileDir> <launches> [nocdpFirst]
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const p = require('puppeteer-core');
const EXE = process.env.EXE;
const [label, PROF, N, mode] = [process.argv[2], process.argv[3], +process.argv[4], process.argv[5] || ''];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ID = 'opifjjladhiahefopcfmlebppocldhjh';
function shot(name) {
  try { execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File shot.ps1 shots\\${name}`, { stdio: 'ignore', timeout: 20000 }); } catch (e) {}
}
function running() { try { return /chrome\.exe/i.test(execSync('tasklist /FI "IMAGENAME eq chrome.exe"').toString()); } catch (e) { return false; } }
async function waitGone() { for (let k = 0; k < 40 && running(); k++) await sleep(500); if (running()) { try { execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' }); } catch (e) {} await sleep(2000); return 'forced'; } return 'clean'; }
async function once(i) {
  const cdp = !(mode.includes('nocdp') && i === 0) && !mode.includes('allnocdp');
  const args = ['--user-data-dir=' + PROF, '--lang=ko', '--window-size=1280,800'];
  if (cdp) args.push('--remote-debugging-port=9222');
  if (i > 0 || mode.includes('nofirstrun')) args.push('--no-first-run');
  spawn(EXE, args, { detached: true, stdio: 'ignore' }).unref();
  const res = { label, i, cdp };
  if (cdp) {
    // 켜진 뒤 0~15초 동안 1초마다 탭·워커 상태를 본다(attach 없이 /json/list 만)
    res.timeline = [];
    for (let s = 0; s < 15; s++) {
      await sleep(1000);
      try {
        const l = await (await fetch('http://127.0.0.1:9222/json/list')).json();
        res.timeline.push(s + 1 + 's ' + l.filter((t) => t.type === 'page' || (t.type === 'service_worker' && t.url.includes(ID))).map((t) => (t.type === 'page' ? 'P:' + t.url.replace('chrome-extension://' + ID, 'EXT') + '|' + t.title : 'SW')).join(' ; '));
      } catch (e) { res.timeline.push(s + 1 + 's no-cdp'); }
    }
  } else await sleep(15000);
  shot(`${label}-${i}.png`);
  if (cdp) {
    try {
      const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
      res.pages = [];
      for (const t of b.targets().filter((t) => t.type() === 'page')) {
        try { const pg = await t.page(); res.pages.push(await pg.evaluate(() => ({ href: location.href, title: document.title, h1: ((document.querySelector('h1') || {}).innerText || '').slice(0, 40) }))); } catch (e) { res.pages.push({ url: t.url(), err: String(e).slice(0, 80) }); }
      }
      const sw = b.targets().find((t) => t.type() === 'service_worker' && t.url().includes(ID));
      res.sw = !!sw;
      if (sw) {
        const w = await sw.worker();
        res.ftlog = await w.evaluate(() => chrome.storage.local.get('ftlog').then((x) => x.ftlog || []));
        await w.evaluate(() => chrome.storage.local.remove('ftlog'));
        res.firsttabLoaded = await w.evaluate(() => typeof self.ucFixFirstTabs);
      }
      res.ok = res.pages.length > 0 && /맡겨/.test(res.pages[0].h1 || '');
      res.okAny = res.pages.some((x) => /맡겨/.test(x.h1 || ''));
      await b.close().catch(() => {});
    } catch (e) { res.err = String(e).slice(0, 200); try { execSync('taskkill /IM chrome.exe', { stdio: 'ignore' }); } catch (_) {} }
  } else { try { execSync('taskkill /IM chrome.exe', { stdio: 'ignore' }); } catch (_) {} }
  res.close = await waitGone();
  await sleep(1500);
  console.log('FTRES ' + JSON.stringify(res));
  return res;
}
(async () => {
  fs.mkdirSync('shots', { recursive: true });
  let ok = 0, n = 0;
  for (let i = 0; i < N; i++) { const r = await once(i); if (r.cdp) { n++; if (r.ok) ok++; } }
  console.log(`FTSUM ${label} first-tab-unchore ${ok}/${n}`);
})();
