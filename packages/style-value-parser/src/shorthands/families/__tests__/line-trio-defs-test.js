/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../../define';
import type { EmitOptions, ExpandResult } from '../../types';

import { TokenList } from '../../../token-types';
import {
  borderBottomDef,
  borderDef,
  borderLeftDef,
  borderRightDef,
  borderTopDef,
} from '../../../properties/border';
import { outlineDef } from '../../../properties/outline';

function runDef(
  def: ShorthandDef,
  value: string,
  options: EmitOptions,
): ExpandResult {
  return def.run(new TokenList(value), options);
}

function run(value: string, options: EmitOptions): ExpandResult {
  return runDef(borderDef, value, options);
}

function expectParseError(result: ExpandResult, message: RegExp) {
  expect(result.type).toEqual('cannot-expand');
  if (result.type === 'cannot-expand') {
    expect(result.reason.kind).toEqual('parse-error');
    if (result.reason.kind === 'parse-error') {
      expect(result.reason.message).toMatch(message);
    }
  }
}

describe('border def (line-trio family)', () => {
  describe('def metadata', () => {
    it('expands one level: to the width/style/color shorthands', () => {
      expect(borderDef.key).toEqual('border');
      expect(borderDef.canonical).toEqual('border');
      expect(borderDef.longhands).toEqual([
        'borderWidth',
        'borderStyle',
        'borderColor',
      ]);
    });

    it('has no dialect map and no number fast path', () => {
      expect(borderDef.dialectMap).toEqual({});
      expect(borderDef.runNumber).toBe(null);
    });

    it('escapes the minimal-mode single-component fast path', () => {
      expect(borderDef.singleComponentIsIdentity).toBe(false);
    });
  });

  describe('slot classification', () => {
    it('fills all three slots from the canonical order', () => {
      expect(run('1px solid red', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
    });

    it('emits in longhand order regardless of authored order', () => {
      const expected = run('1px solid red', { output: 'spec' });
      for (const permutation of [
        '1px red solid',
        'solid 1px red',
        'solid red 1px',
        'red 1px solid',
        'red solid 1px',
      ]) {
        expect(run(permutation, { output: 'spec' })).toEqual(expected);
      }
    });

    it('classifies width keywords and lengths to the width slot', () => {
      expect(run('thick dotted', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: 'thick', origin: 'explicit' },
          { property: 'borderStyle', value: 'dotted', origin: 'explicit' },
        ],
      });
    });

    it('classifies calc() to the width slot', () => {
      expect(run('calc(2px + 1px) solid red', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderWidth',
            value: 'calc(2px + 1px)',
            origin: 'explicit',
          },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
    });

    it('classifies modern color functions to the color slot by name', () => {
      for (const color of [
        'oklch(0.6 0.1 240)',
        'hwb(120 20% 30%)',
        'lab(52% 40 59)',
        'color(display-p3 1 0.5 0)',
        'hsl(220 3% 15% / 10%)',
      ]) {
        expect(run(`1px solid ${color}`, { output: 'minimal' })).toEqual({
          type: 'ok',
          important: false,
          assignments: [
            { property: 'borderWidth', value: '1px', origin: 'explicit' },
            { property: 'borderStyle', value: 'solid', origin: 'explicit' },
            { property: 'borderColor', value: color, origin: 'explicit' },
          ],
        });
      }
    });

    it('accepts unitless zero as a width', () => {
      expect(run('0 solid', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '0', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
        ],
      });
    });

    it('classifies hash and functional colors to the color slot', () => {
      expect(run('#fff solid', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: '#fff', origin: 'explicit' },
        ],
      });
      expect(run('rgb(255, 0, 0) dashed', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderStyle', value: 'dashed', origin: 'explicit' },
          {
            property: 'borderColor',
            value: 'rgb(255, 0, 0)',
            origin: 'explicit',
          },
        ],
      });
    });

    it('accepts transparent and currentcolor in the color slot', () => {
      expect(run('transparent dotted', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderStyle', value: 'dotted', origin: 'explicit' },
          {
            property: 'borderColor',
            value: 'transparent',
            origin: 'explicit',
          },
        ],
      });
      expect(run('solid currentColor', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          {
            property: 'borderColor',
            value: 'currentColor',
            origin: 'explicit',
          },
        ],
      });
    });

    it('matches keywords case-insensitively but emits them verbatim', () => {
      expect(run('1Px SOLID red', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1Px', origin: 'explicit' },
          { property: 'borderStyle', value: 'SOLID', origin: 'explicit' },
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
      expect(run('1px solid Red', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'Red', origin: 'explicit' },
        ],
      });
    });
  });

  describe('spec output: omitted slots default', () => {
    it("defaults width to 'medium' and color to 'currentcolor'", () => {
      expect(run('solid', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: 'medium', origin: 'defaulted' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          {
            property: 'borderColor',
            value: 'currentcolor',
            origin: 'defaulted',
          },
        ],
      });
    });

    it("defaults style to 'none' when only a width is authored", () => {
      expect(run('2px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '2px', origin: 'explicit' },
          { property: 'borderStyle', value: 'none', origin: 'defaulted' },
          {
            property: 'borderColor',
            value: 'currentcolor',
            origin: 'defaulted',
          },
        ],
      });
    });
  });

  describe('minimal output: present components only', () => {
    it('emits a single authored component on its own longhand', () => {
      expect(run('solid', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
        ],
      });
      expect(run('none', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderStyle', value: 'none', origin: 'explicit' },
        ],
      });
      expect(run('thin', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: 'thin', origin: 'explicit' },
        ],
      });
    });

    it('emits two authored components without inventing the third', () => {
      expect(run('1px solid', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
        ],
      });
    });
  });

  describe('var() by slot elimination', () => {
    it('fills the single open slot with the single var()', () => {
      expect(run('1px solid var(--c)', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderWidth', value: '1px', origin: 'explicit' },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'var(--c)', origin: 'explicit' },
        ],
      });
    });

    it('keeps a var() fallback verbatim in the filled slot', () => {
      expect(run('var(--w, 2px) solid red', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'borderWidth',
            value: 'var(--w, 2px)',
            origin: 'explicit',
          },
          { property: 'borderStyle', value: 'solid', origin: 'explicit' },
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
    });

    it.each([
      ['var(--w) solid', 'one var() but two open slots'],
      ['var(--a) var(--b) solid', 'two var() components'],
      ['var(--a) var(--b) var(--c)', 'three var() components'],
      ['var(--x)', 'one var() and all three slots open'],
    ])("refuses '%s' (%s)", (value) => {
      // The boundary reclassifies this parse error as contains-variable
      // when a top-level var() is present; the def itself only reports
      // that elimination failed.
      expectParseError(run(value, { output: 'minimal' }), /var\(\)/);
    });
  });

  describe('refusals', () => {
    it('reports a duplicate slot, by name', () => {
      expectParseError(
        run('solid dotted', { output: 'minimal' }),
        /Duplicate style/,
      );
      expectParseError(
        run('1px 2px solid', { output: 'minimal' }),
        /Duplicate width/,
      );
      expectParseError(
        run('red blue', { output: 'minimal' }),
        /Duplicate color/,
      );
      expectParseError(
        run('1px solid red green', { output: 'minimal' }),
        /Duplicate color/,
      );
    });

    it('reports components no slot recognizes', () => {
      expectParseError(
        run('1px solid notacolor', { output: 'minimal' }),
        /Unexpected component/,
      );
      // A bare non-zero number is not a <line-width>; this also covers the
      // boundary's stringified-number fallback for 'border: 5'.
      expectParseError(run('5', { output: 'spec' }), /Unexpected component/);
    });

    it('refuses top-level slashes and commas', () => {
      expectParseError(
        run('10px/solid', { output: 'minimal' }),
        /Unexpected component/,
      );
      expectParseError(
        run('1px, solid', { output: 'minimal' }),
        /Unexpected component/,
      );
    });

    it('refuses an empty value', () => {
      expectParseError(run('', { output: 'spec' }), /at least one component/);
    });
  });
});

