/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 */

/**
 * WPT shorthand conformance: fetches the web-platform-tests parsing
 * suites that cover the registry's shorthand properties, extracts their
 * literal test vectors, runs every vector for a registry property
 * through the expandShorthand engine in spec output (the compiler
 * projection), and prints a markdown report classifying each outcome
 * against WPT's valid/invalid expectation.
 *
 * WPT content is fetched at run time and never vendored into the repo;
 * the pinned upstream commit keeps runs reproducible. The engine is
 * loaded from BUILT output, so build the workspace first; the report is
 * regenerated on demand and is not checked in:
 *
 *   yarn workspace style-value-parser build
 *   node packages/style-value-parser/scripts/wpt-shorthand-conformance.mjs \
 *     > /tmp/stylex-shorthands/wpt-conformance.md
 *
 * Vector extraction is the mechanical single-line form the WPT parsing
 * suites use: test_valid_value(property, value[, serialization]) and
 * test_invalid_value(property, value) calls whose first two arguments
 * are string literals, plus test_shorthand_value(property, value, {...})
 * calls (a shorthand-testcommon vector is valid by construction; its
 * expected-longhand object is browser serialization data the browser
 * differential covers, so it is not extracted). Generated calls (loops,
 * template literals -- the css-fonts idiom) are invisible to this
 * extraction by design; the per-file vector counts make the blind spot
 * visible.
 *
 * Classifications (spec output):
 *   accepted            WPT-valid, the engine expands
 *   rejected            WPT-invalid, the engine refuses (agreement)
 *   refused-by-design   WPT-valid, the engine refuses, and a documented
 *                       design decision covers the refusal (the
 *                       REFUSAL_DESIGN_NOTES map below, each entry
 *                       grounded in a def module's doc comment or the
 *                       package README)
 *   accepted-by-design  WPT-invalid, the engine expands, and a
 *                       documented loose-acceptance decision covers it
 *                       (the ACCEPT_DESIGN_NOTES map below; slot
 *                       grammars relocate text verbatim and validate
 *                       only what classification requires)
 *   false-reject        WPT-valid, the engine refuses, no design note
 *   false-accept        WPT-invalid, the engine expands, no design note
 *
 * The two FALSE classes are conformance bugs and print in full; the
 * by-design classes print grouped with examples, and double as the
 * enumerated divergence list for the engine's supported subset.
 */

const WPT_COMMIT = '4f6a1df9d653fd4577b82db6701c9ca1124bddc5';
const WPT_RAW = `https://raw.githubusercontent.com/web-platform-tests/wpt/${WPT_COMMIT}`;

/**
 * The parsing suites covering the registry's 33 shorthands, pinned by
 * hand from the upstream css/ tree at WPT_COMMIT. Notes on coverage:
 *  - border sides (border-top/right/bottom/left) have no dedicated
 *    parsing suites upstream; css-backgrounds/border-shorthand.html
 *    carries their literal vectors.
 *  - corner-shape vectors live under css/css-borders/corner-shape/
 *    (no parsing/ directory in that module yet).
 *  - css-box and css-overflow both ship overflow suites; both are
 *    listed and identical vectors dedupe.
 *  - grid-row/grid-column have no *-valid.html upstream; their valid
 *    vectors come from the *-shorthand.html suites.
 */
