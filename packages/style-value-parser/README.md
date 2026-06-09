# style-value-parser

An experimental CSS value parser for StyleX. The parser is built on
`@csstools/css-tokenizer`.

We currently use `postcss-value-parser` to parse style values, which is slow,
rudimentary, and lacks customization. This package is a work-in-progress
replacement that enables stricter parsing and better control over style property
values.

## Use cases

- Parses all css types and style properties
- Provides a `toString()` method to normalize values and dedupe styles
- Stricter style validation in the ESLint plugin
- Parse and validate `@media` queries

## Shorthand expansion

The `shorthands` module expands CSS shorthand values into their longhand
declarations using the CSS spec grammars. `expandShorthand(property, value,
options)` parses the value once and returns a structured result; it never
throws on CSS input.

There are two output modes:

- `output: 'spec'` emits every longhand the shorthand controls. Components
  omitted from the value get the shorthand's defined defaults, matching the
  CSS semantics where a shorthand resets the longhands it does not mention.
- `output: 'minimal'` emits only the components the author wrote, condensed
  to the fewest keys. Omitted components are not emitted, so the result is
  not a full reset. This mode backs the ESLint autofix.

```js
import { shorthands } from 'style-value-parser';

shorthands.expandShorthand('margin', '8px 16px', { output: 'spec' });
// {
//   type: 'ok',
//   important: false,
//   assignments: [
//     { property: 'marginTop', value: '8px', origin: 'explicit' },
//     { property: 'marginRight', value: '16px', origin: 'explicit' },
//     { property: 'marginBottom', value: '8px', origin: 'replicated' },
//     { property: 'marginLeft', value: '16px', origin: 'replicated' },
//   ],
// }

shorthands.expandShorthand('margin', '8px 16px', { output: 'minimal' });
// {
//   type: 'ok',
//   important: false,
//   assignments: [
//     { property: 'marginBlock', value: '8px', origin: 'explicit' },
//     { property: 'marginInline', value: '16px', origin: 'explicit' },
//   ],
// }
```

Every call returns one of four result variants:

- `ok`: the expansion, as an ordered list of `{ property, value, origin }`
  assignments
- `not-shorthand`: the property is not a shorthand the engine knows
- `no-op`: expanding would change nothing (for example, a single-component
  value in minimal output)
- `cannot-expand`: a genuine shorthand the engine refuses to split, with a
  structured `reason`

The set of supported shorthand properties is defined in
`src/shorthands/registry.js`, which is the source of truth.

Some valid CSS is deliberately refused (`cannot-expand`) because no sound
expansion exists:

- Comma-separated multi-layer values (`background`, `animation`), since the
  layers cannot be distributed across single longhand keys
- The `grid-template` areas form
- `font` system keywords (`caption`, `menu`, etc.), which expand to
  unspecified system settings
- `var()` in positions where the engine cannot tell which longhand the
  variable belongs to
- `!important`, unless `allowImportant: true` is passed
