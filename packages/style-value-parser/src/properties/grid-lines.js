/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { Sourced } from '../token-parser';
import type { ComponentRange } from '../shorthands/css-wide';
import type { ShorthandDef } from '../shorthands/define';
import type { Cell, Declaration, EmitOptions } from '../shorthands/types';
import type { ComponentWalk } from '../shorthands/families/slots';

import { NumberType, TokenType } from '@csstools/css-tokenizer';
import { TokenParser } from '../token-parser';
import { varFunction } from '../shorthands/css-wide';
import { defineShorthand } from '../shorthands/define';
import { splitOnSlashes, walkComponents } from '../shorthands/families/slots';

/**
 * Keywords a <custom-ident> grid line name may not be, mirroring the old
 * splitter's guard: 'auto' plus the CSS-wide keywords (and 'none', which
 * no <grid-line> production accepts).
 */
const GRID_NON_CUSTOM_IDENT_KEYWORDS: ReadonlySet<string> = new Set([
  'auto',
  'none',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

type LineComponent = 'auto' | 'span' | 'integer' | 'ident' | 'var';

const variable: TokenParser<Sourced<void>> = TokenParser.sourced(varFunction);

/**
 * Shallow classification of ONE grid-line component. Acceptable
 * components are the single-token forms -- the 'auto' and 'span'
 * keywords, an <integer> (the tokenizer's integer flag, so '1.5'
 * refuses), a <custom-ident> that is none of the excluded keywords and
 * not span-prefixed (the old splitter's isCustomIdent rules) -- plus a
 * top-level var(): slash groups are positionally unambiguous (the quad
 * rule's trust), so a variable is accepted as one group component. A
 * var() is NOT a <custom-ident>, so it never drives replication.
 * Anything else -- other functions, strings -- is unclassifiable and
 * refuses.
 */
function classifyLineComponent(
  walk: ComponentWalk,
  component: ComponentRange,
): LineComponent | null {
  if (component.end - component.start !== 1) {
    return walk.matchRange(variable, component) != null ? 'var' : null;
  }
  const token = walk.tokens[component.start];
  if (token[0] === TokenType.Ident) {
    const value = token[4].value;
    const lower = value.toLowerCase();
    if (lower === 'auto') {
      return 'auto';
    }
    if (lower === 'span') {
      return 'span';
    }
    if (GRID_NON_CUSTOM_IDENT_KEYWORDS.has(lower) || /^span\b/i.test(value)) {
      return null;
    }
    return 'ident';
  }
  if (token[0] === TokenType.Number && token[4].type === NumberType.Integer) {
    return 'integer';
  }
  return null;
}

/**
 * Shallow <grid-line> group validation, deliberately: every component
 * must classify, and a 'span' must combine with an integer or name (or a
 * var() that could substitute either) somewhere in the same group. The
 * spec's `span && [ <integer> || <custom-ident> ]` is order-free, so the
 * integer or name may lead OR trail the span ('2 span' and 'span 2' are
 * both valid, as browsers accept); only the co-occurrence is required.
 * Deep <grid-line> grammar (span/auto exclusivity, integer-zero refusal,
 * component ordering, one-span-per-line) is NOT enforced -- verbatim
 * relocation is the job, so the def only refuses components that cannot
 * be part of any grid line. Returns the parse problem, or null when the
 * group is acceptable.
 */
function lineGroupProblem(
  walk: ComponentWalk,
  group: ReadonlyArray<ComponentRange>,
): string | null {
  if (group.length === 0) {
    return 'Expected a grid line on each side of the slash';
  }
  let hasSpan = false;
  let hasIntegerOrName = false;
  for (let index = 0; index < group.length; index++) {
    const kind = classifyLineComponent(walk, group[index]);
    if (kind == null) {
      return `Unexpected component: ${walk.sliceOf(group[index])}`;
    }
    if (kind === 'span') {
      hasSpan = true;
    } else if (kind === 'integer' || kind === 'ident' || kind === 'var') {
      hasIntegerOrName = true;
    }
  }
  if (hasSpan && !hasIntegerOrName) {
    return "Expected an integer or line name with 'span'";
  }
  return null;
}

function isLoneIdentGroup(
  walk: ComponentWalk,
  group: ReadonlyArray<ComponentRange>,
): boolean {
  return (
    group.length === 1 && classifyLineComponent(walk, group[0]) === 'ident'
  );
}

const joinGroup = (
  walk: ComponentWalk,
  group: ReadonlyArray<ComponentRange>,
): string => group.map(walk.sliceOf).join(' ');

type GridLinesParsed = Readonly<{
  /** Slash-separated groups, each a verbatim slice join. */
  groups: ReadonlyArray<string>,
  /** Whether each group is a LONE <custom-ident> (drives replication). */
  loneIdent: ReadonlyArray<boolean>,
}>;

function gridLinesParser(
  label: string,
  maxGroups: number,
): TokenParser<GridLinesParsed> {
  return new TokenParser((input): GridLinesParsed | Error => {
    const walk = walkComponents(input);
    if (walk.components.length === 0) {
      return walk.fail('Expected at least one component');
    }
    const groups = splitOnSlashes(walk);
    if (groups.length > maxGroups) {
      return walk.fail(
        `Expected at most ${maxGroups} slash-separated grid lines`,
      );
    }
    for (const group of groups) {
      const problem = lineGroupProblem(walk, group);
      if (problem != null) {
        return walk.fail(problem);
      }
    }
    const parsed = {
      groups: groups.map((group) => joinGroup(walk, group)),
      loneIdent: groups.map((group) => isLoneIdentGroup(walk, group)),
    };
    walk.finish();
    return parsed;
  }, label);
}

const explicit = (raw: string): Cell => ({ raw, origin: 'explicit' });

/**
 * The spec's omitted-line rule, which is also the old splitter's
 * grid-area ident logic: an omitted end copies its start when that start
 * is a lone <custom-ident>, else defaults to 'auto'.
 */
const copyOrAuto = (start: string, startIsLoneIdent: boolean): Cell =>
  startIsLoneIdent
    ? { raw: start, origin: 'replicated' }
    : { raw: 'auto', origin: 'defaulted' };

/**
 * grid-row / grid-column: <grid-line> [ / <grid-line> ]?
 *
 * One group is its own minimal form REGARDLESS of component count (the
 * old splitter never reported slashless values, 'span 2' included), so
 * condense returns null for it; spec output applies the copy-or-auto
 * rule. Validation is the shallow walk above; var() is a valid group
 * component ('var(--line) / 2' splits), and a lone var() group is a
 * non-ident, so its omitted end defaults to 'auto' in spec output. No
 * number fast path: the stringified fallback parses a bare '2' as one
 * integer group.
 */
function gridLineDef(
  config: Readonly<{
    canonical: string,
    start: string,
    end: string,
  }>,
): ShorthandDef {
  const { canonical, start, end } = config;
  const parse = gridLinesParser(`GridLines<${canonical}>`, 2);

  const expand = (parsed: GridLinesParsed): Readonly<{ +[string]: Cell }> => ({
    [start]: explicit(parsed.groups[0]),
    [end]:
      parsed.groups.length === 2
        ? explicit(parsed.groups[1])
        : copyOrAuto(parsed.groups[0], parsed.loneIdent[0]),
  });

  const condense = (
    parsed: GridLinesParsed,
    _options: EmitOptions,
    _key: string,
  ): ?ReadonlyArray<Declaration> => {
    if (parsed.groups.length === 1) {
      return null;
    }
    const cells = expand(parsed);
    return [start, end].map((property) => ({
      property,
      value: cells[property].raw,
      origin: cells[property].origin,
    }));
  };

  return defineShorthand({
    canonical,
    longhands: [start, end],
    parse,
    expand,
    condense,
  });
}

export const gridRowDef: ShorthandDef = gridLineDef({
  canonical: 'grid-row',
  start: 'gridRowStart',
  end: 'gridRowEnd',
});

export const gridColumnDef: ShorthandDef = gridLineDef({
  canonical: 'grid-column',
  start: 'gridColumnStart',
  end: 'gridColumnEnd',
});

type GridAreaLonghand =
  | 'gridRowStart'
  | 'gridColumnStart'
  | 'gridRowEnd'
  | 'gridColumnEnd';

const GRID_AREA_LONGHANDS: ReadonlyArray<GridAreaLonghand> = [
  'gridRowStart',
  'gridColumnStart',
  'gridRowEnd',
  'gridColumnEnd',
];

const gridAreaExpand = (
  parsed: GridLinesParsed,
): Readonly<{ [_k in GridAreaLonghand]: Cell }> => {
  const { groups, loneIdent } = parsed;
  const rowStart = explicit(groups[0]);
  const columnStart =
    groups.length >= 2
      ? explicit(groups[1])
      : copyOrAuto(groups[0], loneIdent[0]);
  const rowEnd =
    groups.length >= 3
      ? explicit(groups[2])
      : copyOrAuto(groups[0], loneIdent[0]);
  // The omitted column-end copies the RESOLVED column-start: groups[1]
  // when present, else the row-start ident already replicated onto it.
  const columnEnd =
    groups.length >= 4
      ? explicit(groups[3])
      : groups.length >= 2
        ? copyOrAuto(groups[1], loneIdent[1])
        : copyOrAuto(groups[0], loneIdent[0]);
  return {
    gridRowStart: rowStart,
    gridColumnStart: columnStart,
    gridRowEnd: rowEnd,
    gridColumnEnd: columnEnd,
  };
};

/**
 * Minimal output keeps the old splitter's reporting contract: a single
 * non-ident group stays on gridArea (null -> no-op), a single lone-ident
 * group EXPANDS (the old splitter reported 'grid-area: header' onto all
 * four longhands), and multi-group forms emit authored plus replicated
 * cells only. The old splitter sorted its emitted entries alphabetically
 * (gridColumnEnd first); this def emits in spec order under the
 * deterministic-emit invariant -- an enumerated divergence.
 */
const gridAreaCondense = (
  parsed: GridLinesParsed,
  _options: EmitOptions,
  _key: string,
): ?ReadonlyArray<Declaration> => {
  if (parsed.groups.length === 1 && !parsed.loneIdent[0]) {
    return null;
  }
  const cells = gridAreaExpand(parsed);
  return GRID_AREA_LONGHANDS.map((property) => ({
    property,
    value: cells[property].raw,
    origin: cells[property].origin,
  })).filter((declaration) => declaration.origin !== 'defaulted');
};

/**
 * grid-area: <grid-line> [ / <grid-line> ]{0,3}
 *
 * Replication per spec matches the old splitter's ident logic: each
 * omitted line copies its counterpart start when that start is a lone
 * <custom-ident>, else 'auto'. A var() group is accepted (positionally
 * unambiguous) but is never a custom-ident, so it neither replicates
 * nor blocks the split. singleComponentIsIdentity is false: a
 * one-component 'grid-area: header' must reach def.run because its
 * minimal form lives on four different keys.
 */
export const gridAreaDef: ShorthandDef = defineShorthand({
  canonical: 'grid-area',
  longhands: GRID_AREA_LONGHANDS,
  parse: gridLinesParser('GridLines<grid-area>', 4),
  expand: gridAreaExpand,
  condense: gridAreaCondense,
  singleComponentIsIdentity: false,
});
