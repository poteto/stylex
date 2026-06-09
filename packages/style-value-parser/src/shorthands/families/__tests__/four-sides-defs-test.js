/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ShorthandDef } from '../../define';
import type { EmitOptions } from '../../types';

import { TokenList } from '../../../token-types';
import { marginDef } from '../../../properties/margin';
import { paddingDef } from '../../../properties/padding';
import { insetDef } from '../../../properties/inset';
import { scrollMarginDef } from '../../../properties/scroll-margin';
import { scrollPaddingDef } from '../../../properties/scroll-padding';
import { borderWidthDef } from '../../../properties/border-width';
import { borderStyleDef } from '../../../properties/border-style';
import { borderColorDef } from '../../../properties/border-color';

function run(def: ShorthandDef, value: string, options: EmitOptions) {
  return def.run(new TokenList(value), options);
}

describe('four-sides defs', () => {
  describe('def metadata', () => {
    it('exposes spec-ordered longhands per def', () => {
      expect(paddingDef.longhands).toEqual([
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
      ]);
      expect(insetDef.longhands).toEqual(['top', 'right', 'bottom', 'left']);
      expect(scrollMarginDef.longhands).toEqual([
        'scrollMarginTop',
        'scrollMarginRight',
        'scrollMarginBottom',
        'scrollMarginLeft',
      ]);
      expect(scrollPaddingDef.longhands).toEqual([
        'scrollPaddingTop',
        'scrollPaddingRight',
        'scrollPaddingBottom',
        'scrollPaddingLeft',
      ]);
      expect(borderWidthDef.longhands).toEqual([
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
      ]);
      expect(borderStyleDef.longhands).toEqual([
        'borderTopStyle',
        'borderRightStyle',
        'borderBottomStyle',
        'borderLeftStyle',
      ]);
      expect(borderColorDef.longhands).toEqual([
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
      ]);
    });

    it('carries the preferInline dialect maps as data', () => {
      expect(paddingDef.dialectMap).toEqual({
        paddingRight: 'paddingInlineEnd',
        paddingLeft: 'paddingInlineStart',
      });
      expect(insetDef.dialectMap).toEqual({
        right: 'insetInlineEnd',
        left: 'insetInlineStart',
      });
      expect(scrollMarginDef.dialectMap).toEqual({
        scrollMarginRight: 'scrollMarginInlineEnd',
        scrollMarginLeft: 'scrollMarginInlineStart',
      });
      expect(scrollPaddingDef.dialectMap).toEqual({
        scrollPaddingRight: 'scrollPaddingInlineEnd',
        scrollPaddingLeft: 'scrollPaddingInlineStart',
      });
      expect(borderWidthDef.dialectMap).toEqual({
        borderRightWidth: 'borderInlineEndWidth',
        borderLeftWidth: 'borderInlineStartWidth',
      });
      expect(borderStyleDef.dialectMap).toEqual({
        borderRightStyle: 'borderInlineEndStyle',
        borderLeftStyle: 'borderInlineStartStyle',
      });
      expect(borderColorDef.dialectMap).toEqual({
        borderRightColor: 'borderInlineEndColor',
        borderLeftColor: 'borderInlineStartColor',
      });
    });
  });

  describe('padding', () => {
    it('condenses two values to the block/inline pair', () => {
      expect(run(paddingDef, '10px 20%', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'paddingBlock', value: '10px', origin: 'explicit' },
          { property: 'paddingInline', value: '20%', origin: 'explicit' },
        ],
      });
    });

    it('refuses auto (not part of the padding grammar)', () => {
      const result = run(paddingDef, 'auto 10px', { output: 'minimal' });
      expect(result.type).toEqual('cannot-expand');
    });

    it('accepts calc() and var() components', () => {
      expect(
        run(paddingDef, 'calc(0.75rem + 3px) var(--y)', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'paddingBlock',
            value: 'calc(0.75rem + 3px)',
            origin: 'explicit',
          },
          { property: 'paddingInline', value: 'var(--y)', origin: 'explicit' },
        ],
      });
    });

    it('expands a single value to all four longhands in spec output', () => {
      expect(run(paddingDef, '4px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'paddingTop', value: '4px', origin: 'explicit' },
          { property: 'paddingRight', value: '4px', origin: 'replicated' },
          { property: 'paddingBottom', value: '4px', origin: 'replicated' },
          { property: 'paddingLeft', value: '4px', origin: 'replicated' },
        ],
      });
    });
  });

  describe('inset', () => {
    it('expands onto the CSS top/right/bottom/left longhands', () => {
      expect(run(insetDef, '1px 2px 3px 4px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'top', value: '1px', origin: 'explicit' },
          { property: 'right', value: '2px', origin: 'explicit' },
          { property: 'bottom', value: '3px', origin: 'explicit' },
          { property: 'left', value: '4px', origin: 'explicit' },
        ],
      });
    });

    it('accepts auto components', () => {
      expect(run(insetDef, 'auto 10px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'insetBlock', value: 'auto', origin: 'explicit' },
          { property: 'insetInline', value: '10px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('scroll-margin', () => {
    it('condenses two values to the block/inline pair', () => {
      expect(run(scrollMarginDef, '10px 2em', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'scrollMarginBlock', value: '10px', origin: 'explicit' },
          { property: 'scrollMarginInline', value: '2em', origin: 'explicit' },
        ],
      });
    });

    it('refuses percentages (scroll-margin is length-only)', () => {
      const result = run(scrollMarginDef, '10% 5px', { output: 'minimal' });
      expect(result.type).toEqual('cannot-expand');
    });

    it('refuses auto', () => {
      const result = run(scrollMarginDef, 'auto 5px', { output: 'minimal' });
      expect(result.type).toEqual('cannot-expand');
    });
  });

  describe('scroll-padding', () => {
    it('accepts percentages and auto', () => {
      expect(run(scrollPaddingDef, '10% auto', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'scrollPaddingBlock', value: '10%', origin: 'explicit' },
          {
            property: 'scrollPaddingInline',
            value: 'auto',
            origin: 'explicit',
          },
        ],
      });
    });
  });

  describe('border-width (expanded-quad pairing)', () => {
    it('accepts line-width keywords', () => {
      expect(run(borderWidthDef, 'thin thick', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderBlockWidth', value: 'thin', origin: 'explicit' },
          { property: 'borderInlineWidth', value: 'thick', origin: 'explicit' },
        ],
      });
    });

    it('pairs a 4-value input whose expanded quad is block/inline equal', () => {
      expect(
        run(borderWidthDef, '1px 2px 1px 2px', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderBlockWidth', value: '1px', origin: 'explicit' },
          { property: 'borderInlineWidth', value: '2px', origin: 'explicit' },
        ],
      });
    });

    it('pairs a 3-value input whose expanded quad is block/inline equal', () => {
      expect(run(borderWidthDef, '1px 2px 1px', { output: 'minimal' })).toEqual(
        {
          type: 'ok',
          important: false,
          assignments: [
            { property: 'borderBlockWidth', value: '1px', origin: 'explicit' },
            { property: 'borderInlineWidth', value: '2px', origin: 'explicit' },
          ],
        },
      );
    });

    it('emits four physical longhands when the quad does not pair', () => {
      expect(run(borderWidthDef, '1px 2px 3px', { output: 'minimal' })).toEqual(
        {
          type: 'ok',
          important: false,
          assignments: [
            { property: 'borderTopWidth', value: '1px', origin: 'explicit' },
            { property: 'borderRightWidth', value: '2px', origin: 'explicit' },
            {
              property: 'borderBottomWidth',
              value: '3px',
              origin: 'explicit',
            },
            {
              property: 'borderLeftWidth',
              value: '2px',
              origin: 'replicated',
            },
          ],
        },
      );
    });

    it('collapses all-identical multivalue input onto borderWidth', () => {
      expect(run(borderWidthDef, '1px 1px 1px', { output: 'minimal' })).toEqual(
        {
          type: 'ok',
          important: false,
          assignments: [
            { property: 'borderWidth', value: '1px', origin: 'explicit' },
          ],
        },
      );
    });

    it('expands numbers in spec output', () => {
      expect(borderWidthDef.runNumber?.(2, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopWidth', value: 2, origin: 'explicit' },
          { property: 'borderRightWidth', value: 2, origin: 'replicated' },
          { property: 'borderBottomWidth', value: 2, origin: 'replicated' },
          { property: 'borderLeftWidth', value: 2, origin: 'replicated' },
        ],
      });
    });
  });

  describe('pairing-mode contrast: directional vs expanded-quad', () => {
    it('margin emits four longhands for the 4-value block/inline-equal form', () => {
      expect(run(marginDef, '1px 2px 1px 2px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '1px', origin: 'explicit' },
          { property: 'marginRight', value: '2px', origin: 'explicit' },
          { property: 'marginBottom', value: '1px', origin: 'explicit' },
          { property: 'marginLeft', value: '2px', origin: 'explicit' },
        ],
      });
    });
  });

  describe('border-style', () => {
    it('condenses two keyword values to the block/inline pair', () => {
      expect(
        run(borderStyleDef, 'solid dashed', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderBlockStyle', value: 'solid', origin: 'explicit' },
          {
            property: 'borderInlineStyle',
            value: 'dashed',
            origin: 'explicit',
          },
        ],
      });
    });

    it('emits four physical longhands for distinct quads', () => {
      expect(
        run(borderStyleDef, 'none hidden dotted dashed', { output: 'spec' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderTopStyle', value: 'none', origin: 'explicit' },
          { property: 'borderRightStyle', value: 'hidden', origin: 'explicit' },
          {
            property: 'borderBottomStyle',
            value: 'dotted',
            origin: 'explicit',
          },
          { property: 'borderLeftStyle', value: 'dashed', origin: 'explicit' },
        ],
      });
    });

    it('has no number fast path', () => {
      expect(borderStyleDef.runNumber).toBe(null);
    });

    it('refuses lengths', () => {
      const result = run(borderStyleDef, '1px solid', { output: 'minimal' });
      expect(result.type).toEqual('cannot-expand');
    });
  });

  describe('border-color', () => {
    it('condenses two values to the block/inline pair', () => {
      expect(run(borderColorDef, 'red blue', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderBlockColor', value: 'red', origin: 'explicit' },
          { property: 'borderInlineColor', value: 'blue', origin: 'explicit' },
        ],
      });
    });

    it('keeps hash and functional colors verbatim', () => {
      expect(
        run(borderColorDef, '#fff rgb(0, 10, 20)', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderBlockColor', value: '#fff', origin: 'explicit' },
          {
            property: 'borderInlineColor',
            value: 'rgb(0, 10, 20)',
            origin: 'explicit',
          },
        ],
      });
    });

    it('collapses all-identical multivalue input onto borderColor', () => {
      expect(
        run(borderColorDef, 'red red red red', { output: 'minimal' }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'borderColor', value: 'red', origin: 'explicit' },
        ],
      });
    });

    it('has no number fast path', () => {
      expect(borderColorDef.runNumber).toBe(null);
    });
  });
});
