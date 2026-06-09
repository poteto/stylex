/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 */

/**
 * Shorthand parity diff: runs the parity corpus through the OLD eslint
 * splitter (splitShorthands.js, as the stylex-valid-shorthands rule
 * drives it) and the NEW expandShorthand engine (minimal output, the
 * lint projection), then prints a markdown table of every case whose
 * outcomes differ, with a mechanical classification per row.
 *
 * Both engines are loaded from BUILT output, so build both workspaces
 * first; the report is regenerated on demand and is not checked in:
 *
 *   yarn workspace style-value-parser build
 *   yarn workspace @stylexjs/eslint-plugin build
 *   node packages/style-value-parser/scripts/shorthand-parity-diff.mjs \
 *     > /tmp/stylex-shorthands/parity-report.md
 *
 * Classifications:
 *   old-mis-split  old emitted token garbage (an !important fragment
 *                  leaked into a longhand value with allowImportant off)
 *   now-fixable    old reported CANNOT_FIX (or stayed silent), new ok
 *   now-refused    old emitted pairs, new refuses or no-ops
 *   now-silent     old reported CANNOT_FIX, new treats it as identity
 *   ordering       same key/value pairs, different order
 *   key-change     same values, different property names
 *   value-change   same property names, different values
 *   mixed          both keys and values differ
 */

async function load(specifier, buildHint) {
  try {
    return await import(specifier);
  } catch (error) {
    console.error(
      `Failed to load ${specifier}\n  ${error.message}\n` +
        `Build it first: ${buildHint}`,
    );
    process.exit(1);
  }
}

// The OLD engine's property table, exactly as stylex-valid-shorthands
// wires it (shorthandAliases).
function buildOldTransformers({
  createBlockInlineTransformer,
  createDirectionalTransformer,
  createSpecificTransformer,
}) {
  return {
    background: createSpecificTransformer('background'),
    font: createSpecificTransformer('font'),
    borderColor: createSpecificTransformer('border-color'),
    borderWidth: createSpecificTransformer('border-width'),
    borderStyle: createSpecificTransformer('border-style'),
    borderTop: createSpecificTransformer('border-top'),
    borderRight: createSpecificTransformer('border-right'),
    borderBottom: createSpecificTransformer('border-bottom'),
    border: createSpecificTransformer('border'),
    borderLeft: createSpecificTransformer('border-left'),
    borderRadius: createSpecificTransformer('border-radius'),
    cornerShape: createSpecificTransformer('corner-shape'),
    gridArea: createSpecificTransformer('grid-area'),
    gridColumn: createSpecificTransformer('grid-column'),
    gridRow: createSpecificTransformer('grid-row'),
    gridTemplate: createSpecificTransformer('grid-template'),
    outline: createSpecificTransformer('outline'),
    animation: createSpecificTransformer('animation'),
    flex: createSpecificTransformer('flex'),
    gap: createSpecificTransformer('gap'),
    gridGap: createSpecificTransformer('gap'),
    margin: createDirectionalTransformer('margin', 'Block', 'Inline'),
    padding: createDirectionalTransformer('padding', 'Block', 'Inline'),
    marginBlock: createBlockInlineTransformer('margin', 'Block'),
    marginInline: createBlockInlineTransformer('margin', 'Inline'),
    paddingBlock: createBlockInlineTransformer('padding', 'Block'),
    paddingInline: createBlockInlineTransformer('padding', 'Inline'),
  };
}

/**
 * Old outcome as the RULE would see it: 'identity' (no report),
 * 'cannot-fix' (report without fixer), or pairs (report with autofix),
 * replicating the rule's pre- and post-transformer identity checks.
 */
function runOld(entry, old) {
  const transformer = old.transformers[entry.property];
  if (transformer == null) {
    return { kind: 'identity' };
  }
  const { value } = entry;
  if (entry.property === 'flex' && old.isSingleToken(String(value))) {
    return { kind: 'identity' };
  }
  let pairs;
  try {
    pairs = transformer(
      value,
      entry.allowImportant === true,
      entry.preferInline === true,
    );
  } catch (error) {
    return { kind: 'throw', message: error.message };
  }
  if (pairs.length === 1 && pairs[0][1] === old.CANNOT_FIX) {
    return { kind: 'cannot-fix' };
  }
  if (
    pairs.length === 1 &&
    pairs[0][0] === entry.property &&
    (pairs[0][1] === value ||
      pairs[0][1] === String(value) ||
      pairs[0][1] === parseInt(value, 10))
  ) {
    return { kind: 'identity' };
  }
  if (
    entry.property === 'gap' &&
    pairs.length === 2 &&
    pairs.every(([, v]) => v === value || v === Number(value))
  ) {
    return { kind: 'identity' };
  }
  return { kind: 'pairs', pairs: pairs.map(([k, v]) => [k, v]) };
}

