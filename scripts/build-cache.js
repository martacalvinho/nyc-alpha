#!/usr/bin/env node
/*
  Build cache JSON files for neighborhoods.
  Usage:
    node scripts/build-cache.js --borough=manhattan
    node scripts/build-cache.js --borough=manhattan --nta=MN12
*/
const fs = require('fs');
const path = require('path');

// Load shared NTA list from JSON for CJS compatibility
const MANHATTAN_NTAS = require(path.join(__dirname, '../src/data/ntaList.json'));

function getBoroughNTAs(borough) {
  const b = String(borough || '').toLowerCase();
  if (b === 'manhattan') return MANHATTAN_NTAS;
  return [];
}

function boroughSlug(borough) {
  return String(borough || '').toLowerCase().replace(/\s+/g, '-');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

(async () => {
  // Require processor module (CommonJS)
  const { processNeighborhood } = require(path.join(__dirname, '../src/lib/processNeighborhood.js'));
  const { borough = 'manhattan', nta } = parseArgs();
  const ntas = getBoroughNTAs(borough);
  if (!ntas.length) {
    console.error(`No NTAs configured for borough: ${borough}`);
    process.exit(1);
  }

  const targets = nta ? ntas.filter(n => n.code.toUpperCase() === String(nta).toUpperCase()) : ntas;
  if (!targets.length) {
    console.error(`NTA ${nta} not found in ${borough}`);
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'public', 'cache', boroughSlug(borough));
  fs.mkdirSync(outDir, { recursive: true });

  const started = Date.now();
  console.log(`Building caches for ${targets.length} neighborhood(s) in ${borough}...`);

  for (let i = 0; i < targets.length; i++) {
    const t0 = Date.now();
    const { code, name } = targets[i];
    const label = `${code} ${name}`;
    process.stdout.write(`  [${i + 1}/${targets.length}] ${label} ... `);
    try {
      const { leads, stats, progress } = await processNeighborhood({ borough, neighborhood: name, ntaCode: code });
      const payload = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        borough,
        ntaCode: code,
        neighborhood: name,
        leads,
        stats,
        progress,
      };
      const outPath = path.join(outDir, `${code}.json`);
      fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`ok (${leads.length} leads, ${dt}s)`);
    } catch (err) {
      console.log('failed');
      console.error(err && err.response && err.response.data ? err.response.data : err);
    }
    // Small delay between neighborhoods to be nice to APIs
    await new Promise(r => setTimeout(r, 250));
  }

  const totalDt = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done in ${totalDt}s`);
})();
