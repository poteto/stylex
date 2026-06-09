/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 */

import Benchmark from 'benchmark';
import { expandShorthand } from '../lib/shorthands/index.js';

/**
 * Head-to-head shorthand expansion: the NEW expandShorthand engine
 * (minimal and spec outputs) against the OLD eslint splitter from the
 * built @stylexjs/eslint-plugin lib, over one representative value per
 * grammar family. Build both workspaces first:
 *
 *   yarn workspace style-value-parser build
 *   yarn workspace @stylexjs/eslint-plugin build
 *
 * When the eslint-plugin lib is missing the old-engine suites are
 * skipped with a notice and only the new engine is measured.
 */

const CASES = [
  { name: 'margin 4-value', property: 'margin', value: '10px 12px 13px 14px' },
  {
    name: 'borderWidth mixed',
    property: 'borderWidth',
    value: 'thin 2px thick medium',
  },
  {
    name: 'border 3-slot',
    property: 'border',
    value: '1px solid rgba(0, 0, 0, 0.5)',
  },
  {
    name: 'borderRadius slash',
    property: 'borderRadius',
    value: '10px 20px / 30px 40px',
  },
  {
    name: 'font full form',
    property: 'font',
    value: 'italic small-caps bold 16px/1.5 "Helvetica Neue"',
  },
  {
    name: 'background full form',
    property: 'background',
    value: '#ff0 url("image.jpg") no-repeat fixed center / cover',
  },
  {
    name: 'animation full form',
    property: 'animation',
    value: '3s ease-in 1s 2 reverse both paused slidein',
  },
  { name: 'gridArea 4-group', property: 'gridArea', value: '1 / 2 / 3 / 4' },
  { name: 'flex 3-value', property: 'flex', value: '2 2 10%' },
];

// The old transformer per property, exactly as the eslint rule wires it.
function buildOldTransformers(oldEngine) {
  const { createDirectionalTransformer, createSpecificTransformer } = oldEngine;
  return {
    margin: createDirectionalTransformer('margin', 'Block', 'Inline'),
    borderWidth: createSpecificTransformer('border-width'),
    border: createSpecificTransformer('border'),
    borderRadius: createSpecificTransformer('border-radius'),
    font: createSpecificTransformer('font'),
    background: createSpecificTransformer('background'),
    animation: createSpecificTransformer('animation'),
    gridArea: createSpecificTransformer('grid-area'),
    flex: createSpecificTransformer('flex'),
  };
}

const geometricMean = (ratios) =>
  Math.exp(ratios.reduce((sum, r) => sum + Math.log(r), 0) / ratios.length);

const formatOps = (hz) =>
  hz == null ? 'n/a' : `${Math.round(hz).toLocaleString('en-US')}/s`;

async function main() {
  let oldTransformers = null;
  try {
    const oldEngine = await import(
      '../../@stylexjs/eslint-plugin/lib/utils/splitShorthands.js'
    );
    oldTransformers = buildOldTransformers(oldEngine);
  } catch {
    console.log(
      'NOTE: @stylexjs/eslint-plugin lib not built; skipping the old\n' +
        'engine (run `yarn workspace @stylexjs/eslint-plugin build`).',
    );
  }

  console.log('\n\n<shorthands>\n');

  const results = [];
  for (const { name, property, value } of CASES) {
    const suite = new Benchmark.Suite(name);
    if (oldTransformers != null) {
      const transformer = oldTransformers[property];
      suite.add('Old splitter        ', () => {
        transformer(value, false, false);
      });
    }
    suite.add('New engine (minimal)', () => {
      expandShorthand(property, value, { output: 'minimal' });
    });
    suite.add('New engine (spec)   ', () => {
      expandShorthand(property, value, { output: 'spec' });
    });

    console.log(`# ${name}: '${property}: ${value}'`);
    suite
      .on('cycle', (event) => {
        console.log(String(event.target));
      })
      .run();
    console.log('');

    const hzOf = (label) =>
      suite.filter((bench) => bench.name === label)[0]?.hz ?? null;
    results.push({
      name,
      old: hzOf('Old splitter        '),
      minimal: hzOf('New engine (minimal)'),
      spec: hzOf('New engine (spec)   '),
    });
  }

  console.log(
    '| suite | old ops/sec | new minimal | new spec | minimal/old | spec/old |',
  );
  console.log('| --- | --- | --- | --- | --- | --- |');
  const minimalRatios = [];
  const specRatios = [];
  for (const { name, old, minimal, spec } of results) {
    const minimalRatio = old != null ? minimal / old : null;
    const specRatio = old != null ? spec / old : null;
    if (minimalRatio != null) {
      minimalRatios.push(minimalRatio);
    }
    if (specRatio != null) {
      specRatios.push(specRatio);
    }
    console.log(
      `| ${name} | ${formatOps(old)} | ${formatOps(minimal)} ` +
        `| ${formatOps(spec)} ` +
        `| ${minimalRatio == null ? 'n/a' : minimalRatio.toFixed(2)}x ` +
        `| ${specRatio == null ? 'n/a' : specRatio.toFixed(2)}x |`,
    );
  }

  if (minimalRatios.length > 0) {
    console.log('');
    console.log(
      `Geometric mean vs old: minimal ${geometricMean(minimalRatios).toFixed(2)}x, ` +
        `spec ${geometricMean(specRatios).toFixed(2)}x.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
