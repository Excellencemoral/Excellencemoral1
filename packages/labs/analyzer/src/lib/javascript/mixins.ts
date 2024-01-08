/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * @fileoverview
 *
 * Utilities for working with mixins
 */

import type ts from 'typescript';
import {AnalyzerInterface, MixinDeclarationInit} from '../model.js';
import {getClassDeclaration} from './classes.js';
import {createDiagnostic} from '../errors.js';
import {DiagnosticCode} from '../diagnostic-code.js';

const nodeHasMixinHint = (node: ts.Node, analyzer: AnalyzerInterface) =>
  analyzer.typescript
    .getJSDocTags(node)
    .some((tag) => tag.tagName.text === 'mixin');

const addDiagnosticIfMixin = (
  node: ts.Node,
  hasMixinHint: boolean,
  message: string,
  analyzer: AnalyzerInterface
) => {
  if (hasMixinHint) {
    analyzer.addDiagnostic(
      createDiagnostic({
        typescript: analyzer.typescript,
        node,
        message,
        code: DiagnosticCode.UNSUPPORTED,
        category: analyzer.typescript.DiagnosticCategory.Warning,
      })
    );
  }
  return undefined;
};

/**
 * If the given variable declaration was a mixin function, returns a
 * MixinDeclaration, otherwise returns undefined.
 *
 * The mixin logic requires a few important syntactic heuristics to be met in
 * order to be detected as a mixin.
 *
 * If the function is unannotated and does not match the above mixin shape, it
 * will silently just be analyzed as a simple function and not a mixin. However,
 * the `@mixin` annotation can be added to produce specific diagnostic errors
 * when a condition for being analyzed as a mixin is not met.
 */
export const maybeGetMixinFromFunctionLike = (
  fn: ts.FunctionLikeDeclaration,
  name: string,
  analyzer: AnalyzerInterface,
  hasMixinHint = nodeHasMixinHint(fn, analyzer)
): MixinDeclarationInit | undefined => {
  if (!fn.parameters || fn.parameters.length < 1) {
    addDiagnosticIfMixin(
      fn,
      hasMixinHint,
      `Expected mixin to have a superClass parameter.`,
      analyzer
    );
    return undefined;
  }
  const possibleSuperClasses = fn.parameters.map((p) =>
    analyzer.typescript.isIdentifier(p.name) ? p.name.text : ''
  );
  const functionBody = fn.body;
  if (functionBody === undefined) {
    addDiagnosticIfMixin(
      fn,
      hasMixinHint,
      `Expected mixin to have a block function body.`,
      analyzer
    );
    return undefined;
  }
  // TODO (43081j): in typescript, you currently cannot have decorators on
  // a class expression, hence why we effectively disallow them here. However,
  // we may want to loosen this constraint for JS users some day
  if (!analyzer.typescript.isBlock(functionBody)) {
    addDiagnosticIfMixin(
      fn,
      hasMixinHint,
      `Expected mixin to have a block function body; arrow-function class ` +
        `expression syntax is not supported.`,
      analyzer
    );
    return undefined;
  }
  let classDeclaration!: ts.ClassDeclaration;
  let returnStatement!: ts.ReturnStatement;
  functionBody.statements.forEach((s) => {
    if (analyzer.typescript.isClassDeclaration(s)) {
      classDeclaration = s;
    }
    if (analyzer.typescript.isReturnStatement(s)) {
      returnStatement = s;
    }
  });
  if (!classDeclaration) {
    addDiagnosticIfMixin(
      fn,
      hasMixinHint,
      `Expected mixin to contain a class declaration statement.`,
      analyzer
    );
    return undefined;
  }
  if (!returnStatement) {
    addDiagnosticIfMixin(
      fn,
      hasMixinHint,
      `Expected mixin to contain a return statement returning a class.`,
      analyzer
    );
    return undefined;
  }
  const extendsClause = classDeclaration.heritageClauses?.find(
    (c) => c.token === analyzer.typescript.SyntaxKind.ExtendsKeyword
  );
  if (extendsClause === undefined) {
    addDiagnosticIfMixin(
      fn,
      hasMixinHint,
      `Expected mixin to contain class declaration extending a superClass argument to function.`,
      analyzer
    );
    return undefined;
  }
  if (extendsClause.types.length !== 1) {
    analyzer.addDiagnostic(
      createDiagnostic({
        typescript: analyzer.typescript,
        node: extendsClause,
        message:
          'Internal error: did not expect a mixin class extends clause to have multiple types',
        code: DiagnosticCode.UNSUPPORTED,
        category: analyzer.typescript.DiagnosticCategory.Warning,
      })
    );
    return undefined;
  }
  const superClassArgIdx = findSuperClassArgIndexFromHeritage(
    possibleSuperClasses,
    extendsClause.types[0].expression,
    analyzer
  );
  if (superClassArgIdx < 0) {
    analyzer.addDiagnostic(
      createDiagnostic({
        typescript: analyzer.typescript,
        node: extendsClause,
        message:
          'Did not find a "superClass" argument used in the extends clause of mixin class.',
        code: DiagnosticCode.UNSUPPORTED,
        category: analyzer.typescript.DiagnosticCategory.Warning,
      })
    );
    return undefined;
  }

  const classDeclarationName = classDeclaration.name?.text ?? name;

  return {
    node: fn,
    name,
    superClassArgIdx,
    classDeclaration: getClassDeclaration(
      classDeclaration,
      classDeclarationName,
      analyzer,
      undefined,
      true /* isMixinClass */
    ),
  };
};

const findSuperClassArgIndexFromHeritage = (
  possibleSuperClasses: string[],
  expression: ts.Expression,
  analyzer: AnalyzerInterface
): number => {
  if (analyzer.typescript.isIdentifier(expression)) {
    return possibleSuperClasses.indexOf(expression.text);
  } else if (analyzer.typescript.isCallExpression(expression)) {
    for (const arg of expression.arguments) {
      const index = findSuperClassArgIndexFromHeritage(
        possibleSuperClasses,
        arg,
        analyzer
      );
      if (index >= 0) {
        return index;
      }
    }
  }
  return -1;
};