const WPT_FILES = [
  'css/css-box/parsing/margin-valid.html',
  'css/css-box/parsing/margin-invalid.html',
  'css/css-box/parsing/margin-shorthand.html',
  'css/css-box/parsing/padding-valid.html',
  'css/css-box/parsing/padding-invalid.html',
  'css/css-box/parsing/padding-shorthand.html',
  'css/css-box/parsing/overflow-valid.html',
  'css/css-box/parsing/overflow-invalid.html',
  'css/css-overflow/parsing/overflow-valid.html',
  'css/css-overflow/parsing/overflow-invalid.html',
  'css/css-logical/parsing/inset-valid.html',
  'css/css-logical/parsing/inset-invalid.html',
  'css/css-logical/parsing/inset-shorthand.html',
  'css/css-logical/parsing/inset-block-inline-valid.html',
  'css/css-logical/parsing/inset-block-inline-invalid.html',
  'css/css-logical/parsing/inset-block-inline-shorthand.html',
  'css/css-logical/parsing/margin-block-inline-valid.html',
  'css/css-logical/parsing/margin-block-inline-invalid.html',
  'css/css-logical/parsing/margin-block-inline-shorthand.html',
  'css/css-logical/parsing/padding-block-inline-valid.html',
  'css/css-logical/parsing/padding-block-inline-invalid.html',
  'css/css-logical/parsing/padding-block-inline-shorthand.html',
  'css/css-position/parsing/inset-valid.html',
  'css/css-position/parsing/inset-invalid.html',
  'css/css-align/parsing/gap-valid.html',
  'css/css-align/parsing/gap-invalid.html',
  'css/css-align/parsing/gap-shorthand.html',
  'css/css-align/parsing/grid-gap-valid.html',
  'css/css-align/parsing/grid-gap-invalid.html',
  'css/css-align/parsing/grid-gap-shorthand.html',
  'css/css-overscroll-behavior/parsing/overscroll-behavior-valid.html',
  'css/css-overscroll-behavior/parsing/overscroll-behavior-invalid.html',
  'css/css-scroll-snap/parsing/scroll-margin-valid.html',
  'css/css-scroll-snap/parsing/scroll-margin-invalid.html',
  'css/css-scroll-snap/parsing/scroll-margin-shorthand.html',
  'css/css-scroll-snap/parsing/scroll-padding-valid.html',
  'css/css-scroll-snap/parsing/scroll-padding-invalid.html',
  'css/css-scroll-snap/parsing/scroll-padding-shorthand.html',
  'css/css-backgrounds/parsing/background-valid.html',
  'css/css-backgrounds/parsing/background-invalid.html',
  'css/css-backgrounds/parsing/border-valid.html',
  'css/css-backgrounds/parsing/border-invalid.html',
  'css/css-backgrounds/parsing/border-shorthand.html',
  'css/css-backgrounds/parsing/border-width-valid.html',
  'css/css-backgrounds/parsing/border-width-invalid.html',
  'css/css-backgrounds/parsing/border-width-shorthand.html',
  'css/css-backgrounds/parsing/border-style-valid.html',
  'css/css-backgrounds/parsing/border-style-invalid.html',
  'css/css-backgrounds/parsing/border-style-shorthand.html',
  'css/css-backgrounds/parsing/border-color-valid.html',
  'css/css-backgrounds/parsing/border-color-invalid.html',
  'css/css-backgrounds/parsing/border-color-shorthand.html',
  'css/css-backgrounds/parsing/border-radius-valid.html',
  'css/css-backgrounds/parsing/border-radius-invalid.html',
  'css/css-ui/parsing/outline-valid.html',
  'css/css-ui/parsing/outline-invalid.html',
  'css/css-ui/parsing/outline-shorthand.html',
  'css/css-borders/corner-shape/corner-shape-valid.html',
  'css/css-borders/corner-shape/corner-shape-invalid.html',
  'css/css-flexbox/parsing/flex-valid.html',
  'css/css-flexbox/parsing/flex-invalid.html',
  'css/css-flexbox/parsing/flex-shorthand.html',
  'css/css-fonts/parsing/font-valid.html',
  'css/css-fonts/parsing/font-invalid.html',
  'css/css-fonts/parsing/font-shorthand-variant.html',
  'css/css-animations/parsing/animation-valid.html',
  'css/css-animations/parsing/animation-invalid.html',
  'css/css-animations/parsing/animation-shorthand.html',
  'css/css-grid/parsing/grid-area-valid.html',
  'css/css-grid/parsing/grid-area-invalid.html',
  'css/css-grid/parsing/grid-area-shorthand.html',
  'css/css-grid/parsing/grid-row-invalid.html',
  'css/css-grid/parsing/grid-row-shorthand.html',
  'css/css-grid/parsing/grid-column-invalid.html',
  'css/css-grid/parsing/grid-column-shorthand.html',
  'css/css-grid/parsing/grid-template-shorthand-valid.html',
  'css/css-grid/parsing/grid-template-shorthand-invalid.html',
  'css/css-grid/parsing/grid-template-shorthand-areas-valid.html',
  'css/css-grid/parsing/grid-template-shorthand.html',
];

