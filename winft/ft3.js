// 윈도 첫 탭 시험 3판: 설치된 기본 프로필(--user-data-dir 없음). 켤 때마다 실제 명령줄·확장 등록 정보·FINREC 를 적는다.
// node ft3.js <label> <launches> <exe|lnk>
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const EXE = process.env.EXE;
const ID = 'opifjjladhiahefopcfmlebppocldhjh';
const [label, N, how] = process.argv.slice(2);
const UD = path.join(process.env.LOCALAPPDATA, 'Unchore Browser', 'User Data');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (c) => { try { return execSync(`powershell -NoProfile -Command "${c}"`, { timeout: 30000 }).toString().trim(); } catch (e) { return 'PSERR ' + String(e).slice(0, 80); } };
function shot(name) { try { execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File shot.ps1 shots\\${name}`, { stdio: 'ignore', timeout: 20000 }); } catch (e) {} }
function running() { try { return /chrome\.exe/i.test(execSync('tasklist /FI "IMAGENAME eq chrome.exe"').toString()); } catch (e) { return false; } }
async function waitGone() { for (let k = 0; k < 40 && running(); k++) await sleep(500); if (running()) { try { execSync('taskkill /F /IM chrome.exe', { stdio: 'ignore' }); } catch (e) {} await sleep(2000); return 'forced'; } return 'clean'; }
function readFin() {
  const d = path.join(UD, 'Default', 'Local Extension Settings', ID);
  const out = new Map();
  try { for (const f of fs.readdirSync(d)) { if (!/\.(log|ldb)$/.test(f)) continue; const txt = fs.readFileSync(path.join(d, f)).toString('latin1'); for (const m of txt.matchAll(/FINREC\|(\d+)\|([^"]*?)\|END/g)) out.set(m[1], m[2]); } } catch (e) {}
  return out;
}
function extInfo() {
  const o = [];
  for (const f of ['Preferences', 'Secure Preferences']) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(UD, 'Default', f), 'utf8'));
      const s = j.extensions && j.extensions.settings && j.extensions.settings[ID];
      if (!s) { o.push(f + ':none'); continue; }
      o.push(f + ':' + JSON.stringify({ loc: s.location, state: s.state, dis: s.disable_reasons, path: s.path, ver: s.manifest && s.manifest.version, sw: s.service_worker_registration_info, keys: Object.keys(s).join('/') }).slice(0, 600));
    } catch (e) { o.push(f + ':ERR ' + String(e).slice(0, 60)); }
  }
  return o.join(' || ');
}
(async () => {
  fs.mkdirSync('shots', { recursive: true });
  let lnk = null;
  if (how === 'lnk') lnk = ps("$s=New-Object -ComObject WScript.Shell; (Get-ChildItem \\\"$env:USERPROFILE\\Desktop\\\" -Filter *.lnk | Where-Object { $_.Name -match 'Unchore' } | Select-Object -First 1).FullName");
  let seen = new Set(readFin().keys());
  let ok = 0, norec = 0;
  for (let i = 0; i < +N; i++) {
    if (how === 'lnk') execSync(`cmd /c start "" "${lnk}"`);
    else spawn(EXE, [], { detached: true, stdio: 'ignore' }).unref();
    await sleep(18000);
    shot(`${label}-${i}.png`);
    const cl = ps("Get-CimInstance Win32_Process -Filter \\\"Name='chrome.exe'\\\" | Where-Object { $_.CommandLine -notmatch '--type=' } | ForEach-Object { $_.CommandLine }");
    try { execSync('taskkill /IM chrome.exe', { stdio: 'ignore' }); } catch (e) {}
    const close = await waitGone();
    await sleep(1500);
    const fin = readFin();
    const fresh = [...fin.entries()].filter(([k]) => !seen.has(k));
    fresh.forEach(([k]) => seen.add(k));
    const rec = fresh.length ? fresh[fresh.length - 1][1] : null;
    if (rec && /ok=1/.test(rec)) ok++; if (!rec) norec++;
    console.log(`FT3RES ${label} #${i} close=${close} recs=${fresh.length} ${rec || 'NO-RECORD'}`);
    if (i === 0 || i === +N - 1) { console.log(`FT3CMD ${label} #${i} ${cl.replace(/\r?\n/g, ' ;; ').slice(0, 500)}`); console.log(`FT3EXT ${label} #${i} ${extInfo()}`); }
  }
  console.log(`FT3SUM ${label} first-tab-unchore ${ok}/${N} no-record ${norec}`);
})();
