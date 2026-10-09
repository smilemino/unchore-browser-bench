// 윈도우 정식 구글 크롬에 Unchore 확장 넣기 시험 — ① 주소창 기본 검색·확인 창 ② 노란 띠 ③ 탭 4개 동시
const p = require('puppeteer-core');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs'); const crypto = require('crypto');
const EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = 'C:\\ext\\unchore-assistant';
const OUT = 'C:\\out';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const ps = (f, ...a) => { try { return execFileSync('pwsh', ['-NoProfile', '-File', 'C:\\w\\' + f, ...a], { encoding: 'utf8', timeout: 90000 }).trim(); } catch (e) { return 'PSERR ' + String(e.message).slice(0, 200); } };
const shot = (n) => { log('CHK_SHOT', n, ps('shot.ps1', n).replace(/\s+/g, ' ')); log('CHK_UIA', n, ps('uia.ps1', n).replace(/\s+/g, ' ').slice(0, 1500)); };
function idForPath(path) { const h = crypto.createHash('sha256').update(Buffer.from(path, 'utf16le')).digest().slice(0, 16).toString('hex'); return [...h].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join(''); }
const BASE = ['--no-first-run', '--lang=ko'];

async function deepText(pg) {
  return pg.evaluate(() => { let s = ''; const w = (x) => { if (x.shadowRoot) w(x.shadowRoot); for (const c of x.childNodes || []) { if (c.nodeType === 3) s += c.textContent + ' '; else w(c); } }; w(document.documentElement); return s.replace(/\s+/g, ' '); });
}
async function extPage(b, id) {
  // 확장 화면 하나를 열어 chrome.* 를 쓴다(서비스 워커가 잠들어 있어도 됨)
  const pg = await b.newPage();
  try { await pg.goto('chrome-extension://' + id + '/panel.html', { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch (e) { log('CHK_EXTPAGE_ERR', String(e).slice(0, 150)); }
  let ok = false; try { ok = await pg.evaluate(() => !!(window.chrome && chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().name)); } catch (_) {}
  if (ok) log('CHK_EXT_ALIVE', await pg.evaluate(() => chrome.runtime.getManifest().name + ' ' + chrome.runtime.getManifest().version + ' id=' + chrome.runtime.id));
  return ok ? pg : null;
}
function prefs(ud, label, id) {
  const r = { label, id };
  for (const f of ['Preferences', 'Secure Preferences']) {
    try {
      const j = JSON.parse(fs.readFileSync(ud + '\\Default\\' + f, 'utf8'));
      const s = (j.extensions && j.extensions.settings) || {};
      const mine = {}; for (const [k, v] of Object.entries(s)) { if (k === id || (v.path && /unchore/i.test(v.path))) mine[k] = v; }
      r[f] = { default_search_provider: j.default_search_provider, default_search_provider_data: j.default_search_provider_data, ext: mine, ext_count: Object.keys(s).length,
        mac_dsp: j.protection && j.protection.macs ? JSON.stringify(j.protection.macs.default_search_provider_data || j.protection.macs.default_search_provider || null) : null,
        mac_ext: j.protection && j.protection.macs && j.protection.macs.extensions ? Object.keys((j.protection.macs.extensions.settings) || {}) : null,
        developer_mode: j.extensions && j.extensions.ui ? j.extensions.ui.developer_mode : undefined };
    } catch (e) { r[f] = 'ERR ' + String(e).slice(0, 120); }
  }
  fs.writeFileSync(OUT + '\\prefs_' + label + '.json', JSON.stringify(r, null, 1));
  for (const f of ['Preferences', 'Secure Preferences']) { const x = r[f]; if (typeof x === 'string') { log('CHK_PREFS', label, f, x); continue; }
    const e = Object.values(x.ext)[0] || {}; log('CHK_PREFS', label, f, 'dsp=' + JSON.stringify(x.default_search_provider || null).slice(0, 200), 'dsp_data=' + JSON.stringify(x.default_search_provider_data || null).slice(0, 200), 'ext=' + JSON.stringify({ n: Object.keys(x.ext).length, state: e.state, disable_reasons: e.disable_reasons, location: e.location, from_webstore: e.from_webstore, path: e.path, has_overrides: !!(e.manifest && e.manifest.chrome_settings_overrides) })); }
  return r;
}
async function measure(b, label, ud, id, withDebugger) {
  await sleep(6000);
  shot(label + '_start');
  // ① 주소창
  try { const pages0 = await b.pages(); await pages0[0].bringToFront(); } catch (_) {}
  log('CHK_KEYS', label, ps('keys.ps1', 'weather seoul').replace(/\s+/g, ' '));
  await sleep(7000);
  const urls = []; for (const t of b.targets()) if (t.type() === 'page') urls.push(t.url());
  log('CHK_OMNIBOX', label, JSON.stringify(urls));
  shot(label + '_omnibox');
  await sleep(2000); shot(label + '_omnibox2');
  // 설정 › 검색엔진
  try {
    const sp = await b.newPage(); await sp.goto('chrome://settings/search', { waitUntil: 'domcontentloaded' }); await sleep(3500);
    log('CHK_SETTINGS_SEARCH', label, (await deepText(sp)).slice(0, 700));
    await sp.screenshot({ path: OUT + '\\' + label + '_settings_search_page.png' });
    shot(label + '_settings_search');
    const ep = await b.newPage(); await ep.goto('chrome://extensions', { waitUntil: 'domcontentloaded' }); await sleep(3000);
    log('CHK_EXTENSIONS_PAGE', label, (await deepText(ep)).slice(0, 900));
    await ep.screenshot({ path: OUT + '\\' + label + '_extensions_page.png' });
    await ep.close();
  } catch (e) { log('CHK_SETTINGS_ERR', label, String(e).slice(0, 200)); }
  if (withDebugger) {
    const xp = await extPage(b, id);
    if (!xp) { log('CHK_DEBUGGER', label, 'skip — 확장 화면이 안 열림(확장이 안 켜짐)'); }
    else {
      // ② 노란 띠: 탭 하나에 chrome.debugger.attach
      const t1 = await b.newPage(); await t1.goto('https://example.com/?bar=1', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await t1.bringToFront(); await sleep(1500); shot(label + '_before_attach');
      const a1 = await xp.evaluate(async () => { const [t] = await chrome.tabs.query({ url: 'https://example.com/?bar=1' }); try { await chrome.debugger.attach({ tabId: t.id }, '1.3'); return 'attached ' + t.id; } catch (e) { return 'ERR ' + e.message; } });
      log('CHK_ATTACH1', label, a1);
      await t1.bringToFront(); await sleep(3000); shot(label + '_yellow_bar');
      // ③ 탭 4개 동시
      for (let i = 1; i <= 4; i++) { const pg = await b.newPage(); await pg.goto('https://example.com/?multi=' + i, { waitUntil: 'domcontentloaded' }).catch(() => {}); }
      const r = await xp.evaluate(async () => {
        const tabs = (await chrome.tabs.query({})).filter((t) => /multi=/.test(t.url || '')); const ids = tabs.map((t) => t.id).slice(0, 4);
        const T0 = performance.now();
        const att = await Promise.all(ids.map((id) => chrome.debugger.attach({ tabId: id }, '1.3').then(() => 'ok', (e) => 'ERR ' + e.message)));
        const T1 = performance.now();
        const ev = await Promise.all(ids.map((id, i) => chrome.debugger.sendCommand({ tabId: id }, 'Runtime.evaluate', { expression: `(async()=>{const s=Date.now();const inp=document.createElement('input');inp.id='uc';inp.style.cssText='font-size:28px;width:500px';document.body.prepend(inp);inp.value='tab ${i + 1} filled at '+new Date().toISOString().slice(11,23);await new Promise(r=>setTimeout(r,3000));return JSON.stringify({start:s,end:Date.now(),val:inp.value})})()`, awaitPromise: true, returnByValue: true }).then((x) => x.result.value, (e) => 'ERR ' + e.message)));
        const T2 = performance.now();
        const typed = await Promise.all(ids.map((id, i) => chrome.debugger.sendCommand({ tabId: id }, 'Runtime.evaluate', { expression: 'document.getElementById("uc").focus();true' }).then(() => chrome.debugger.sendCommand({ tabId: id }, 'Input.insertText', { text: ' +typed' + (i + 1) })).then(() => chrome.debugger.sendCommand({ tabId: id }, 'Runtime.evaluate', { expression: 'document.getElementById("uc").value', returnByValue: true })).then((x) => x.result.value, (e) => 'ERR ' + e.message)));
        const T3 = performance.now();
        return { ids, att, attachMs: Math.round(T1 - T0), evalMs: Math.round(T2 - T1), typeMs: Math.round(T3 - T2), ev, typed };
      });
      log('CHK_MULTI', label, JSON.stringify(r));
      await sleep(1500); shot(label + '_multi_bar');
      try { const pages = await b.pages(); await pages[pages.length - 1].bringToFront(); await sleep(1500); shot(label + '_multi_bar_tab4'); } catch (_) {}
      const d = await xp.evaluate(async () => { const ts = await chrome.debugger.getTargets(); let n = 0; for (const t of ts) if (t.attached && t.tabId) { try { await chrome.debugger.detach({ tabId: t.tabId }); n++; } catch (_) {} } return n; });
      log('CHK_DETACH', label, d);
      await sleep(2000); shot(label + '_after_detach');
    }
  }
}
async function closeAll(b) { try { await b.close(); } catch (e) { log('CHK_CLOSE_ERR', String(e).slice(0, 100)); } await sleep(5000); try { execFileSync('taskkill', ['/F', '/IM', 'chrome.exe']); } catch (_) {} await sleep(2000); }
async function launchPort(ud, port, extra) {
  spawn(EXE, ['--user-data-dir=' + ud, '--remote-debugging-port=' + port, ...BASE, ...extra], { detached: true, stdio: 'ignore' }).unref();
  for (let k = 0; k < 30; k++) { await sleep(1000); try { return await p.connect({ browserURL: 'http://127.0.0.1:' + port, defaultViewport: null }); } catch (_) {} }
  throw new Error('connect fail ' + port);
}
async function hasExt(b, id) { const pg = await extPage(b, id); if (pg) { await pg.close(); return true; } return false; }

async function devModeAndLoad(b) {
  const ep = await b.newPage(); await ep.goto('chrome://extensions', { waitUntil: 'domcontentloaded' }); await sleep(3000);
  await ep.bringToFront(); shot('C_ext_page_before');
  const dm = await ep.evaluate(() => { const t = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot; const d = t.querySelector('#devMode'); const was = d.checked; if (!was) d.click(); return 'devMode was=' + was; });
  log('CHK_C_DEVMODE', dm); await sleep(2000); shot('C_devmode_on');
  // 파일 고르기 창은 화면을 막으므로 누르기만 하고 기다리지 않는다
  ep.evaluate(() => { const t = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot; t.querySelector('#loadUnpacked').click(); return 1; }).catch(() => {});
  await sleep(4000);
  log('CHK_C_PICK', ps('pick.ps1', EXT).replace(/\s+/g, ' '));
  await sleep(5000); shot('C_after_load');
  log('CHK_C_EXTPAGE_TEXT', (await deepText(ep).catch((e) => 'ERR ' + e)).replace(/html \{.*?\}/g, '').slice(-900));
  await ep.close().catch(() => {});
}
(async () => {
  const id = idForPath(EXT); log('CHK_EXPECTED_ID', id);
  const ud = 'C:\\pC';
  let b = await launchPort(ud, 9231, []); log('CHK_VERSION', await b.version());
  await devModeAndLoad(b);
  const ok = await hasExt(b, id); log('CHK_METHOD_C', ok ? '됨' : '안 됨');
  if (!ok) { shot('C_fail'); await closeAll(b); prefs(ud, 'C_fail', id); log('CHK_END'); return; }
  await measure(b, 'C_run1', ud, id, true); await closeAll(b); prefs(ud, 'C_run1', id);
  b = await launchPort(ud, 9232, []); log('CHK_C_RUN2_EXT_KEPT', await hasExt(b, id)); await measure(b, 'C_run2', ud, id, false); await closeAll(b); prefs(ud, 'C_run2', id);
  b = await launchPort(ud, 9233, []); log('CHK_C_RUN3_EXT_KEPT', await hasExt(b, id)); await measure(b, 'C_run3', ud, id, false); await closeAll(b); prefs(ud, 'C_run3', id);
  log('CHK_END');
})().catch((e) => { console.log('FAIL', e); process.exit(1); });
