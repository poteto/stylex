/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { EmitOptions, ExpandResult } from '../../shorthands/types';

import { TokenList } from '../../token-types';
import { gridTemplateDef } from '../grid-template';

function run(value: string, options: EmitOptions): ExpandResult {
  return gridTemplateDef.run(new TokenList(value), options);
}

function expectParseError(result: ExpandResult, message?: RegExp) {
  expect(result.type).toEqual('cannot-expand');
  if (result.type === 'cannot-expand') {
    expect(result.reason.kind).toEqual('parse-error');
    if (message != null && result.reason.kind === 'parse-error') {
      expect(result.reason.message).toMatch(message);
    }
  }
}

describe('grid-template def', () => {
  describe('def metadata', () => {
    it('declares rows before columns (spec order)', () => {
      expect(gridTemplateDef.key).toEqual('gridTemplate');
      expect(gridTemplateDef.longhands).toEqual([
        'gridTemplateRows',
        'gridTemplateColumns',
      ]);
      expect(gridTemplateDef.runNumber).toBe(null);
      expect(gridTemplateDef.singleComponentIsIdentity).toBe(true);
    });
  });

  describe('the rows / columns form', () => {
    it('relocates each side verbatim, joined with single spaces', () => {
      const expected = {
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'gridTemplateRows',
            value: '1fr auto',
            origin: 'explicit',
          },
          {
            property: 'gridTemplateColumns',
            value: '200px 1fr',
            origin: 'explicit',
          },
        ],
      };
      expect(run('1fr auto / 200px 1fr', { output: 'spec' })).toEqual(expected);
      expect(run('1fr   auto / 200px  1fr', { output: 'minimal' })).toEqual(
        expected,
      );
    });

    it('keeps track functions and line-name brackets intact', () => {
      expect(
        run('repeat(2, minmax(100px, 1fr)) / [line1] auto', {
          output: 'minimal',
        }),
      ).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'gridTemplateRows',
            value: 'repeat(2, minmax(100px, 1fr))',
            origin: 'explicit',
          },
          {
            property: 'gridTemplateColumns',
            value: '[line1] auto',
            origin: 'explicit',
          },
        ],
      });
    });
  });

  describe("the 'none' form", () => {
    it('fans the authored keyword out to both longhands in spec output', () => {
      expect(run('none', { output: 'spec' })).toEqual({
        type: 'ok',
        important: false,
        assignments: [
          {
            property: 'gridTemplateRows',
            value: 'none',
            origin: 'replicated',
          },
          {
            property: 'gridTemplateColumns',
            value: 'none',
            origin: 'replicated',
          },
        ],
      });
    });

    it('matches case-insensitively and keeps the slice verbatim', () => {
      const result = run('NONE', { output: 'spec' });
      expect(result.type).toEqual('ok');
      if (result.type === 'ok') {
        expect(result.assignments.map((a) => a.value)).toEqual([
          'NONE',
          'NONE',
        ]);
      }
    });
  });

  describe('the areas form', () => {
    it('refuses any string token as a typed unsupported-feature', () => {
      for (const value of [
        '"a b" 1fr / auto',
        '"a" "b"',
        '[header-top] "a a a" [header-bottom] / auto 1fr auto',
      ]) {
        expect(run(value, { output: 'spec' })).toEqual({
          type: 'cannot-expand',
          reason: { kind: 'unsupported-feature', feature: 'template-areas' },
        });
      }
    });
  });

  describe('refusals', () => {
    it("refuses slashless forms other than 'none'", () => {
      expectParseError(run('1fr auto', { output: 'spec' }), /slash/);
      expectParseError(run('1fr', { output: 'spec' }), /slash/);
    });

    it('refuses empty sides and more than two groups', () => {
      expectParseError(run('1fr /', { output: 'spec' }), /track list/);
      expectParseError(run('/ 1fr', { output: 'spec' }), /track list/);
      expectParseError(run('1fr / auto / 1fr', { output: 'spec' }));
    });

    it('refuses an empty value', () => {
      expectParseError(run('', { output: 'spec' }), /at least one component/);
    });
  });
});
