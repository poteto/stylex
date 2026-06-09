/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

/**
 * Thin adapter between the eslint rules and the style-value-parser
 * shorthand engine. The engine owns every grammar; this module only maps
 * its four-variant ExpandResult onto the [property, value] pair shape the
 * rules consume, and keeps the CANNOT_FIX sentinel an eslint-side concern.
 */

import { tokenize, TokenType } from '@csstools/css-tokenizer';
import { shorthands } from 'style-value-parser';

const { expandShorthand, normalizeKey } = shorthands;

type ExpandResult = ReturnType<typeof expandShorthand>;

export const CANNOT_FIX = 'CANNOT_FIX';

type Pair = Readonly<[string, number | string]>;

const toCamelCase = (str: string): string =>
  str.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/**
 * Maps an engine result onto rule pairs:
 *   ok            -> the engine's assignments, in engine order
 *   cannot-expand -> the CANNOT_FIX sentinel pair (report without a fixer)
 *   no-op / not-shorthand -> an identity pair the rule's guards suppress
 */
function mapResult(
  result: ExpandResult,
  identityKey: string,
  identityValue: number | string,
): ReadonlyArray<Pair> {
  switch (result.type) {
    case 'ok':
      return result.assignments.map((d): Pair => [d.property, d.value]);
    case 'cannot-expand':
      return [[identityKey, CANNOT_FIX]];
    default:
      return [[identityKey, identityValue]];
  }
}

export const createSpecificTransformer = (
  property: string,
): ((
  rawValue: number | string,
  allowImportant?: boolean,
  preferInline?: boolean,
) => ReadonlyArray<Pair>) => {
  return (
    rawValue: number | string,
    allowImportant: boolean = false,
    preferInline: boolean = false,
  ) =>
    splitSpecificShorthands(
      property,
      rawValue.toString(),
      allowImportant,
      typeof rawValue === 'number',
      preferInline,
    );
};

export const createDirectionalTransformer = (
  baseProperty: string,
  _blockSuffix: string,
  _inlineSuffix: string,
): ((
  rawValue: number | string,
  allowImportant?: boolean,
  preferInline?: boolean,
) => ReadonlyArray<Pair>) => {
  // The Block/Inline pairing the suffixes used to drive now lives in the
  // engine def's condense (margin/padding emit marginBlock/marginInline).
  return (
    rawValue: number | string,
    allowImportant: boolean = false,
    preferInline: boolean = false,
  ) =>
    mapResult(
      expandShorthand(baseProperty, rawValue, {
        output: 'minimal',
        allowImportant,
        preferInline,
      }),
      baseProperty,
      rawValue,
    );
};

export const createBlockInlineTransformer = (
  baseProperty: string,
  suffix: string,
): ((
  rawValue: number | string,
  allowImportant?: boolean,
) => ReadonlyArray<Pair>) => {
  const registryKey = `${baseProperty}${suffix}`;
  return (rawValue: number | string, allowImportant: boolean = false) =>
    mapResult(
      expandShorthand(registryKey, rawValue, {
        output: 'minimal',
        allowImportant,
      }),
      registryKey,
      rawValue,
    );
};

export function splitSpecificShorthands(
  property: string,
  value: string,
  allowImportant: boolean = false,
  isNumber: boolean = false,
  preferInline: boolean = false,
): ReadonlyArray<Pair> {
  // normalizeKey resolves registered camel/kebab/legacy spellings to the
  // registry's camelCase key; unregistered names just get camelized.
  const key = toCamelCase(normalizeKey(property));
  const passthrough: number | string = isNumber ? Number(value) : value;
  const result = expandShorthand(property, passthrough, {
    output: 'minimal',
    allowImportant,
    preferInline,
  });
  // gap alias shim: the engine treats a single gap value as identity, but
  // a single value has always been emitted as a rowGap/columnGap pair so
  // `gridGap: 10` keeps autofixing to the pair while plain `gap` stays
  // suppressed by the rule's own gap identity guard.
  if (key === 'gap' && result.type === 'no-op') {
    return [
      ['rowGap', passthrough],
      ['columnGap', passthrough],
    ];
  }
  return mapResult(result, key, passthrough);
}

export function splitDirectionalShorthands(
  str: number | string,
  allowImportant: boolean = false,
): ReadonlyArray<number | string> {
  if (str == null || (typeof str !== 'string' && typeof str !== 'number')) {
    return [str];
  }

  if (typeof str === 'number') {
    // A number is a single component by construction, and numbers stay
    // numbers across the split.
    return [str];
  }

  const nodes = splitTopLevelParts(str.trim(), false);

  if (
    nodes.length > 1 &&
    nodes[nodes.length - 1].toLowerCase() === '!important' &&
    allowImportant
  ) {
    return nodes.slice(0, nodes.length - 1).map((node) => node + ' !important');
  }

  if (nodes.length > 1 && new Set(nodes).size === 1) {
    // If all values are the same, no need to expand
    return [nodes[0]];
  }

  return nodes;
}

export function isSingleToken(value: string): boolean {
  return splitTopLevelParts(stripImportantTail(value), true).length <= 1;
}

const IMPORTANT_TAIL_REGEX = /^(.*?)(?:\s*!important\s*)$/i;

function stripImportantTail(value: string): string {
  const match = value.match(IMPORTANT_TAIL_REGEX);
  return match != null ? match[1].trim() : value.trim();
}

/**
 * Splits a value into its top-level parts: maximal runs of non-whitespace
 * tokens at bracket depth 0. A depth-0 '/' always ends a part and is kept
 * as a part of its own when `keepSeparators` is true (isSingleToken counts
 * it, so `flex: 1 / 3` is not a single token); when false, depth-0 '/' and
 * ',' are dropped, mirroring the postcss `div` filtering the directional
 * splitter has always done.
 */
function splitTopLevelParts(
  value: string,
  keepSeparators: boolean,
): Array<string> {
  const parts: Array<string> = [];
  let current = '';
  let depth = 0;

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed !== '') {
      parts.push(trimmed);
    }
    current = '';
  };

  for (const token of tokenize({ css: value })) {
    const type = token[0];
    const text = token[1];

    if (type === TokenType.EOF) {
      continue;
    }

    if (
      type === TokenType.Function ||
      type === TokenType.OpenParen ||
      type === TokenType.OpenSquare ||
      type === TokenType.OpenCurly
    ) {
      depth += 1;
      current += text;
      continue;
    }

    if (
      type === TokenType.CloseParen ||
      type === TokenType.CloseSquare ||
      type === TokenType.CloseCurly
    ) {
      depth = Math.max(0, depth - 1);
      current += text;
      continue;
    }

    if (depth === 0) {
      if (type === TokenType.Whitespace) {
        flush();
        continue;
      }
      if (type === TokenType.Delim && text === '/') {
        flush();
        if (keepSeparators) {
          parts.push('/');
        }
        continue;
      }
      if (!keepSeparators && type === TokenType.Comma) {
        flush();
        continue;
      }
    }

    current += text;
  }

  flush();

  return parts;
}