describe('border side defs (line-trio family)', () => {
  it('declares per-side longhands with no dialect mapping', () => {
    const sides = [
      ['top', borderTopDef],
      ['right', borderRightDef],
      ['bottom', borderBottomDef],
      ['left', borderLeftDef],
    ];
    for (const [side, def] of sides) {
      const Side = side[0].toUpperCase() + side.slice(1);
      expect(def.canonical).toEqual(`border-${side}`);
      expect(def.key).toEqual(`border${Side}`);
      expect(def.longhands).toEqual([
        `border${Side}Width`,
        `border${Side}Style`,
        `border${Side}Color`,
      ]);
      // The old splitter applies no preferInline mapping for physical
      // sides; kept for parity.
      expect(def.dialectMap).toEqual({});
      expect(def.runNumber).toBe(null);
      expect(def.singleComponentIsIdentity).toBe(false);
    }
  });

  it('emits authored components on the side-specific longhands', () => {
    expect(runDef(borderTopDef, '2px dashed', { output: 'minimal' })).toEqual({
      type: 'ok',
      important: false,
      assignments: [
        { property: 'borderTopWidth', value: '2px', origin: 'explicit' },
        { property: 'borderTopStyle', value: 'dashed', origin: 'explicit' },
      ],
    });
  });

  it('defaults omitted slots like border in spec output', () => {
    expect(runDef(borderLeftDef, 'red', { output: 'spec' })).toEqual({
      type: 'ok',
      important: false,
      assignments: [
        { property: 'borderLeftWidth', value: 'medium', origin: 'defaulted' },
        { property: 'borderLeftStyle', value: 'none', origin: 'defaulted' },
        { property: 'borderLeftColor', value: 'red', origin: 'explicit' },
      ],
    });
  });
});

