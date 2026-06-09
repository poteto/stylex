/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../shorthands/define';
import type { Cell } from '../shorthands/types';

import { TokenType } from '@csstools/css-tokenizer';
import { TokenParser } from '../token-parser';
import { defineShorthand } from '../shorthands/define';
import { splitOnSlashes, walkComponents } from '../shorthands/families/slots';

/**
 * One parse, tagged by form. 'areas' (any string token anywhere -- the
 * template-areas DSL) is recognized but refused through the def's
 * unsupported hook: splitting an areas template across longhands loses
 * the area names' meaning. 'none' keeps the authored slice for the
 * keyword fan-out.
 */
type GridTemplateParsed =
  | Readonly<{ form: 'none', raw: string }>
  | Readonly<{ form: 'areas' }>
  | Readonly<{ form: 'rows-columns', rows: string, columns: string }>;

/**
 * grid-template: none | <'grid-template-rows'> / <'grid-template-columns'>
 *                     | [the areas form, refused]
 *
 * Track lists are NOT validated: each side of the slash relocates
 * verbatim (slices joined with single spaces), since deep track-list
 * grammar is not this def's job. The only slashless value the spec
 * grammar admits is 'none', so multi-component slashless forms are parse
 * errors where the old splitter silently passed them through.
 */
const parse: TokenParser<GridTemplateParsed> = new TokenParser(
  (input): GridTemplateParsed | Error => {
    const walk = walkComponents(input);
    const { tokens, components, fail, finish } = walk;
    if (components.length === 0) {
      return fail('Expected at least one component');
    }

    const done = (parsed: GridTemplateParsed): GridTemplateParsed => {
      finish();
      return parsed;
    };

    if (tokens.some((token) => token[0] === TokenType.String)) {
      return done({ form: 'areas' });
    }

    const groups = splitOnSlashes(walk);
    if (groups.length === 1) {
      const token = tokens[components[0].start];
      if (
        components.length === 1 &&
        token[0] === TokenType.Ident &&
        token[4].value.toLowerCase() === 'none'
      ) {
        return done({ form: 'none', raw: walk.sliceOf(components[0]) });
      }
      return fail("Expected a slash-separated rows / columns form or 'none'");
    }
    if (groups.length > 2) {
      return fail('Expected at most 2 slash-separated track lists');
    }
    if (groups[0].length === 0 || groups[1].length === 0) {
      return fail('Expected a track list on each side of the slash');
    }

    return done({
      form: 'rows-columns',
      rows: groups[0].map(walk.sliceOf).join(' '),
      columns: groups[1].map(walk.sliceOf).join(' '),
    });
  },
  'GridTemplate',
);

type GridTemplateLonghand = 'gridTemplateRows' | 'gridTemplateColumns';

const GRID_TEMPLATE_LONGHANDS: ReadonlyArray<GridTemplateLonghand> = [
  'gridTemplateRows',
  'gridTemplateColumns',
];

const expand = (
  parsed: GridTemplateParsed,
): Readonly<{ [_k in GridTemplateLonghand]: Cell }> => {
  if (parsed.form === 'areas') {
    // Unreachable from CSS input: run() routes this form through the
    // unsupported hook before any expansion.
    throw new Error('Cannot expand the grid-template areas form');
  }
  if (parsed.form === 'none') {
    // 'none' is the whole value, setting both longhands at once; the
    // authored keyword fans out with origin 'replicated', the css-wide
    // keyword (and flex keyword trio) precedent.
    return {
      gridTemplateRows: { raw: parsed.raw, origin: 'replicated' },
      gridTemplateColumns: { raw: parsed.raw, origin: 'replicated' },
    };
  }
  return {
    gridTemplateRows: { raw: parsed.rows, origin: 'explicit' },
    gridTemplateColumns: { raw: parsed.columns, origin: 'explicit' },
  };
};

/**
 * Longhand order is rows then columns (spec order); the old splitter
 * emitted gridTemplateColumns FIRST -- an enumerated divergence under
 * the deterministic-emit invariant. Minimal output is the plain origin
 * filter ('grid-template: none' single stays unreported via the
 * boundary fast path). No number fast path: a bare number is not a
 * valid grid-template value.
 */
export const gridTemplateDef: ShorthandDef = defineShorthand({
  canonical: 'grid-template',
  longhands: GRID_TEMPLATE_LONGHANDS,
  parse,
  expand,
  unsupported: (parsed) => (parsed.form === 'areas' ? 'template-areas' : null),
});
