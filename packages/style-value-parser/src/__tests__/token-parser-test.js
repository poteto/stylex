/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { TokenParser, lazyParseError } from '../token-parser';

describe('TokenParser', () => {
  describe('lazy failure messages', () => {
    it('does not build messages for failures a later alternative recovers from', () => {
      let builds = 0;
      const failing = new TokenParser((): string | Error =>
        lazyParseError(() => {
          builds++;
          return 'expensive failure';
        }),
      );
      const parser = TokenParser.oneOf(
        failing,
        TokenParser.string('foo' as 'foo'),
      );
      expect(parser.parseToEnd('foo')).toEqual('foo');
      expect(builds).toBe(0);
    });

    it('does not build inner messages when a failed oneOf is itself swallowed', () => {
      let builds = 0;
      const failing = new TokenParser((): string | Error =>
        lazyParseError(() => {
          builds++;
          return 'expensive failure';
        }),
      );
      const parser = TokenParser.oneOf(
        TokenParser.oneOf(failing),
        TokenParser.string('foo' as 'foo'),
      );
      expect(parser.parseToEnd('foo')).toEqual('foo');
      expect(builds).toBe(0);
    });

    it('builds the message exactly once when surfaced, then reuses it', () => {
      let builds = 0;
      const failing = new TokenParser((): string | Error =>
        lazyParseError(() => {
          builds++;
          return 'expensive failure';
        }),
      );
      const result = failing.parse('foo');
      expect(result instanceof Error).toBe(true);
      expect(builds).toBe(0);
      if (result instanceof Error) {
        expect(result.message).toBe('expensive failure');
        expect(result.message).toBe('expensive failure');
        expect(result.toString()).toBe('Error: expensive failure');
      }
      expect(builds).toBe(1);
    });

    it('composes a surfaced oneOf message from its alternatives unchanged', () => {
      let builds = 0;
      const failing = new TokenParser((): string | Error =>
        lazyParseError(() => {
          builds++;
          return 'expensive failure';
        }),
      );
      const parser = TokenParser.oneOf(
        failing,
        TokenParser.string('foo' as 'foo'),
      );
      const result = parser.parse('baz');
      expect(result instanceof Error).toBe(true);
      expect(builds).toBe(0);
      if (result instanceof Error) {
        expect(result.message).toBe(
          'No parser matched\n- Error: expensive failure\n- Error: Never',
        );
      }
      expect(builds).toBe(1);
    });
  });

  describe('oneOf', () => {
    it('parses the first parser', () => {
      const parser = TokenParser.oneOf(
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'foo' => value === 'foo',
        ),
        TokenParser.tokens.Number.map((token) => token[4].value),
      );
      expect(parser.parseToEnd('foo')).toEqual('foo');
      expect(parser.parseToEnd('123')).toEqual(123);
    });

    it('fails to parse a different string', () => {
      const parser = TokenParser.oneOf(
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'foo' => value === 'foo',
        ),
        TokenParser.tokens.Number.map((token) => token[4].value),
      );
      expect(parser.parse('baz') instanceof Error).toBe(true);
    });
  });

  describe('sequence', () => {
    it('parses a sequence', () => {
      const parser = TokenParser.sequence(
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'foo' => value === 'foo',
        ),
        TokenParser.tokens.Whitespace,
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'baz' => value === 'baz',
        ),
      ).map(([foo, _whitespace, baz]) => [foo, baz]);
      expect(parser.parseToEnd('foo baz')).toEqual(['foo', 'baz']);
    });

    it('parses a sequence separated by whitespace', () => {
      const parser = TokenParser.sequence(
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'foo' => value === 'foo',
        ),
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'bar' => value === 'bar',
        ),
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'baz' => value === 'baz',
        ),
      ).separatedBy(TokenParser.tokens.Whitespace);
      expect(parser.parseToEnd('foo bar baz')).toEqual(['foo', 'bar', 'baz']);
    });

    it('makes separators optional for optional parsers', () => {
      const parser = TokenParser.sequence(
        TokenParser.string('foo' as 'foo'),
        TokenParser.string('bar' as 'bar').optional,
        TokenParser.string('baz' as 'baz'),
      ).separatedBy(TokenParser.tokens.Whitespace);

      expect(parser.parseToEnd('foo bar baz')).toEqual(['foo', 'bar', 'baz']);
      expect(parser.parseToEnd('foo baz')).toEqual(['foo', undefined, 'baz']);
    });

    it('parses a sequence separated commas and optional whitespace', () => {
      const parser = TokenParser.sequence(
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'foo' => value === 'foo',
        ),
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'bar' => value === 'bar',
        ),
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'baz' => value === 'baz',
        ),
      )
        .separatedBy(TokenParser.tokens.Comma)
        .separatedBy(TokenParser.tokens.Whitespace.optional);
      expect(parser.parseToEnd('foo, bar, baz')).toEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('set', () => {
    it('parses a set', () => {
      const parser = TokenParser.setOf(
        TokenParser.string('foo' as 'foo'),
        TokenParser.string('baz' as 'baz'),
      ).separatedBy(TokenParser.tokens.Whitespace);

      expect(parser.parseToEnd('foo baz')).toEqual(['foo', 'baz']);

      expect(parser.parseToEnd('baz foo')).toEqual(['foo', 'baz']);
    });

    it('parses a set with double separators', () => {
      const parser = TokenParser.setOf(
        TokenParser.string('foo' as 'foo'),
        TokenParser.string('baz' as 'baz'),
      )
        .separatedBy(TokenParser.tokens.Comma)
        .separatedBy(TokenParser.tokens.Whitespace.optional);

      expect(parser.parseToEnd('foo,baz')).toEqual(['foo', 'baz']);
      expect(parser.parseToEnd('foo, baz')).toEqual(['foo', 'baz']);
      expect(parser.parseToEnd('foo   , baz')).toEqual(['foo', 'baz']);
      expect(parser.parseToEnd('foo   ,baz')).toEqual(['foo', 'baz']);

      expect(parser.parseToEnd('baz,foo')).toEqual(['foo', 'baz']);
      expect(parser.parseToEnd('baz, foo')).toEqual(['foo', 'baz']);
      expect(parser.parseToEnd('baz   , foo')).toEqual(['foo', 'baz']);
      expect(parser.parseToEnd('baz   ,foo')).toEqual(['foo', 'baz']);
    });

    it('makes separators optional for optional parsers', () => {
      const parser = TokenParser.setOf(
        TokenParser.string('foo' as 'foo'),
        TokenParser.string('bar' as 'bar').optional,
        TokenParser.string('baz' as 'baz'),
      ).separatedBy(TokenParser.tokens.Whitespace);

      expect(parser.parseToEnd('foo bar baz')).toEqual(['foo', 'bar', 'baz']);
      expect(parser.parseToEnd('foo baz bar')).toEqual(['foo', 'bar', 'baz']);
      expect(parser.parseToEnd('bar foo baz')).toEqual(['foo', 'bar', 'baz']);
      expect(parser.parseToEnd('bar baz foo')).toEqual(['foo', 'bar', 'baz']);
      expect(parser.parseToEnd('baz bar foo')).toEqual(['foo', 'bar', 'baz']);
      expect(parser.parseToEnd('baz foo bar')).toEqual(['foo', 'bar', 'baz']);

      expect(parser.parseToEnd('foo baz')).toEqual(['foo', undefined, 'baz']);
      expect(parser.parseToEnd('baz foo')).toEqual(['foo', undefined, 'baz']);
    });
  });

  describe('oneOrMore', () => {
    it('parses one or more', () => {
      const parser = TokenParser.oneOrMore(
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'foo' => value === 'foo',
        ),
      ).separatedBy(TokenParser.tokens.Whitespace);
      expect(parser.parseToEnd('foo')).toEqual(['foo']);
      expect(parser.parseToEnd('foo foo')).toEqual(['foo', 'foo']);
      expect(parser.parseToEnd('foo foo foo')).toEqual(['foo', 'foo', 'foo']);
      expect(parser.parseToEnd('foo foo foo foo')).toEqual([
        'foo',
        'foo',
        'foo',
        'foo',
      ]);
      expect(parser.parseToEnd('foo foo foo foo foo')).toEqual([
        'foo',
        'foo',
        'foo',
        'foo',
        'foo',
      ]);
    });

    it('fails to parse a different string', () => {
      const parser = TokenParser.oneOrMore(
        TokenParser.tokens.Ident.map((token) => token[4].value).where(
          (value): implies value is 'foo' => value === 'foo',
        ),
      ).separatedBy(TokenParser.tokens.Whitespace);
      expect(parser.parse('bar') instanceof Error).toBe(true);
    });
  });

  describe('zeroOrMore', () => {
    it('parses zero or more', () => {
      const parser = TokenParser.zeroOrMore(
        TokenParser.string('foo' as 'foo'),
      ).separatedBy(TokenParser.tokens.Whitespace);

      expect(parser.parse('')).toEqual([]);
      expect(parser.parse('foo')).toEqual(['foo']);
      expect(parser.parse('foo foo')).toEqual(['foo', 'foo']);
      expect(parser.parse('foo foo foo')).toEqual(['foo', 'foo', 'foo']);
      expect(parser.parse('foo foo foo bar')).toEqual(['foo', 'foo', 'foo']);
      expect(parser.parse('foo foo foo for')).toEqual(['foo', 'foo', 'foo']);
    });
  });

  describe('sourced', () => {
    it('captures the verbatim source text of a single token', () => {
      const parser = TokenParser.sourced(
        TokenParser.tokens.Ident.map((token) => token[4].value),
      );
      expect(parser.parseToEnd('foo')).toEqual({ value: 'foo', raw: 'foo' });
    });

    it('preserves the authored casing of the consumed text', () => {
      const parser = TokenParser.sourced(
        TokenParser.tokens.Dimension.map((token) => token[4].value),
      );
      expect(parser.parseToEnd('10PX')).toEqual({ value: 10, raw: '10PX' });
    });

    it('captures multi-token spans including interior whitespace verbatim', () => {
      const parser = TokenParser.sourced(
        TokenParser.sequence(
          TokenParser.string('foo' as 'foo'),
          TokenParser.string('bar' as 'bar'),
        ).separatedBy(TokenParser.tokens.Whitespace),
      );
      expect(parser.parseToEnd('foo   bar')).toEqual({
        value: ['foo', 'bar'],
        raw: 'foo   bar',
      });
    });

    it('captures only its own span when composed in a sequence', () => {
      const parser = TokenParser.sequence(
        TokenParser.sourced(TokenParser.tokens.Dimension.map(() => undefined)),
        TokenParser.sourced(TokenParser.tokens.Dimension.map(() => undefined)),
      ).separatedBy(TokenParser.tokens.Whitespace);
      expect(parser.parseToEnd('10px   20px').map((s) => s.raw)).toEqual([
        '10px',
        '20px',
      ]);
    });

    it('captures only the winning alternative after backtracking', () => {
      const parser = TokenParser.sourced(
        TokenParser.oneOf(
          TokenParser.sequence(
            TokenParser.string('foo' as 'foo'),
            TokenParser.string('bar' as 'bar'),
          ).separatedBy(TokenParser.tokens.Whitespace),
          TokenParser.string('foo' as 'foo'),
        ),
      );
      expect(parser.parseToEnd('foo')).toEqual({ value: 'foo', raw: 'foo' });
    });

    it('propagates failure and restores the input position', () => {
      const sourcedFoo = TokenParser.sourced(
        TokenParser.string('foo' as 'foo'),
      );
      expect(sourcedFoo.parse('baz') instanceof Error).toBe(true);

      const fallback = sourcedFoo.or(
        TokenParser.sourced(TokenParser.string('baz' as 'baz')),
      );
      expect(fallback.parseToEnd('baz')).toEqual({ value: 'baz', raw: 'baz' });
    });
  });
});
