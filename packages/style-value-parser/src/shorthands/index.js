/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { CSSToken } from '@csstools/css-tokenizer';
import type { ShorthandDef } from './define';
import type { Declaration, EmitOptions, ExpandResult } from './types';

import { TokenType } from '@csstools/css-tokenizer';
import { TokenList } from '../token-types';
import {
  countTopLevelComponents,
  cssWideKeyword,
  hasTopLevelVar,
  splitImportant,
} from './css-wide';
import { lookupShorthand } from './registry';

export type {
  CannotExpandReason,
  Cell,
  Declaration,
  EmitOptions,
  ExpandResult,
  LonghandOrigin,
} from './types';
export type { ShorthandDef } from './define';

export { defineShorthand } from './define';
export { axisPair } from './families/axis-pair';
export { corners } from './families/corners';
export { fourSides } from './families/four-sides';
export { lineTrio } from './families/line-trio';
export {
  isShorthand,
  lookupShorthand,
  normalizeKey,
  registry,
} from './registry';

/** A TokenList over already-materialized tokens; never re-tokenizes. */
function tokenListOf(tokens: ReadonlyArray<CSSToken>): TokenList {
  let index = 0;
  return new TokenList({
    nextToken: () => tokens[index++],
    endOfFile: () => index >= tokens.length,
  });
}

/**
 * Boundary post-pass shared by every ok-result path: maps physical keys to
 * logical ones when the caller asked for `preferInline` (per-def data), and
 * suffixes `!important` onto every emitted value when present and allowed.
 */
function finish(
  result: ExpandResult,
  def: ShorthandDef,
  options: EmitOptions,
  important: boolean,
): ExpandResult {
  if (result.type !== 'ok') {
    return result;
  }
  const mapKeys = options.preferInline === true;
  const assignments: ReadonlyArray<Declaration> = result.assignments.map(
    (declaration) => ({
      property: mapKeys
        ? (def.dialectMap[declaration.property] ?? declaration.property)
        : declaration.property,
      value:
        important && typeof declaration.value === 'string'
          ? `${declaration.value} !important`
          : declaration.value,
      origin: declaration.origin,
    }),
  );
  return { type: 'ok', assignments, important };
}

/**
 * The package's hot-path entry point. Pure; never throws on CSS input
 * (throws only on programmer error: an unknown `output` value).
 *
 * Pipeline:
 *   normalize + registry lookup                      -> not-shorthand?
 *   number fast path (single-component by construction)
 *   cheap top-level component count                  -> no-op in minimal
 *   split/flag !important                            -> important-disallowed?
 *   CSS-wide keyword pre-pass (spec replicates to every longhand)
 *   def.run: grammar over the tokenized-once value   -> parse-error?
 *     (a parse failure with a top-level var() present is classified as
 *      contains-variable: this grammar had no slot for the variable)
 *   preferInline dialect mapping + !important suffix
 *
 * Deterministic emit order: ok-assignments follow the def's spec-ordered
 * `longhands` (or the def's documented condensed order in minimal output).
 */
export function expandShorthand(
  property: string,
  value: string | number,
  options: EmitOptions,
): ExpandResult {
  const { output } = options;
  if (output !== 'spec' && output !== 'minimal') {
    throw new Error(`Unknown output mode: ${String(output)}`);
  }

  const def = lookupShorthand(property);
  if (def == null) {
    return { type: 'not-shorthand' };
  }

  if (typeof value === 'number' && def.runNumber != null) {
    return finish(def.runNumber(value, options), def, options, false);
  }

  const source = typeof value === 'number' ? String(value) : value;
  const all = new TokenList(source).getAllTokens();

  if (
    output === 'minimal' &&
    def.singleComponentIsIdentity &&
    countTopLevelComponents(all) <= 1
  ) {
    return { type: 'no-op' };
  }

  const { important, endIndex } = splitImportant(all);
  if (important && options.allowImportant !== true) {
    return {
      type: 'cannot-expand',
      reason: { kind: 'important-disallowed' },
    };
  }

  let start = 0;
  while (start < endIndex && all[start][0] === TokenType.Whitespace) {
    start++;
  }
  let end = endIndex;
  while (end > start && all[end - 1][0] === TokenType.Whitespace) {
    end--;
  }
  const valueTokens = all.slice(start, end);
  if (valueTokens.length === 0) {
    return {
      type: 'cannot-expand',
      reason: { kind: 'parse-error', message: 'Empty value' },
    };
  }

  const keyword = cssWideKeyword(valueTokens);
  if (keyword != null) {
    if (output === 'minimal') {
      return { type: 'no-op' };
    }
    return finish(
      {
        type: 'ok',
        assignments: def.longhands.map((longhand) => ({
          property: longhand,
          value: keyword,
          origin: 'replicated',
        })),
        important: false,
      },
      def,
      options,
      important,
    );
  }

  const result = def.run(tokenListOf(valueTokens), options);
  if (
    result.type === 'cannot-expand' &&
    result.reason.kind === 'parse-error' &&
    hasTopLevelVar(valueTokens)
  ) {
    return { type: 'cannot-expand', reason: { kind: 'contains-variable' } };
  }
  return finish(result, def, options, important);
}
