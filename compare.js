// 어사이드에 우리 시험지 20문제를 똑같이 시킨다(깃허브 윈도우에서). 2026-10-04 B9
const p = require('puppeteer-core'); const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REPO = process.env.GITHUB_REPOSITORY, TOK = process.env.GH_TOKEN, NONCE = process.env.NONCE; let EMAIL = '';
const crypto = require('crypto'); const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const H = { Authorization: `Bearer ${TOK}`, Accept: 'application/vnd.github+json' };
async function putFile(path, text) { const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { method: 'PUT', headers: H, body: JSON.stringify({ message: 'k', branch: 'xchg', content: Buffer.from(text).toString('base64') }) }); return r.status; }
async function getMsg(name, maxMs) { const end = Date.now() + maxMs; while (Date.now() < end) { const r = await fetch(`https://api.github.com/repos/${REPO}/contents/msg-${NONCE}-${name}.b64?ref=xchg`, { headers: { ...H, Accept: 'application/vnd.github.raw' } });
  if (r.ok) { return crypto.privateDecrypt({ key: privateKey, oaepHash: 'sha256' }, Buffer.from((await r.text()).trim(), 'base64')).toString(); } await sleep(6000); } return ''; }
const mask = (x) => (EMAIL ? String(x).split(EMAIL).join('***') : String(x)).replace(/\b\d{6}\b/g, '######');
const TASKS = JSON.parse(fs.readFileSync('tasks.json', 'utf8')).filter((t) => !process.env.ONLY || process.env.ONLY.split(',').includes(t.id));
const MAXSEC = +(process.env.MAXSEC || 300);
let shot = 0;
async function pageOf(t) { try { return (await t.page()) || (await t.asPage()); } catch { return null; } }
async function mainPage(b) { for (let i = 0; i < 40; i++) { const t = b.targets().find((t) => t.url().includes('/main.html')); if (t) { const pg = await pageOf(t); if (pg) return pg; } await sleep(1000); } throw new Error('no main.html'); }
async function dumpMain(b, tag) { const pg = await mainPage(b); if (!/^(ob|ws|codefail)/.test(tag)) await pg.screenshot({ path: `${tag}-${shot++}.png` }).catch(() => {});
  const txt = await pg.evaluate(() => document.body.innerText.slice(0, 3000)); const el = await pg.evaluate(() => [...document.querySelectorAll('button,a,input,textarea,[contenteditable="true"],[role=textbox]')].slice(0, 80).map((e) => (e.tagName + ':' + (e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.innerText || e.type || '')).replace(/\s+/g, ' ').slice(0, 60)));
  console.log('DUMP', tag, pg.url(), mask(JSON.stringify(txt))); console.log('ELEMS', tag, mask(JSON.stringify(el))); }