describe('outline def (line-trio family)', () => {
  const runOutline = (value: string, options: EmitOptions) =>
    runDef(outlineDef, value, options);

  it('declares the outline longhands and auto color default', () => {
    expect(outlineDef.canonical).toEqual('outline');
    expect(outlineDef.key).toEqual('outline');
    expect(outlineDef.longhands).toEqual([
      'outlineWidth',
      'outlineStyle',
      'outlineColor',
    ]);
    expect(outlineDef.dialectMap).toEqual({});
    expect(outlineDef.runNumber).toBe(null);
    expect(outlineDef.singleComponentIsIdentity).toBe(false);
  });

  it("defaults width to 'medium', style to 'none', and color to 'auto'", () => {
    expect(runOutline('thick', { output: 'spec' })).toEqual({
      type: 'ok',
      important: false,
      assignments: [
        { property: 'outlineWidth', value: 'thick', origin: 'explicit' },
        { property: 'outlineStyle', value: 'none', origin: 'defaulted' },
        { property: 'outlineColor', value: 'auto', origin: 'defaulted' },
      ],
    });
  });

  it("classifies a lone 'auto' to the style slot", () => {
    expect(runOutline('auto', { output: 'minimal' })).toEqual({
      type: 'ok',
      important: false,
      assignments: [
        { property: 'outlineStyle', value: 'auto', origin: 'explicit' },
      ],
    });
  });

  it("classifies 'auto' to the color slot once style is filled", () => {
    expect(runOutline('solid auto', { output: 'minimal' })).toEqual({
      type: 'ok',
      important: false,
      assignments: [
        { property: 'outlineStyle', value: 'solid', origin: 'explicit' },
        { property: 'outlineColor', value: 'auto', origin: 'explicit' },
      ],
    });
    expect(runOutline('auto AUTO', { output: 'minimal' })).toEqual({
      type: 'ok',
      important: false,
      assignments: [
        { property: 'outlineStyle', value: 'auto', origin: 'explicit' },
        { property: 'outlineColor', value: 'AUTO', origin: 'explicit' },
      ],
    });
  });

  it('fills all three slots around an auto style', () => {
    expect(runOutline('1px auto red', { output: 'minimal' })).toEqual({
      type: 'ok',
      important: false,
      assignments: [
        { property: 'outlineWidth', value: '1px', origin: 'explicit' },
        { property: 'outlineStyle', value: 'auto', origin: 'explicit' },
        { property: 'outlineColor', value: 'red', origin: 'explicit' },
      ],
    });
  });

  it("reports a style keyword after 'auto' as a duplicate", () => {
    expectParseError(
      runOutline('auto dotted', { output: 'minimal' }),
      /Duplicate style/,
    );
  });

  it("refuses the legacy 'invert' color", () => {
    expectParseError(
      runOutline('invert solid', { output: 'minimal' }),
      /Unexpected component/,
    );
  });
});
