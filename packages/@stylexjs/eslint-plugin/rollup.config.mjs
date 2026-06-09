/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { babel } from '@rollup/plugin-babel';

const extensions = ['.js', '.jsx'];

const external = [/@babel\/traverse/, /@babel\/types/, /@babel\/core/];

const config = {
  input: './src/index.js',
  output: {
    file: './lib/index.js',
    format: 'cjs',
  },
  // The npm build keeps published dependencies external and bundles only
  // the private style-value-parser workspace package (the babel-plugin
  // convention); the haste build keeps bundling everything.
  external: process.env['HASTE']
    ? external
    : [
        ...external,
        '@csstools/css-tokenizer',
        '@stylexjs/shared',
        'micromatch',
        'postcss-value-parser',
      ],
  plugins: [
    babel({ babelHelpers: 'bundled', extensions, include: ['./src/**/*'] }),
    nodeResolve({
      extensions,
    }),
    commonjs(),
    json(),
  ],
};

export default config;