async function clickText(pg, re) { return pg.evaluate((src) => { const r = new RegExp(src, 'i'); const e = [...document.querySelectorAll('button,a,[role=button]')].find((x) => r.test((x.innerText || x.getAttribute('aria-label') || '').trim())); if (e) { e.click(); return (e.innerText || e.getAttribute('aria-label')).trim().slice(0, 30); } return ''; }, re); }
// 단추가 아닌 글자(span·div)로 된 «다시 보내기»도 누른다 — 맞는 것 중 가장 작은(안쪽) 요소 (2026-10-04: button 만 찾아 3회 모두 못 누름)
async function clickAny(pg, re) { return pg.evaluate((src) => { const r = new RegExp(src, 'i'); const c = [...document.querySelectorAll('body *')].filter((x) => r.test((x.innerText || '').trim()) && x.offsetParent !== null); c.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length); const e = c[0]; if (e) { e.click(); return (e.tagName + ':' + e.innerText).trim().slice(0, 40); } return ''; }, re); }
async function login(b) {
  console.log('PUBKEY', await putFile(`pub-${NONCE}.pem`, publicKey.export({ type: 'spki', format: 'pem' })));
  EMAIL = await getMsg('email', 5 * 60e3); if (!EMAIL) throw new Error('no email'); console.log('EMAIL_GOT');
  let pg = await mainPage(b); await pg.waitForSelector('input', { timeout: 30000 }); await pg.click('input'); await pg.keyboard.type(EMAIL, { delay: 25 });
  await clickText(pg, '^continue$');
  await pg.waitForFunction(() => /verification code/i.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
  console.log('SIGNUP_SENT', new Date().toISOString()); await dumpMain(b, 'codefail-after-continue').catch(() => {});
  let code = ''; const end = Date.now() + 14 * 60e3, t0 = Date.now(); let resent = 0;
  while (Date.now() < end && !code) {
    if (Date.now() - t0 > (resent + 1) * 240e3 && resent < 2) { const pr = await mainPage(b); console.log('RESEND', ++resent, (await clickText(pr, '^resend')) || (await clickAny(pr, '^resend'))); } code = await getMsg('code', 20e3); }
  console.log('CODE_GOT', code ? 'yes' : 'none'); if (!code) throw new Error('no code');
  pg = await mainPage(b); const ins = await pg.$$('input[placeholder*="erification" i], input[aria-label*="code" i], input'); await ins[0].click({ clickCount: 3 }); await pg.keyboard.type(code, { delay: 40 }); await pg.keyboard.press('Enter'); await clickText(pg, '^continue$');
  await sleep(12000);
  { const pg2 = await mainPage(b); const st = await pg2.evaluate(() => document.body.innerText.slice(0, 300)); if (/verification code/i.test(st)) { await dumpMain(b, 'codefail'); throw new Error('code not accepted'); } }
  for (let i = 0; i < 14; i++) { pg = await mainPage(b); if (!pg.url().includes('/onboarding')) break;
    let pick = '';
    if (pg.url().includes('/onboarding/ai')) { pick = await pg.evaluate(() => { const r = document.querySelector('input[type=radio]'); if (!r) return ''; (r.closest('label') || r.parentElement || r).click(); if (!r.checked) r.click(); return 'radio1 ' + r.checked; }).catch((e) => 'err ' + e);
      if (!/true/.test(pick)) { const h = await pg.$('input[type=radio]'); if (h) { const box = await h.boundingBox(); if (box) await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2); else { const lb = await h.evaluateHandle((e) => e.closest('label') || e.parentElement); await lb.asElement()?.click().catch(() => {}); } pick += ' mouse ' + await h.evaluate((e) => e.checked); } }
      await sleep(1500); }
    if (pg.url().includes('/onboarding/ai') && i >= 3) {
      if (!pg.__hooked) { pg.__hooked = 1; pg.on('console', (m) => console.log('CONSOLE', m.type(), mask(m.text()).slice(0, 300))); pg.on('response', (r) => { if (r.status() >= 400) console.log('NETERR', r.status(), r.url().replace(/[?#].*/, '').slice(0, 120)); }); pg.on('requestfailed', (r) => console.log('NETFAIL', r.url().replace(/[?#].*/, '').slice(0, 120), r.failure()?.errorText)); }
      const lab = await pg.evaluateHandle(() => { const r = document.querySelector('input[type=radio]'); return r && (r.closest('label') || r.parentElement); });
      const lb = lab.asElement(); if (lb) { const bx = await lb.boundingBox(); if (bx) await pg.mouse.click(bx.x + 20, bx.y + bx.height / 2); }
      await sleep(800);
      const cb = await pg.evaluateHandle(() => [...document.querySelectorAll('button')].find((x) => /^connect$/i.test(x.innerText.trim())));
      const ce = cb.asElement(); const dis = ce ? await ce.evaluate((e) => e.disabled + ' ' + e.getAttribute('aria-disabled')) : 'none';
      if (ce) { const bx = await ce.boundingBox(); if (bx) await pg.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); }
      console.log('ONBOARD-MOUSE', i, 'connect', dis); await sleep(6000);
      if (i === 4) { await clickText(pg, '^show more options$'); await sleep(2500); await dumpMain(b, 'ob-more'); const rs = await pg.evaluate(() => [...document.querySelectorAll('input[type=radio]')].map((r) => (r.closest('label') || r.parentElement).innerText.replace(/\s+/g, ' ').slice(0, 80))); console.log('ONBOARD-OPTS', JSON.stringify(rs)); }
      if (!pg.url().includes('/onboarding/ai')) continue;
    }
    const c = await clickText(pg, '^(connect|skip|next|continue|done|get started|start|maybe later|not now|finish|got it|allow|start using aside|let.s go|start for free|continue with free|use free plan|free)$'); console.log('ONBOARD', i, pg.url().split('#')[1], pick, c); if (!c) { await dumpMain(b, 'ob'); break; }
    if (i >= 3 && pg.url().includes('/onboarding/ai')) { await sleep(3000); console.log('TABS', i, JSON.stringify(b.targets().filter((t) => ['page','other'].includes(t.type())).map((t) => t.type() + ' ' + t.url().replace(/[?#].*/, '').slice(0, 90))));
      for (const t of b.targets()) { if (t.type() === 'page' && !t.url().startsWith('chrome-extension://fjdh') && !/^(about|chrome):/.test(t.url())) { const p2 = await t.page().catch(() => null); if (p2) console.log('PAGE', i, p2.url().replace(/[?#].*/, '').slice(0, 90), JSON.stringify(mask(await p2.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '')))); } }
      if (i >= 5) break; }
    await sleep(5000); }
  await dumpMain(b, 'ws');
}
async function askBox(pg) { return pg.evaluateHandle(() => { const c = [...document.querySelectorAll('textarea,[contenteditable="true"],[role=textbox],input[type=text]')].filter((e) => e.offsetParent !== null);
  return c.find((e) => /ask|message|anything|무엇|질문/i.test((e.getAttribute('placeholder') || e.getAttribute('aria-label') || e.getAttribute('data-placeholder') || ''))) || c[c.length - 1] || null; }); }
async function runTask(b, t) {
  for (const x of b.targets()) if (x.type() === 'page' && !x.url().startsWith('chrome')) { const pg = await pageOf(x); await pg?.close().catch(() => {}); }
  const tab = await b.newPage(); await tab.goto(t.start, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}); await sleep(2000);
  let pg = await mainPage(b); await clickText(pg, '^new chat$'); await sleep(2500); pg = await mainPage(b);
  const box = await askBox(pg); if (!box || !(await box.asElement())) { await dumpMain(b, 'nobox-' + t.id); return { id: t.id, kind: t.kind, status: 'nobox', answer: '', url: '', sec: 0, steps: 0, asks: 0, cost: 0 }; }
  const before = await pg.evaluate(() => document.body.innerText.length);
  await box.asElement().click(); await pg.keyboard.type(`${t.goal}\n(지금 열린 탭: ${t.start})`.replace('\n', ' '), { delay: 5 }); await pg.keyboard.press('Enter');
  const t0 = Date.now(); let last = '', same = 0, txt = '';
  while ((Date.now() - t0) / 1000 < MAXSEC) { await sleep(5000); pg = await mainPage(b);
    txt = await pg.evaluate(() => document.body.innerText); const busy = await pg.evaluate(() => [...document.querySelectorAll('button,[role=button]')].some((e) => /^(stop|cancel|중지)$/i.test((e.getAttribute('aria-label') || e.innerText || '').trim())) || /Working for/i.test(document.body.innerText.slice(0, 4000)));
    if (txt === last && !busy) { if (++same >= 4) break; } else same = 0; last = txt; }
  const sec = Math.round((Date.now() - t0) / 1000);
  const k = txt.lastIndexOf(t.goal.slice(0, 12)); const answer = mask((k >= 0 ? txt.slice(k + t.goal.length) : txt.slice(before)).slice(0, 1500));
  const urls = b.targets().filter((x) => x.type() === 'page' && !x.url().startsWith('chrome')).map((x) => x.url());
  let jsok = null; if (t.check.js) { for (const x of b.targets()) { if (x.type() !== 'page' || x.url().startsWith('chrome')) continue; const pg2 = await pageOf(x); try { if (await pg2.evaluate(t.check.js)) jsok = true; } catch {} } if (jsok === null) jsok = false; }
  let url = urls.find((u) => t.check.url && new RegExp(t.check.url).test(u)) || urls[urls.length - 1] || '';
  await pg.screenshot({ path: `task-${t.id}.png` }).catch(() => {});
  const asks = /할까요|하시겠|shall i|should i|would you like|confirm/i.test(answer.slice(-400)) ? 1 : 0;
  let ok = !!answer.trim() && (Date.now() - t0) / 1000 < MAXSEC; if (t.check.url && !new RegExp(t.check.url).test(url)) ok = false; if (t.check.answer && !new RegExp(t.check.answer).test(answer)) ok = false; if (t.check.js) ok = jsok;
  return { id: t.id, kind: t.kind, status: ok ? 'done' : 'fail', ok, answer: answer.replace(/\s+/g, ' ').trim(), url, urls, sec, steps: 0, asks, cost: 0 };
}
(async () => {
  const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  await login(b); const R = [];
  for (const t of TASKS) { let r; try { r = await runTask(b, t); } catch (e) { r = { id: t.id, kind: t.kind, status: 'error', ok: false, answer: String(e).slice(0, 200), url: '', sec: 0, asks: 0, cost: 0 }; }
    R.push(r); console.log('RESULT', mask(JSON.stringify({ ...r, urls: undefined, answer: r.answer.slice(0, 300) }))); fs.writeFileSync('result-aside.json', JSON.stringify(R, null, 1)); }
  const s = (k) => R.filter((r) => r.ok && (!k || r.kind === k)).length;
  console.log('SCORE', JSON.stringify({ done: s(), of: R.length, company: s('회사'), general: s('일반'), asks: R.reduce((a, r) => a + r.asks, 0), sec: R.reduce((a, r) => a + r.sec, 0) }));
  await dumpMain(b, 'end'); b.disconnect();
})().catch((e) => { console.log('FAIL', mask(String(e))); process.exit(1); });
