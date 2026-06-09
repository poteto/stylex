/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { EmitOptions } from '../../types';

import { TokenList } from '../../../token-types';
import { marginDef } from '../../../properties/margin';

function run(value: string, options: EmitOptions) {
  return marginDef.run(new TokenList(value), options);
}

describe('four-sides family (via the margin def)', () => {
  describe('def metadata', () => {
    it('exposes spec-ordered longhands', () => {
      expect(marginDef.key).toEqual('margin');
      expect(marginDef.canonical).toEqual('margin');
      expect(marginDef.longhands).toEqual([
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
      ]);
    });

    it('carries the physical-to-logical dialect map as data', () => {
      expect(marginDef.dialectMap).toEqual({
        marginRight: 'marginInlineEnd',
        marginLeft: 'marginInlineStart',
      });
    });
  });

  describe('spec output: every longhand, TRBL fill replicated', () => {
    it('replicates a single value to all four sides', () => {
      expect(run('10px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '10px', origin: 'explicit' },
          { property: 'marginRight', value: '10px', origin: 'replicated' },
          { property: 'marginBottom', value: '10px', origin: 'replicated' },
          { property: 'marginLeft', value: '10px', origin: 'replicated' },
        ],
      });
    });

    it('fills bottom from top and left from right for two values', () => {
      expect(run('10px 20px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '10px', origin: 'explicit' },
          { property: 'marginRight', value: '20px', origin: 'explicit' },
          { property: 'marginBottom', value: '10px', origin: 'replicated' },
          { property: 'marginLeft', value: '20px', origin: 'replicated' },
        ],
      });
    });

    it('fills left from right for three values', () => {
      expect(run('1px 2px 3px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '1px', origin: 'explicit' },
          { property: 'marginRight', value: '2px', origin: 'explicit' },
          { property: 'marginBottom', value: '3px', origin: 'explicit' },
          { property: 'marginLeft', value: '2px', origin: 'replicated' },
        ],
      });
    });

    it('marks all four values explicit when authored', () => {
      expect(run('1px 2px 3px 4px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '1px', origin: 'explicit' },
          { property: 'marginRight', value: '2px', origin: 'explicit' },
          { property: 'marginBottom', value: '3px', origin: 'explicit' },
          { property: 'marginLeft', value: '4px', origin: 'explicit' },
        ],
      });
    });

    it('always emits in the spec-ordered longhand order', () => {
      for (const value of [
        '9px',
        '9px 8px',
        '9px 8px 7px',
        '9px 8px 7px 6px',
      ]) {
        const result = run(value, { output: 'spec' });
        if (result.type !== 'ok') {
          throw new Error(`expected ok for '${value}', got ${result.type}`);
        }
        expect(result.assignments.map((a) => a.property)).toEqual(
          marginDef.longhands,
        );
      }
    });
  });

  describe('minimal output: directional-transformer condensation', () => {
    it('treats a single value as a no-op', () => {
      expect(run('10px', { output: 'minimal' })).toEqual({ type: 'no-op' });
    });

    it('collapses all-identical multivalue input to the shorthand key', () => {
      const collapsed = {
        type: 'ok',
        important: false,
        assignments: [
          { property: 'margin', value: '10px', origin: 'explicit' },
        ],
      };
      expect(run('10px 10px', { output: 'minimal' })).toEqual(collapsed);
      expect(run('10px 10px 10px', { output: 'minimal' })).toEqual(collapsed);
      expect(run('10px 10px 10px 10px', { output: 'minimal' })).toEqual(
        collapsed,
      );
    });

    it('compares values verbatim, so differing case is not collapsed', () => {
      expect(run('10px 10PX', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: '10px', origin: 'explicit' },
          { property: 'marginInline', value: '10PX', origin: 'explicit' },
        ],
      });
    });

    it('condenses two values to the block/inline pair', () => {
      expect(run('10em 1em', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: '10em', origin: 'explicit' },
          { property: 'marginInline', value: '1em', origin: 'explicit' },
        ],
      });
    });

    it('expands three values to four physical longhands', () => {
      expect(run('1px 2px 3px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '1px', origin: 'explicit' },
          { property: 'marginRight', value: '2px', origin: 'explicit' },
          { property: 'marginBottom', value: '3px', origin: 'explicit' },
          { property: 'marginLeft', value: '2px', origin: 'replicated' },
        ],
      });
    });

    it('expands four values to four physical longhands', () => {
      expect(run('10em 1em 5em 2em', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '10em', origin: 'explicit' },
          { property: 'marginRight', value: '1em', origin: 'explicit' },
          { property: 'marginBottom', value: '5em', origin: 'explicit' },
          { property: 'marginLeft', value: '2em', origin: 'explicit' },
        ],
      });
    });
  });

  describe('verbatim value slices', () => {
    it('preserves authored casing', () => {
      expect(run('10PX 20px', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: '10PX', origin: 'explicit' },
          { property: 'marginRight', value: '20px', origin: 'explicit' },
          { property: 'marginBottom', value: '10PX', origin: 'replicated' },
          { property: 'marginLeft', value: '20px', origin: 'replicated' },
        ],
      });
    });

    it('preserves interior spacing of calc() components', () => {
      expect(run('calc( 1px + 2% ) auto', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginBlock',
            value: 'calc( 1px + 2% )',
            origin: 'explicit',
          },
          { property: 'marginInline', value: 'auto', origin: 'explicit' },
        ],
      });
    });

    it('accepts calc() alongside plain components', () => {
      expect(run('calc(1px + 2%) 10px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginBlock',
            value: 'calc(1px + 2%)',
            origin: 'explicit',
          },
          { property: 'marginInline', value: '10px', origin: 'explicit' },
        ],
      });
    });

    it('passes a top-level var() through as exactly one component', () => {
      expect(run('var(--x) 10px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: 'var(--x)', origin: 'explicit' },
          { property: 'marginInline', value: '10px', origin: 'explicit' },
        ],
      });
    });

    it('keeps var() fallbacks intact inside the single component', () => {
      expect(run('var(--x, 5px) 10px', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'marginBlock',
            value: 'var(--x, 5px)',
            origin: 'explicit',
          },
          { property: 'marginInline', value: '10px', origin: 'explicit' },
        ],
      });
    });

    it('accepts auto and zero-length components', () => {
      expect(run('0 auto', { output: 'minimal' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginBlock', value: '0', origin: 'explicit' },
          { property: 'marginInline', value: 'auto', origin: 'explicit' },
        ],
      });
    });
  });

  describe('numeric values', () => {
    it('expands a number to all four longhands in spec output', () => {
      expect(marginDef.runNumber?.(10, { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          { property: 'marginTop', value: 10, origin: 'explicit' },
          { property: 'marginRight', value: 10, origin: 'replicated' },
          { property: 'marginBottom', value: 10, origin: 'replicated' },
          { property: 'marginLeft', value: 10, origin: 'replicated' },
        ],
      });
    });

    it('treats a number as a single component no-op in minimal output', () => {
      expect(marginDef.runNumber?.(10, { output: 'minimal' })).toEqual({
        type: 'no-op',
      });
    });
  });

  describe('refusals', () => {
    it('refuses values that do not match the grammar', () => {
      const result = run('red', { output: 'spec' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });

    it('refuses a fifth component', () => {
      const result = run('1px 2px 3px 4px 5px', { output: 'spec' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });

    it('refuses comma-separated values', () => {
      const result = run('10px, 20px', { output: 'minimal' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });

    it('refuses bare non-zero numbers in string values', () => {
      const result = run('10 20', { output: 'minimal' });
      expect(result.type).toEqual('cannot-expand');
      if (result.type === 'cannot-expand') {
        expect(result.reason.kind).toEqual('parse-error');
      }
    });
  });
});
