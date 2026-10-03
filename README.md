# unchore-browser-bench

Same 20 browser tasks (10 company, 10 general), same pass checks, run against different AI browsers on a clean Windows runner.
Tasks: `tasks.json`. Runner: `compare.js` (drives the browser over the DevTools protocol).
Login secrets are exchanged encrypted with a per-run key; nothing personal is written to this repo or the logs.