/**
 * Documented refusals of WPT-valid input. Each entry names the design
 * decision it is grounded in; `matches` sees the vector and the
 * cannot-expand reason. First match wins. An entry must never paper
 * over a refusal the docs do not actually cover -- anything unmatched
 * reports as false-reject and is treated as a bug.
 */
const REFUSAL_DESIGN_NOTES = [
  {
    note:
      'font: system keywords resolve from UA settings at use time and ' +
      'cannot be expanded at compile time (README; font def)',
    matches: (vector, reason) =>
      reason.kind === 'unsupported-feature' && reason.feature === 'system-font',
  },
  {
    note:
      'grid-template: the areas form cannot be split across longhands ' +
      'without losing the area names (README; grid-template def)',
    matches: (vector, reason) =>
      reason.kind === 'unsupported-feature' &&
      reason.feature === 'template-areas',
  },
  {
    note:
      'background: the def covers the six longhands the engine emits; ' +
      'origin/clip <box> keywords cannot be expanded faithfully and ' +
      'refuse instead (background def)',
    matches: (vector, reason) =>
      reason.kind === 'unsupported-feature' &&
      reason.feature === 'background-box-values',
  },
  {
    note:
      'var() components that no slot can place unambiguously are ' +
      'refused as contains-variable (README; css-wide pre-pass)',
    matches: (vector, reason) => reason.kind === 'contains-variable',
  },
  {
    note:
      'flex: basis-first multivalue forms are refused like the old ' +
      "splitter, even though the spec's || grammar (and browsers) accept " +
      'them; the grammar parses a lone <flex-basis> then refuses the ' +
      'trailing grow/shrink (flex def numberLedForm)',
    matches: (vector, reason) =>
      vector.key === 'flex' &&
      reason.kind === 'parse-error' &&
      /trailing input/i.test(reason.message),
  },
  {
    note:
      'animation: quoted-string keyframes names are not accepted; the ' +
      "slot grammars deal in idents (animation def's <keyframes-name> " +
      'rule)',
    matches: (vector, reason) =>
      vector.key === 'animation' &&
      reason.kind === 'parse-error' &&
      /["']/.test(String(vector.value)),
  },
  {
    note:
      'overscroll-behavior: the dropped early-draft keyword `chain` is ' +
      'not in the supported set (auto | contain | none); the engine ' +
      'refuses it, matching shipping browsers, where this pinned WPT ' +
      'commit is ahead of the implemented grammar (overscroll-behavior ' +
      'def keyword set)',
    matches: (vector, reason) =>
      vector.key === 'overscrollBehavior' &&
      reason.kind === 'parse-error' &&
      /\bchain\b/i.test(String(vector.value)),
  },
];

/**
 * Documented loose acceptances of WPT-invalid input: the engine is a
 * relocation layer, so slot grammars validate only what classification
 * requires and relocate the author's text verbatim. Same contract as
 * REFUSAL_DESIGN_NOTES: entries must be grounded in doc comments, and
 * anything unmatched reports as false-accept.
 */
const ACCEPT_DESIGN_NOTES = [
  {
    note:
      'math function arguments are balance-checked, never validated: ' +
      "shorthand slots relocate verbatim ('min(var(--a), 2px)' is one " +
      'length-ish component even where calc grammar disagrees) ' +
      '(math-function parser)',
    matches: (vector) =>
      /(?:calc|min|max|clamp|round|mod|rem|sin|cos|tan|asin|acos|atan|atan2|pow|sqrt|hypot|log|exp|abs|sign)\(/i.test(
        String(vector.value),
      ),
  },
  {
    note:
      'balanced-function slots (gradients, url variants, color ' +
      'functions, superellipse, cubic-bezier/steps) accept any balanced ' +
      'argument text verbatim; arguments are not validated ' +
      '(balancedFunction in families/slots; border def colorSlot)',
    matches: (vector) => /[a-z-]+\(/i.test(String(vector.value)),
  },
  {
    note:
      'grid lines: deep <grid-line> grammar (span/auto exclusivity, ' +
      'integer-zero refusal, component ordering) is deliberately not ' +
      'enforced; only components that cannot be part of any grid line ' +
      'refuse (grid-lines def)',
    matches: (vector) =>
      vector.key === 'gridRow' ||
      vector.key === 'gridColumn' ||
      vector.key === 'gridArea',
  },
  {
    note:
      'grid-template: track lists relocate verbatim and are not ' +
      'validated; each side of the slash is trusted (grid-template def)',
    matches: (vector) => vector.key === 'gridTemplate',
  },
  {
    note:
      "outline: the style slot keeps line-style's 'hidden', which " +
      'outline-style technically excludes, matching the old splitter ' +
      '(outline def)',
    matches: (vector) =>
      vector.key === 'outline' && /\bhidden\b/i.test(String(vector.value)),
  },
  {
    note:
      'flex: any <number> token is accepted, negatives included, for ' +
      'old-splitter parity (the spec wants non-negative numbers) ' +
      '(flex def numberComponent)',
    matches: (vector) =>
      vector.key === 'flex' && /-[\d.]/.test(String(vector.value)),
  },
  {
    note:
      'font: the font-family is everything after the font-size, ' +
      'relocated verbatim and never validated; numeric weights span the ' +
      'full 100-900 range; the oblique slant angle is not range-checked ' +
      '(font def: family join, weightComponent, oblique-angle pair)',
    matches: (vector) => vector.key === 'font',
  },
  {
    note:
      'negative <length-percentage>/<time> is accepted where the spec ' +
      'restricts a slot to non-negative (padding, gap, scroll-padding, ' +
      'border-width, border-radius, inset, animation duration): the ' +
      'engine classifies slot components by type and relocates them ' +
      'verbatim without range validation, so the component-to-longhand ' +
      'mapping matches the browser while acceptance is loose (families ' +
      'emit verbatim slices; flex keeps negatives for old-splitter ' +
      'parity)',
    matches: (vector) => /(?:^|[\s,(/])-(?:\d|\.\d)/.test(String(vector.value)),
  },
];

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

/** One literal string argument: quote, escaped body, matching quote. */
const stringLiteral = (name) =>
  `(?<${name}Quote>['"])(?<${name}>(?:\\\\.|(?!\\k<${name}Quote>).)*)` +
  `\\k<${name}Quote>`;

const CALL_PATTERN = new RegExp(
  'test_(?<kind>valid_value|invalid_value|shorthand_value)\\(\\s*' +
    `${stringLiteral('property')}\\s*,\\s*${stringLiteral('value')}`,
  'g',
);

function unescapeLiteral(body) {
  return body.replace(/\\(.)/g, (_, char) => {
    if (char === 'n') return '\n';
    if (char === 't') return '\t';
    return char;
  });
}

/**
 * Removes JS comments from one suite's source while leaving string
 * contents untouched. The suites disable not-yet-shipped vectors by
 * commenting them out (css-box's overflow no-display/no-content), so a
 * raw regex sweep would harvest dead test calls; stripping first keeps
 * the extraction faithful to what the suite actually runs. String state
 * is tracked so a `//` inside a url("https://...") literal is never
 * mistaken for a comment.
 */
function stripComments(source) {
  let out = '';
  let index = 0;
  let quote = null;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (quote != null) {
      out += char;
      if (char === '\\' && index + 1 < source.length) {
        out += source[index + 1];
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      index++;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
      index++;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index++;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === '*' && source[index + 1] === '/')
      ) {
        index++;
      }
      index += 2;
      continue;
    }
    out += char;
    index++;
  }
  return out;
}

/**
 * Extracts the literal-argument test calls from one suite's source.
 * Comments are stripped first so disabled (commented-out) vectors are
 * not harvested. Calls whose property or value is not a plain string
 * literal (loop variables, template interpolation) do not match
 * CALL_PATTERN and are skipped; `generatedCalls` counts them so the
 * blind spot is visible.
 */
function extractVectors(file, rawSource) {
  const source = stripComments(rawSource);
  const vectors = [];
  for (const match of source.matchAll(CALL_PATTERN)) {
    const { kind, property, value } = match.groups;
    vectors.push({
      property: unescapeLiteral(property),
      value: unescapeLiteral(value),
      expectation: kind === 'invalid_value' ? 'invalid' : 'valid',
      file,
    });
  }
  const calls = (
    source.match(/test_(?:valid_value|invalid_value|shorthand_value)\(/g) ?? []
  ).length;
  return { vectors, generatedCalls: calls - vectors.length };
}

async function fetchFile(file) {
  const url = `${WPT_RAW}/${file}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { file, error: `HTTP ${response.status}` };
    }
    return { file, source: await response.text() };
  } catch (error) {
    return { file, error: error.message };
  }
}

async function fetchAll(files, concurrency) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < files.length) {
      const index = next++;
      results[index] = await fetchFile(files[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function classify(vector, result) {
  if (vector.expectation === 'valid') {
    if (result.type === 'ok') {
      return { class: 'accepted' };
    }
    if (result.type === 'cannot-expand') {
      const note = REFUSAL_DESIGN_NOTES.find((entry) =>
        entry.matches(vector, result.reason),
      );
      return note != null
        ? { class: 'refused-by-design', note: note.note }
        : { class: 'false-reject' };
    }
    // Spec output never returns no-op, and the property filter removes
    // not-shorthand inputs; anything else is a harness bug worth seeing.
    return { class: 'false-reject' };
  }
  if (result.type === 'ok') {
    const note = ACCEPT_DESIGN_NOTES.find((entry) => entry.matches(vector));
    return note != null
      ? { class: 'accepted-by-design', note: note.note }
      : { class: 'false-accept' };
  }
  return { class: 'rejected' };
}

function renderResult(result) {
  switch (result.type) {
    case 'ok':
      return result.assignments
        .map((d) => `${d.property}: ${String(d.value)}`)
        .join('; ');
    case 'cannot-expand':
      return result.reason.kind === 'parse-error'
        ? `parse-error: ${result.reason.message}`
        : result.reason.kind === 'unsupported-feature'
          ? `unsupported-feature: ${result.reason.feature}`
          : result.reason.kind;
    default:
      return result.type;
  }
}

// Collapse whitespace (combinator parse-error messages span several
// lines) before escaping pipes, so a cell never breaks the table row.
const escapeCell = (text) =>
  text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');

async function main() {
  const engine = await load(
    '../lib/shorthands/index.js',
    'yarn workspace style-value-parser build',
  );
  const { expandShorthand, lookupShorthand } = engine;

  const fetched = await fetchAll(WPT_FILES, 8);
  const failures = fetched.filter((entry) => entry.error != null);
  for (const failure of failures) {
    console.error(`Failed to fetch ${failure.file}: ${failure.error}`);
  }
  if (failures.length === fetched.length) {
    console.error('No WPT files could be fetched; is the network available?');
    process.exit(1);
  }

  const seen = new Set();
  const vectors = [];
  let generatedCalls = 0;
  let foreignProperties = 0;
  for (const entry of fetched) {
    if (entry.source == null) {
      continue;
    }
    const extraction = extractVectors(entry.file, entry.source);
    generatedCalls += extraction.generatedCalls;
    for (const vector of extraction.vectors) {
      const def = lookupShorthand(vector.property);
      if (def == null) {
        foreignProperties++;
        continue;
      }
      const dedupeKey = `${def.key}\u0000${vector.value}\u0000${vector.expectation}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      vectors.push({ ...vector, key: def.key });
    }
  }

  const CLASSES = [
    'accepted',
    'rejected',
    'refused-by-design',
    'accepted-by-design',
    'false-reject',
    'false-accept',
  ];
  const perProperty = new Map();
  const rows = { 'false-reject': [], 'false-accept': [] };
  const byDesign = new Map();
  const minimalOutcomes = new Map();

  for (const vector of vectors) {
    const result = expandShorthand(vector.property, vector.value, {
      output: 'spec',
    });
    const { class: classification, note } = classify(vector, result);

    if (!perProperty.has(vector.key)) {
      perProperty.set(
        vector.key,
        Object.fromEntries(CLASSES.map((name) => [name, 0])),
      );
    }
    perProperty.get(vector.key)[classification]++;

    if (
      classification === 'false-reject' ||
      classification === 'false-accept'
    ) {
      rows[classification].push({ vector, result });
    }
    if (note != null) {
      if (!byDesign.has(note)) {
        byDesign.set(note, { count: 0, examples: [] });
      }
      const group = byDesign.get(note);
      group.count++;
      if (group.examples.length < 3) {
        group.examples.push(`${vector.property}: ${vector.value}`);
      }
    }

    if (classification === 'accepted') {
      const minimal = expandShorthand(vector.property, vector.value, {
        output: 'minimal',
      });
      const outcome =
        minimal.type === 'cannot-expand'
          ? `cannot-expand:${
              minimal.reason.kind === 'unsupported-feature'
                ? minimal.reason.feature
                : minimal.reason.kind
            }`
          : minimal.type;
      minimalOutcomes.set(outcome, (minimalOutcomes.get(outcome) ?? 0) + 1);
    }
  }

  console.log('# WPT shorthand conformance');
  console.log('');
  console.log(`WPT commit: \`${WPT_COMMIT}\``);
  console.log('');
  console.log(
    `${fetched.length - failures.length}/${WPT_FILES.length} suites fetched` +
      (failures.length > 0 ? ` (${failures.length} FAILED, see stderr)` : '') +
      `; ${vectors.length} literal vectors for registry shorthands ` +
      `(deduped; ${foreignProperties} non-registry-property calls and ` +
      `${generatedCalls} generated calls skipped).`,
  );
  console.log('');
  console.log('## Per-property classification (spec output)');
  console.log('');
  console.log(`| property | vectors | ${CLASSES.join(' | ')} |`);
  console.log(`| --- | --- | ${CLASSES.map(() => '---').join(' | ')} |`);
  const totals = Object.fromEntries(CLASSES.map((name) => [name, 0]));
  for (const key of [...perProperty.keys()].sort()) {
    const counts = perProperty.get(key);
    const total = CLASSES.reduce((sum, name) => sum + counts[name], 0);
    for (const name of CLASSES) {
      totals[name] += counts[name];
    }
    console.log(
      `| ${key} | ${total} | ${CLASSES.map((name) => counts[name]).join(' | ')} |`,
    );
  }
  const grandTotal = CLASSES.reduce((sum, name) => sum + totals[name], 0);
  console.log(
    `| **total** | ${grandTotal} | ${CLASSES.map((name) => totals[name]).join(' | ')} |`,
  );

  for (const classification of ['false-reject', 'false-accept']) {
    console.log('');
    console.log(`## ${classification} rows`);
    console.log('');
    if (rows[classification].length === 0) {
      console.log('(none)');
      continue;
    }
    console.log('| property | value | engine outcome | source |');
    console.log('| --- | --- | --- | --- |');
    for (const { vector, result } of rows[classification]) {
      console.log(
        `| ${vector.property} | \`${escapeCell(vector.value)}\` ` +
          `| ${escapeCell(renderResult(result))} | ${vector.file} |`,
      );
    }
  }

  console.log('');
  console.log('## By-design divergences seen in this run');
  console.log('');
  if (byDesign.size === 0) {
    console.log('(none)');
  } else {
    console.log('| design note | count | examples |');
    console.log('| --- | --- | --- |');
    for (const [note, group] of byDesign) {
      console.log(
        `| ${escapeCell(note)} | ${group.count} ` +
          `| ${escapeCell(group.examples.map((e) => `\`${e}\``).join('; '))} |`,
      );
    }
  }

  console.log('');
  console.log('## Minimal output on the accepted vectors (informative)');
  console.log('');
  console.log(
    'Minimal output is the lint projection: authored components only, ' +
      'no omitted-component resets, so it intentionally diverges from ' +
      'browser shorthand semantics. Outcome counts over the accepted ' +
      'vectors:',
  );
  console.log('');
  console.log('| outcome | count |');
  console.log('| --- | --- |');
  for (const [outcome, count] of [...minimalOutcomes.entries()].sort()) {
    console.log(`| ${outcome} | ${count} |`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
