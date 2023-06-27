/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import ts from 'typescript';
import {_$LH as litHtmlPrivate} from 'lit-html/private-ssr-support.js';
import {
  traverse,
  parseFragment,
  isCommentNode,
  isElement,
  DocumentFragment,
  isTextNode,
} from './parse5-utils.js';
import {serialize} from 'parse5';

const {getTemplateHtml, marker, markerMatch, boundAttributeSuffix} =
  litHtmlPrivate;

export const PartType = {
  ATTRIBUTE: 1,
  CHILD: 2,
  PROPERTY: 3,
  BOOLEAN_ATTRIBUTE: 4,
  EVENT: 5,
  ELEMENT: 6,
} as const;
export type PartType = (typeof PartType)[keyof typeof PartType];

const AttributePartConstructors = {
  [PartType.ATTRIBUTE]: 'AttributePart',
  [PartType.PROPERTY]: 'PropertyPart',
  [PartType.BOOLEAN_ATTRIBUTE]: 'BooleanAttributePart',
  [PartType.EVENT]: 'EventPart',
} as const;

interface TemplateInfo {
  topStatement: ts.Statement;
  node: ts.TaggedTemplateExpression;
  variableName: ts.Identifier;
}

/**
 * Add Parts constructors import.
 */
export const addPartConstructorImport = (
  node: ts.SourceFile,
  factory: ts.NodeFactory
): ts.SourceFile => {
  return factory.updateSourceFile(node, [
    ...[
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(
              false,
              factory.createIdentifier('_$LH'),
              factory.createIdentifier('litHtmlPrivate')
            ),
          ])
        ),
        factory.createStringLiteral('lit-html/private-ssr-support.js'),
        undefined
      ),
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              factory.createObjectBindingPattern([
                factory.createBindingElement(
                  undefined,
                  undefined,
                  factory.createIdentifier('AttributePart'),
                  undefined
                ),
                factory.createBindingElement(
                  undefined,
                  undefined,
                  factory.createIdentifier('PropertyPart'),
                  undefined
                ),
                factory.createBindingElement(
                  undefined,
                  undefined,
                  factory.createIdentifier('BooleanAttributePart'),
                  undefined
                ),
                factory.createBindingElement(
                  undefined,
                  undefined,
                  factory.createIdentifier('EventPart'),
                  undefined
                ),
              ]),
              undefined,
              undefined,
              factory.createIdentifier('litHtmlPrivate')
            ),
          ],
          ts.NodeFlags.Const
        )
      ),
    ],
    ...node.statements,
  ]);
};

