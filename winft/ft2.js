// 윈도 첫 탭 시험 2판: CDP 없이 켜고, 확장 저장소(leveldb) 안의 FINREC 기록으로 판정한다.
// node ft2.js <label> <userDataDir|default> <launches> <exe|lnk> [restore] [firstrun]
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const EXE = process.env.EXE;
const ID = 'opifjjladhiahefopcfmlebppocldhjh';
const [label, profArg, N, how, opt1, opt2] = process.argv.slice(2);
const opts = [opt1 || '', opt2 || ''];
const PROF = profArg === 'default' ? path.join(process.env.LOCALAPPDATA, 'Unchore Browser', 'User Data') : profArg;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function shot(name) { try { execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File shot.ps1 shots\\${name}`, { stdio: 'ignore', timeout: 20000 }); } catch (e) {} }
function running() { try { return /chrome\.exe/i.test(execSync('tasklist /FI "IMAGENAME eq chrome.exe"').toString()); } catch (e) { return false; } }
async function waitGone() { for (let k = 0; k < 40 && running(); k++) await sleep(500); if (running()) { try { execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' }); } catch (e) {} await sleep(2000); return 'forced'; } return 'clean'; }
function findLnk() {
  const o = execSync(`powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; Get-ChildItem \\"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\",\\"$env:USERPROFILE\\Desktop\\",\\"C:\\Users\\Public\\Desktop\\",\\"C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\" -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Unchore' } | ForEach-Object { $l=$s.CreateShortcut($_.FullName); $_.FullName + '|' + $l.TargetPath + '|' + $l.Arguments }"`).toString().trim();
  console.log('LNKS ' + o.replace(/\r?\n/g, ' ;; '));
  return o.split(/\r?\n/)[0].split('|')[0];
}
function readFin() {
  const d = path.join(PROF, 'Default', 'Local Extension Settings', ID);
  const out = new Map();
  try {
    for (const f of fs.readdirSync(d)) {
      if (!/\.(log|ldb)$/.test(f)) continue;
      const txt = fs.readFileSync(path.join(d, f)).toString('latin1');
      for (const m of txt.matchAll(/FINREC\|(\d+)\|([^"]*?)\|END/g)) out.set(m[1], m[2]);
    }
  } catch (e) { console.log('READERR ' + String(e).slice(0, 120)); }
  return out;
}
async function setRestore() {
  // 설정 화면(chrome://settings)에서 «시작할 때: 중단한 위치에서 계속»(1)으로 바꾼다.
  const p = require('puppeteer-core');
  spawn(EXE, ['--user-data-dir=' + PROF, '--remote-debugging-port=9223', '--no-first-run', 'chrome://settings/onStartup'], { detached: true, stdio: 'ignore' }).unref();
  await sleep(6000);
  const b = await p.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
  const pg = (await b.pages()).find((x) => x.url().startsWith('chrome://settings'));
  const r = await pg.evaluate(() => new Promise((res) => chrome.settingsPrivate.setPref('session.restore_on_startup', 1, '', () => chrome.settingsPrivate.getPref('session.restore_on_startup', (v) => res(v.value)))));
  console.log('SETRESTORE ' + r);
  await pg.goto('chrome://newtab/').catch(() => {});
  await sleep(1500);
  await b.close().catch(() => {});
  execSync('taskkill /IM chrome.exe', { stdio: 'ignore' });
  console.log('SETCLOSE ' + (await waitGone()));
}
(async () => {
  fs.mkdirSync('shots', { recursive: true });
  const lnk = how === 'lnk' ? findLnk() : null;
  if (opts.includes('restore')) await setRestore();
  let seen = new Set(readFin().keys());
  let ok = 0, n = 0, norec = 0;
  for (let i = 0; i < +N; i++) {
    const t0 = Date.now();
    if (how === 'lnk') execSync(`cmd /c start "" "${lnk}"`);
    else {
      const args = ['--user-data-dir=' + PROF, '--lang=ko', '--window-size=1280,800'];
      if (!(opts.includes('firstrun') && i === 0)) args.push('--no-first-run');
      spawn(EXE, args, { detached: true, stdio: 'ignore' }).unref();
    }
    await sleep(15000);
    shot(`${label}-${i}.png`);
    try { execSync('taskkill /IM chrome.exe', { stdio: 'ignore' }); } catch (e) {}
    const close = await waitGone();
    await sleep(1500);
    const fin = readFin();
    const fresh = [...fin.entries()].filter(([k]) => !seen.has(k));
    fresh.forEach(([k]) => seen.add(k));
    const rec = fresh.length ? fresh[fresh.length - 1][1] : null;
    const firstRunLaunch = opts.includes('firstrun') && i === 0;
    console.log(`FT2RES ${label} #${i} close=${close} recs=${fresh.length} ${firstRunLaunch ? '(first-run)' : ''} ${rec || 'NO-RECORD'}`);
    if (!firstRunLaunch) { n++; if (rec && /ok=1/.test(rec)) ok++; if (!rec) norec++; }
  }
  console.log(`FT2SUM ${label} first-tab-unchore ${ok}/${n} no-record ${norec}`);
})();
