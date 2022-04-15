/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {test} from 'uvu';
// eslint-disable-next-line import/extensions
import * as assert from 'uvu/assert';
import ts from 'typescript';
import * as path from 'path';
import {fileURLToPath} from 'url';

import {Analyzer} from '../lib/analyzer.js';

test('Basic elements - isLitElement', () => {
  const basicElementsPackagePath = fileURLToPath(
    new URL('../test-files/basic-elements', import.meta.url).href
  );
  const analyzer = new Analyzer(basicElementsPackagePath);
  const rootFileNames = analyzer.program.getRootFileNames();
  assert.equal(rootFileNames.length, 2);

  const elementAPath = path.resolve(
    basicElementsPackagePath,
    'src/element-a.ts'
  );
  const sourceFile = analyzer.program.getSourceFile(elementAPath);
  assert.ok(sourceFile);

  const elementADeclaration = sourceFile.statements.find(
    (s) => ts.isClassDeclaration(s) && s.name?.getText() === 'ElementA'
  );
  assert.ok(elementADeclaration);

  assert.equal(analyzer.isLitElement(elementADeclaration), true);
});

test.run();
