#!/usr/bin/env node
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/**
 * Measures the TypeScript compilation cost of the public StyleX types by
 * running `tsc --noEmit --extendedDiagnostics` over a set of surfaces:
 *
 *   typescript-tests   the dedicated TS harness over the public types
 *   example-nextjs     a stylex-heavy example app
 *   shorthand-stress   ~500 generated stylex.create() calls dominated by
 *                      shorthand values (see ./fixtures/stress)
 *
 * Each surface gets warm-up runs (default 1) plus measured runs (default 5);
 * the report prints median/min/max wall, total and check time, the memory
 * high-water mark, and the deterministic Types/Instantiations counts.
 * `--incremental false` is always passed so that every run is a full check
 * (typescript-tests and example-nextjs enable incremental caching in their
 * tsconfigs, which would otherwise turn repeat runs into no-ops).
 *
 * Results are printed to stdout only; nothing is written into the repo.
 *
 *   node packages/benchmarks/ts-compile/run.js
 *   node packages/benchmarks/ts-compile/run.js --surface shorthand-stress --runs 7
 */

const { spawnSync } = require('child_process');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const repoRoot = path.join(__dirname, '..', '..', '..');

const SURFACES = [
  {
    name: 'typescript-tests',
    dir: path.join(repoRoot, 'packages', 'typescript-tests'),
  },
  {
    name: 'example-nextjs',
    dir: path.join(repoRoot, 'examples', 'example-nextjs'),
  },
  {
    name: 'shorthand-stress',
    dir: path.join(__dirname, 'fixtures', 'stress'),
  },
];

const argv = yargs(hideBin(process.argv))
  .option('runs', {
    type: 'number',
    description: 'Measured runs per surface',
    default: 5,
  })
  .option('warmup', {
    type: 'number',
    description: 'Warm-up runs per surface (not measured)',
    default: 1,
  })
  .option('surface', {
    type: 'array',
    description: 'Only run the named surface(s)',
    choices: SURFACES.map((surface) => surface.name),
  }).argv;

// Resolves the same typescript installation that `yarn workspace <surface>`
// scripts use: the surface's own node_modules first, then the workspace
// root. Spawned through process.execPath so no shell shim is involved.
function resolveTsc(surfaceDir) {
  const pkgJsonPath = require.resolve('typescript/package.json', {
    paths: [surfaceDir],
  });
  const packageDir = path.dirname(pkgJsonPath);
  return {
    bin: path.join(packageDir, 'bin', 'tsc'),
    version: require(pkgJsonPath).version,
  };
}

// Lines of `--extendedDiagnostics` output we keep, e.g.
//   "Check time:      6.63s" / "Types: 48930" / "Memory used: 211383K".
const DIAGNOSTIC_FIELDS = {
  Types: 'types',
  Instantiations: 'instantiations',
  'Memory used': 'memoryK',
  'Check time': 'checkS',
  'Total time': 'totalS',
};

function parseDiagnostics(stdout) {
  const parsed = {};
  for (const line of stdout.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const field = DIAGNOSTIC_FIELDS[line.slice(0, separator).trim()];
    if (field != null) {
      parsed[field] = parseFloat(line.slice(separator + 1).trim());
    }
  }
  return parsed;
}

function runOnce(surface, tsc) {
  const args = [
    tsc.bin,
    '--noEmit',
    '--incremental',
    'false',
    '--extendedDiagnostics',
  ];
  const startNs = process.hrtime.bigint();
  const result = spawnSync(process.execPath, args, {
    cwd: surface.dir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const wallS = Number(process.hrtime.bigint() - startNs) / 1e9;
  if (result.status !== 0) {
    console.error(`tsc failed for surface "${surface.name}":`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  return { wallS, ...parseDiagnostics(result.stdout) };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function statsRow(label, values, format) {
  const cells = [median(values), Math.min(...values), Math.max(...values)];
  return `| ${label} | ${cells.map(format).join(' | ')} |`;
}

const seconds = (value) => value.toFixed(2);
const megabytes = (value) => (value / 1024).toFixed(1);

function benchmarkSurface(surface) {
  const tsc = resolveTsc(surface.dir);
  console.log(`## ${surface.name}`);
  console.log('');
  console.log(
    `${path.relative(repoRoot, surface.dir)} · typescript ${tsc.version} · ` +
      `node ${process.version} · ${argv.warmup} warm-up + ${argv.runs} measured`,
  );
  console.log('');

  for (let i = 0; i < argv.warmup; i++) {
    runOnce(surface, tsc);
  }
  const runs = [];
  for (let i = 0; i < argv.runs; i++) {
    runs.push(runOnce(surface, tsc));
  }

  const pluck = (field) => runs.map((run) => run[field]);
  console.log('| metric | median | min | max |');
  console.log('| --- | --- | --- | --- |');
  console.log(statsRow('wall time (s)', pluck('wallS'), seconds));
  console.log(statsRow('total time (s)', pluck('totalS'), seconds));
  console.log(statsRow('check time (s)', pluck('checkS'), seconds));
  console.log(statsRow('memory used (MB)', pluck('memoryK'), megabytes));
  console.log('');

  for (const field of ['types', 'instantiations']) {
    const values = new Set(pluck(field));
    const suffix =
      values.size === 1
        ? ''
        : ` (UNSTABLE across runs: ${[...values].join(', ')})`;
    console.log(`${field}: ${runs[0][field]}${suffix}`);
  }
  console.log('');
}

const selected =
  argv.surface == null
    ? SURFACES
    : SURFACES.filter((surface) => argv.surface.includes(surface.name));

console.log('# TypeScript compilation benchmark');
console.log('');
for (const surface of selected) {
  benchmarkSurface(surface);
}
