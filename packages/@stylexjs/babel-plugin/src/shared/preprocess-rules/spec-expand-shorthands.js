/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { TStyleValue } from '../common-types';

import { shorthands } from 'style-value-parser';
import propertySpecificity from './property-specificity';

/// # Expand statically-parseable shorthands to their longhands at build time.
///
/// Every shorthand the style-value-parser registry knows is parsed with the
/// CSS-spec grammar and expanded to the full set of longhands, including the
/// spec-defined defaults for omitted slots (`border: 1px solid` also sets
/// `borderColor: currentcolor`). Everything else -- including the alias
/// remaps and banned shorthands -- keeps the default property-specificity
/// behavior.
///
/// NOTE: expansion moves a declaration from the shorthand priority tiers
/// (1000/2000) to the longhand tiers (3000/4000), so merge outcomes change
/// for code that relied on shorthand-vs-longhand layering. That is the
/// point of the mode: every expanded declaration competes at longhand
/// specificity.
///
/// Values that cannot be parsed statically are left alone:
///  - `null` and fallback arrays keep the authored key.
///  - Any value referencing `var()` keeps the authored key. A custom
///    property can hold an arbitrary number of components, and dynamic
///    styles compile to lone `var()` placeholders whose key paths must
///    survive for the inline-style wiring to match. This is deliberately
///    broader than a top-level-var check: a nested reference such as
///    `calc(var(--x) + 2px)` also opts out of expansion rather than risk
///    rewriting a declaration we cannot fully see.
///  - A genuine shorthand value the grammar refuses (extra components,
///    comma-separated layers) is an error, routed through the same
///    propertyValidationMode channel the other modes use.

type TReturn = $ReadOnlyArray<[string, TStyleValue]>;

const { expandShorthand, registry } = shorthands;

function reasonMessage(
  reason: shorthands.CannotExpandReason,
  value: string | number,
): string {
  switch (reason.kind) {
    case 'parse-error':
      return reason.message.split('\n')[0];
    case 'contains-variable':
      return 'the value references a CSS variable';
    case 'multiple-layers':
      return 'comma-separated layers cannot be expanded to single longhand values';
    case 'important-disallowed':
      return '"!important" is not allowed';
    case 'unsupported-feature':
      return `${reason.feature} is not supported`;
    default:
      return `the value '${String(value)}' could not be parsed`;
  }
}

function makeExpansion(key: string): (TStyleValue) => TReturn {
  const fallback: void | ((TStyleValue) => TReturn) = propertySpecificity[key];
  const passthrough = (value: TStyleValue): TReturn =>
    fallback != null ? fallback(value) : [[key, value]];

  return (value: TStyleValue): TReturn => {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return passthrough(value);
    }
    if (typeof value === 'string' && value.toLowerCase().includes('var(')) {
      return passthrough(value);
    }
    const result = expandShorthand(key, value, {
      output: 'spec',
      allowImportant: true,
    });
    switch (result.type) {
      case 'ok':
        return result.assignments.map(({ property, value: longhandValue }) => [
          property,
          longhandValue,
        ]);
      case 'cannot-expand':
        throw new Error(
          `Cannot expand the shorthand property '${key}' with value '${String(
            value,
          )}': ${reasonMessage(result.reason, value)}`,
        );
      default:
        // 'no-op' and 'not-shorthand' are identity expansions.
        return [[key, value]];
    }
  };
}

const expansions: { [string]: (TStyleValue) => TReturn } = {
  ...propertySpecificity,
};
for (const key of Object.keys(registry)) {
  expansions[key] = makeExpansion(key);
}

export default expansions as $ReadOnly<{ [string]: (TStyleValue) => TReturn }>;
