#!/usr/bin/env node
/* eslint-disable no-console -- CLI helper */
console.log(`
mini-erp — dev reset purchasing / sales (operational stores only)

  Dry run (no writes), in app DevTools after npm run dev / tauri dev:
    await window.__MINI_ERP_DEV_RESET_PURCHASING_SALES__.dryRun()

  Real reset (destructive), either:
    $env:VITE_CONFIRM_RESET_PURCHASING_SALES='YES'; npm run dev   # PowerShell, then:
    await window.__MINI_ERP_DEV_RESET_PURCHASING_SALES__.executeReset()

  Or without env var:
    await window.__MINI_ERP_DEV_RESET_PURCHASING_SALES__.executeReset({ confirm: 'RESET_PURCHASING_SALES' })

  Vitest smoke (mock fs, dry run only):
    npm run dev:reset-purchasing-sales:dry

  Full docs: src/dev/README.md
`);
