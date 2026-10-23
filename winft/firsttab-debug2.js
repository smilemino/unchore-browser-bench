// 시험용 2판: firsttab.js 3판 + 기록(ftlog) + 12초 뒤 최종 탭 기록(FINREC). 윈도 원인 찾기 전용, 배포 안 함.
(function () {
  const T0 = Date.now();
  const LOG = [];
  const LOGALL = [];
  let flushT = null;
  function log(ev, x) {
    const rec = Object.assign({ t: Date.now() - T0, ev }, x || {}); LOG.push(rec); LOGALL.push(rec);
    clearTimeout(flushT);
    flushT = setTimeout(() => chrome.storage.local.get('ftlog').then((o) => chrome.storage.local.set({ ftlog: (o.ftlog || []).concat([{ swStart: T0, at: Date.now() }], LOG.splice(0)).slice(-80) })), 50);
  }
  log('sw-start', { timeOrigin: Math.round(performance.timeOrigin) });
  const NTP = /^chrome:\/\/(new-tab-page|newtab)\/?$/;
  const MAX_TRIES = 3;
  const tries = new Map();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function ourTabs() {
    try {
      const cs = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
      return new Set(cs.map((c) => c.tabId));
    } catch (e) { log('ctx-err', { e: String(e).slice(0, 120) }); return null; }
  }
  async function fixTab(t, mine, why) {
    try {
      if (!t || t.id == null) return;
      const u = t.pendingUrl || t.url || '';
      const info = { why, id: t.id, url: t.url, pend: t.pendingUrl, st: t.status };
      if (!NTP.test(u)) { log('skip-url', info); return; }
      if (t.status === 'loading') { log('skip-loading', info); return; }
      if (!mine) mine = await ourTabs();
      info.mine = mine ? [...mine] : null;
      if (!mine || mine.has(t.id)) { log('skip-ours', info); return; }
      const n = tries.get(t.id) || 0;
      if (n >= MAX_TRIES) { log('skip-max', info); return; }
      tries.set(t.id, n + 1);
      const url = n < MAX_TRIES - 1 ? 'chrome://newtab/' : chrome.runtime.getURL('newtab.html');
      info.to = url; log('fix', info);
      await chrome.tabs.update(t.id, { url });
    } catch (e) { log('fix-err', { e: String(e).slice(0, 120) }); }
  }
  async function sweep(why) {
    try {
      const mine = await ourTabs();
      const ts = await chrome.tabs.query({});
      log('sweep', { why, n: ts.length, mine: mine ? [...mine] : null });
      for (const t of ts) await fixTab(t, mine, why);
    } catch (e) { log('sweep-err', { e: String(e).slice(0, 120) }); }
  }
  self.ucFixFirstTabs = sweep;
  chrome.tabs.onCreated.addListener((t) => log('created', { id: t.id, url: t.url, pend: t.pendingUrl, st: t.status }));
  chrome.tabs.onUpdated.addListener(async (id, info, t) => {
    log('updated', { id, info, url: t.url });
    if (info.status !== 'complete') return;
    await sleep(300);
    try { fixTab(await chrome.tabs.get(id), null, 'upd'); } catch (e) {}
  });
  chrome.tabs.onRemoved.addListener((id) => tries.delete(id));
  chrome.runtime.onStartup && chrome.runtime.onStartup.addListener(() => { log('onStartup'); sweep('onStartup'); });
  chrome.runtime.onInstalled && chrome.runtime.onInstalled.addListener((d) => log('onInstalled', { reason: d.reason }));

  setTimeout(async () => {
    try {
      const mine = await ourTabs();
      const ts = await chrome.tabs.query({});
      const fixes = LOGALL.filter((x) => x.ev === 'fix').length;
      const tabs = ts.map((t) => [t.id, t.status, (t.pendingUrl || t.url || '').replace('chrome-extension://', 'ext:').slice(0, 60), mine && mine.has(t.id) ? 'MINE' : 'no'].join('~')).join(',');
      const ntpBad = ts.filter((t) => NTP.test(t.pendingUrl || t.url || '') && !(mine && mine.has(t.id))).length;
      const ok = mine && ts.some((t) => mine.has(t.id)) && ntpBad === 0 ? 1 : 0;
      const rec = 'FINREC|' + T0 + '|ok=' + ok + '|bad=' + ntpBad + '|fixes=' + fixes + '|firstEv=' + (LOGALL[1] ? LOGALL[1].ev + '@' + LOGALL[1].t : '-') + '|tabs=' + tabs + '|END';
      chrome.storage.local.set({ ['fin' + T0]: rec });
    } catch (e) { chrome.storage.local.set({ ['fin' + T0]: 'FINREC|' + T0 + '|err=' + String(e).slice(0, 60) + '|END' }); }
  }, 12000);
  sweep('load');
  for (const ms of [500, 1500, 3000, 5000, 8000]) setTimeout(() => sweep('t' + ms), ms);
})();