export const compileLitTemplates = (): ts.TransformerFactory<ts.SourceFile> => {
  // Transforms a SourceFile to add top-level declarations for each lit-html
  // template in the module
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const topLevelStatementToTemplate = new Map<ts.Statement, TemplateInfo[]>();
    const expressionToTemplate = new Map<
      ts.TaggedTemplateExpression,
      TemplateInfo
    >();

    // Store the stack of open ancestor nodes from sourceFile to the
    // current node so that we can quickly get the top-level statement
    // that contains a template.
    const nodeStack: Array<ts.Node> = [];
    let shouldAddPartImports = false;
    // Only compile `html` tag if it was found in an import declaration,
    // imported from lit or lit-html.
    let shouldCompileFile = false;

    const findTemplates = <T extends ts.Node>(node: T) => {
      return ts.visitNode(node, (node: ts.Node): ts.Node => {
        nodeStack.push(node);
        // Only compile files that import html from 'lit' or 'lit-html'.
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          (node.moduleSpecifier.text === 'lit' ||
            node.moduleSpecifier.text === 'lit-html') &&
          node.importClause?.namedBindings != null &&
          ts.isNamedImports(node.importClause.namedBindings)
        ) {
          const namedBindings = node.importClause.namedBindings;
          shouldCompileFile ||= namedBindings.elements.some(
            (imp) => ts.isIdentifier(imp.name) && imp.name.text === 'html'
          );
        }
        if (isLitTemplate(node)) {
          const topStatement = nodeStack[1] as ts.Statement;
          const templateInfo = {
            topStatement,
            node,
            variableName: ts.factory.createUniqueName('lit_template'),
          };
          const templates = topLevelStatementToTemplate.get(topStatement) ?? [];
          templates.push(templateInfo);
          topLevelStatementToTemplate.set(topStatement, templates);
          expressionToTemplate.set(node, templateInfo);
          console.log('Lit', nodeStack[1].getText());
          // console.log(nodeStack.map((n) => ts.SyntaxKind[n.kind]));
        }
        const result = ts.visitEachChild(node, findTemplates, context);
        nodeStack.pop();
        return result;
      });
    };

    const rewriteTemplates = (node: ts.Node): ts.VisitResult<ts.Node> => {
      const f = context.factory;

      // Here we insert a top-level pre-compiled definiton of a template
      // that's contained within the current statement.
      if (topLevelStatementToTemplate.has(node as ts.Statement)) {
        const topLevelTemplates = topLevelStatementToTemplate
          .get(node as ts.Statement)!
          .map((template) => {
            const templateExpression = template.node.template;

            // Generate parts array
            const parts: Array<
              | {type: typeof PartType.CHILD; index: number}
              | {
                  type: PartType;
                  index: number;
                  name: string;
                  strings: Array<string>;
                  tagName: string;
                  ctorType: PartType;
                }
              | {
                  type: typeof PartType.ELEMENT;
                  index: number;
                }
            > = [];
            const spoofedTemplate = ts.isNoSubstitutionTemplateLiteral(
              templateExpression
            )
              ? ([templateExpression.text] as unknown as TemplateStringsArray)
              : ([
                  templateExpression.head.text,
                  ...templateExpression.templateSpans.map(
                    (s) => s.literal.text
                  ),
                ] as unknown as TemplateStringsArray);
            // lit-html tries to enforce that `getTemplateHtml` only accepts a
            // TemplateStringsResult.
            (spoofedTemplate as unknown as {raw: string}).raw = '';
            const [html, attrNames] = getTemplateHtml(spoofedTemplate, 1);
            const ast = parseFragment(html as unknown as string, {
              sourceCodeLocationInfo: true,
            }) as DocumentFragment;

            let nodeIndex = -1;

            /* Current attribute part index, for indexing attrNames */
            let attrIndex = 0;

            traverse(ast, {
              pre(node, _parent) {
                if (isCommentNode(node)) {
                  if (node.data === markerMatch) {
                    // make a childPart
                    parts.push({
                      type: PartType.CHILD,
                      index: nodeIndex,
                    });
                    // We have stored a reference to this comment node - so we can remove the comment text.
                    node.data = '';
                  }
                } else if (isElement(node)) {
                  const attributesToRemove = new Set<unknown>();
                  if (node.attrs.length > 0) {
                    const tagName = node.tagName;
                    for (const attr of node.attrs) {
                      if (
                        attr.name.endsWith(boundAttributeSuffix) ||
                        attr.name.startsWith(marker)
                      ) {
                        attributesToRemove.add(attr);
                        const strings = attr.value.split(marker);
                        // We store the case-sensitive name from `attrNames` (generated
                        // while parsing the template strings); note that this assumes
                        // parse5 attribute ordering matches string ordering
                        const [, prefix, caseSensitiveName] =
                          /([.?@])?(.*)/.exec(attrNames[attrIndex++]!)!;
                        // TODO: Why is this a string undefined?
                        if (caseSensitiveName !== 'undefined') {
                          parts.push({
                            type: PartType.ATTRIBUTE,
                            index: nodeIndex,
                            name: caseSensitiveName,
                            strings,
                            tagName,
                            ctorType:
                              prefix === '.'
                                ? PartType.PROPERTY
                                : prefix === '?'
                                ? PartType.BOOLEAN_ATTRIBUTE
                                : prefix === '@'
                                ? PartType.EVENT
                                : PartType.ATTRIBUTE,
                          });
                        } else {
                          parts.push({
                            type: PartType.ELEMENT,
                            index: nodeIndex,
                          });
                        }
                        shouldAddPartImports = true;
                      }
                    }
                    node.attrs = node.attrs.filter(
                      (attr) => !attributesToRemove.has(attr)
                    );
                  }
                } else if (isTextNode(node)) {
                  // We do not want to count text nodes.
                  nodeIndex--;
                }
                nodeIndex++;
              },
            });

            const partsArrayExpression = f.createArrayLiteralExpression(
              parts.map((part) => {
                const partProperties = [
                  f.createPropertyAssignment(
                    'type',
                    f.createNumericLiteral(part.type)
                  ),
                  f.createPropertyAssignment(
                    'index',
                    f.createNumericLiteral(part.index)
                  ),
                ];
                if (
                  part.type === PartType.ATTRIBUTE &&
                  (part.ctorType === PartType.ATTRIBUTE ||
                    part.ctorType === PartType.BOOLEAN_ATTRIBUTE ||
                    part.ctorType === PartType.PROPERTY ||
                    part.ctorType === PartType.EVENT)
                ) {
                  partProperties.push(
                    f.createPropertyAssignment(
                      'name',
                      f.createStringLiteral(part.name)
                    ),
                    f.createPropertyAssignment(
                      'strings',
                      f.createArrayLiteralExpression(
                        part.strings.map((s) => f.createStringLiteral(s))
                      )
                    ),
                    f.createPropertyAssignment(
                      'ctor',
                      f.createIdentifier(
                        AttributePartConstructors[part.ctorType]
                      )
                    )
                  );
                }
                return f.createObjectLiteralExpression(partProperties);
              })
            );
            // Compiled template expression
            return f.createVariableStatement(
              undefined,
              f.createVariableDeclarationList(
                [
                  f.createVariableDeclaration(
                    template.variableName,
                    undefined,
                    undefined,
                    f.createObjectLiteralExpression([
                      f.createPropertyAssignment(
                        'h',
                        f.createStringLiteral(
                          serialize(ast).replace(/<!---->/g, '<?>')
                        )
                      ),
                      f.createPropertyAssignment('parts', partsArrayExpression),
                    ])
                  ),
                ],
                ts.NodeFlags.Const
              )
            );
          });

        return [
          ...topLevelTemplates,
          // Traverse into template-containing top-level statement
          ts.visitEachChild(node, rewriteTemplates, context),
        ];
      }

      // Here we rewrite the template expression to use the pre-compiled template
      if (isLitTemplate(node)) {
        const templateInfo = expressionToTemplate.get(node);
        if (templateInfo === undefined) {
          throw new Error(`template info not found for ${node.getText()}`);
        }
        // A LitTemplate can contain other templates in the values array that
        // need to be compiled.
        const templateExpression = ts.visitEachChild(
          node.template,
          rewriteTemplates,
          context
        );

        return f.createObjectLiteralExpression([
          f.createPropertyAssignment('_$litType$', templateInfo.variableName!),
          f.createPropertyAssignment(
            'values',
            f.createArrayLiteralExpression(
              ts.isNoSubstitutionTemplateLiteral(templateExpression)
                ? []
                : templateExpression.templateSpans.map((s) => s.expression)
            )
          ),
        ]);
      }
      return ts.visitEachChild(node, rewriteTemplates, context);
    };

    return (sourceFile: ts.SourceFile) => {
      findTemplates(sourceFile);
      if (!shouldCompileFile) {
        return sourceFile;
      }

      const transformed_source_file = ts.visitNode(
        sourceFile,
        rewriteTemplates
      ) as ts.SourceFile;
      if (shouldAddPartImports) {
        return addPartConstructorImport(
          transformed_source_file,
          context.factory
        );
      }
      return transformed_source_file;
    };
  };
};

/**
 * E.g. html`foo` or html`foo${bar}`
 */
const isLitTemplate = (node: ts.Node): node is ts.TaggedTemplateExpression => {
  const isLitTemplate =
    ts.isTaggedTemplateExpression(node) &&
    ts.isIdentifier(node.tag) &&
    node.tag.escapedText === 'html';
  if (isLitTemplate) {
    console.log(node.tag);
  }
  return isLitTemplate;
};