/** New outcome in minimal output: the lint projection. */
function runNew(entry, expandShorthand) {
  const result = expandShorthand(entry.property, entry.value, {
    output: 'minimal',
    allowImportant: entry.allowImportant,
    preferInline: entry.preferInline,
  });
  switch (result.type) {
    case 'ok':
      return {
        kind: 'pairs',
        pairs: result.assignments.map((d) => [d.property, d.value]),
      };
    case 'not-shorthand':
    case 'no-op':
      return { kind: 'identity' };
    case 'cannot-expand':
      return { kind: 'refused', reason: result.reason.kind };
    default:
      return { kind: 'throw', message: `unknown type ${result.type}` };
  }
}

const canonical = (pairs) => pairs.map(([k, v]) => `${k}: ${String(v)}`);

function equivalent(oldResult, newResult) {
  if (oldResult.kind === 'identity' && newResult.kind === 'identity') {
    return true;
  }
  // Both report-without-fix at the rule level.
  if (oldResult.kind === 'cannot-fix' && newResult.kind === 'refused') {
    return true;
  }
  if (oldResult.kind === 'pairs' && newResult.kind === 'pairs') {
    const a = canonical(oldResult.pairs);
    const b = canonical(newResult.pairs);
    return a.length === b.length && a.every((line, i) => line === b[i]);
  }
  return false;
}

function classify(entry, oldResult, newResult) {
  if (
    oldResult.kind === 'pairs' &&
    entry.allowImportant !== true &&
    oldResult.pairs.some(([, v]) => String(v).includes('!important'))
  ) {
    return 'old-mis-split';
  }
  if (newResult.kind === 'pairs') {
    if (oldResult.kind === 'cannot-fix' || oldResult.kind === 'identity') {
      return 'now-fixable';
    }
  }
  if (oldResult.kind === 'pairs') {
    if (newResult.kind === 'refused' || newResult.kind === 'identity') {
      return 'now-refused';
    }
  }
  if (oldResult.kind === 'cannot-fix' && newResult.kind === 'identity') {
    return 'now-silent';
  }
  if (oldResult.kind === 'pairs' && newResult.kind === 'pairs') {
    const a = canonical(oldResult.pairs);
    const b = canonical(newResult.pairs);
    if (a.length === b.length) {
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      if (sortedA.every((line, i) => line === sortedB[i])) {
        return 'ordering';
      }
      const keys = (pairs) => pairs.map(([k]) => k).join(',');
      const values = (pairs) => pairs.map(([, v]) => String(v)).join(',');
      if (values(oldResult.pairs) === values(newResult.pairs)) {
        return keys(oldResult.pairs) === keys(newResult.pairs)
          ? 'value-change'
          : 'key-change';
      }
      if (keys(oldResult.pairs) === keys(newResult.pairs)) {
        return 'value-change';
      }
    }
  }
  return 'mixed';
}

function render(result) {
  switch (result.kind) {
    case 'identity':
      return '(identity)';
    case 'cannot-fix':
      return 'CANNOT_FIX';
    case 'refused':
      return `refused:${result.reason}`;
    case 'throw':
      return `throw: ${result.message}`;
    default:
      return result.pairs.map(([k, v]) => `${k}: ${String(v)}`).join('; ');
  }
}

function flagText(entry) {
  const flags = [
    entry.allowImportant === true ? 'allowImportant' : null,
    entry.preferInline === true ? 'preferInline' : null,
  ].filter(Boolean);
  return flags.length > 0 ? ` [${flags.join(',')}]` : '';
}

async function main() {
  const oldEngine = await load(
    '../../@stylexjs/eslint-plugin/lib/utils/splitShorthands.js',
    'yarn workspace @stylexjs/eslint-plugin build',
  );
  const newEngine = await load(
    '../lib/shorthands/index.js',
    'yarn workspace style-value-parser build',
  );
  const { PARITY_CORPUS } = await load(
    '../lib/shorthands/parity-corpus.js',
    'yarn workspace style-value-parser build',
  );

  const old = {
    transformers: buildOldTransformers(oldEngine),
    CANNOT_FIX: oldEngine.CANNOT_FIX,
    isSingleToken: oldEngine.isSingleToken,
  };

  const rows = [];
  const counts = new Map();
  for (const entry of PARITY_CORPUS) {
    const oldResult = runOld(entry, old);
    const newResult = runNew(entry, newEngine.expandShorthand);
    if (equivalent(oldResult, newResult)) {
      continue;
    }
    const classification = classify(entry, oldResult, newResult);
    counts.set(classification, (counts.get(classification) ?? 0) + 1);
    rows.push(
      `| ${entry.property} | \`${String(entry.value)}\`${flagText(entry)} ` +
        `| ${render(oldResult)} | ${render(newResult)} | ${classification} |`,
    );
  }

  console.log('# Shorthand parity diff: old splitter vs new engine');
  console.log('');
  console.log(
    `${PARITY_CORPUS.length} corpus cases; ` +
      `${PARITY_CORPUS.length - rows.length} equivalent, ` +
      `${rows.length} differ.`,
  );
  console.log('');
  console.log('| classification | count |');
  console.log('| --- | --- |');
  for (const [classification, count] of [...counts.entries()].sort()) {
    console.log(`| ${classification} | ${count} |`);
  }
  console.log('');
  console.log(
    '| property | value | old output | new output | classification |',
  );
  console.log('| --- | --- | --- | --- | --- |');
  for (const row of rows) {
    console.log(row);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
