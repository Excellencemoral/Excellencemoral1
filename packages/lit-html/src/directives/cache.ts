/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  TemplateResult,
  ChildPart,
  RootPart,
  render,
  nothing,
  CompiledTemplateResult,
} from '../lit-html.js';
import {
  directive,
  Directive,
  DirectiveParameters,
  PartInfo,
} from '../directive.js';
import {
  clearPart,
  getCommittedValue,
  insertPart,
  isCompiledTemplateResult,
  isTemplateResult,
  setCommittedValue,
} from '../directive-helpers.js';

/**
 * The template strings array contents are not compatible between the two
 * template result types as the compiled template contains a prepared string,
 * only use for cache key.
 * @returns The template strings array for the provided template result.
 */
const getStringsFromTemplateResult = (
  result: TemplateResult | CompiledTemplateResult
): TemplateStringsArray =>
  isCompiledTemplateResult(result) ? result['_$litType$'].h : result.strings;

class CacheDirective extends Directive {
  private _templateCache = new WeakMap<TemplateStringsArray, RootPart>();
  private _value?: TemplateResult | CompiledTemplateResult;

  constructor(partInfo: PartInfo) {
    super(partInfo);
  }

  render(v: unknown) {
    // Return an array of the value to induce lit-html to create a ChildPart
    // for the value that we can move into the cache.
    return [v];
  }

  override update(containerPart: ChildPart, [v]: DirectiveParameters<this>) {
    // If the previous value is a TemplateResult and the new value is not,
    // or is a different Template as the previous value, move the child part
    // into the cache.
    if (
      isTemplateResult(this._value) &&
      (!isTemplateResult(v) ||
        getStringsFromTemplateResult(this._value) !==
          getStringsFromTemplateResult(v))
    ) {
      // This is always an array because we return [v] in render()
      const partValue = getCommittedValue(containerPart) as Array<ChildPart>;
      const childPart = partValue.pop()!;
      let cachedContainerPart = this._templateCache.get(
        getStringsFromTemplateResult(this._value)
      );
      if (cachedContainerPart === undefined) {
        const fragment = document.createDocumentFragment();
        cachedContainerPart = render(nothing, fragment);
        cachedContainerPart.setConnected(false);
        this._templateCache.set(
          getStringsFromTemplateResult(this._value),
          cachedContainerPart
        );
      }
      // Move into cache
      setCommittedValue(cachedContainerPart, [childPart]);
      insertPart(cachedContainerPart, undefined, childPart);
    }
    // If the new value is a TemplateResult and the previous value is not,
    // or is a different Template as the previous value, restore the child
    // part from the cache.
    if (isTemplateResult(v)) {
      if (
        !isTemplateResult(this._value) ||
        getStringsFromTemplateResult(this._value) !==
          getStringsFromTemplateResult(v)
      ) {
        const cachedContainerPart = this._templateCache.get(
          getStringsFromTemplateResult(v)
        );
        if (cachedContainerPart !== undefined) {
          // Move the cached part back into the container part value
          const partValue = getCommittedValue(
            cachedContainerPart
          ) as Array<ChildPart>;
          const cachedPart = partValue.pop()!;
          // Move cached part back into DOM
          clearPart(containerPart);
          insertPart(containerPart, undefined, cachedPart);
          setCommittedValue(containerPart, [cachedPart]);
        }
      }
      this._value = v;
    } else {
      this._value = undefined;
    }
    return this.render(v);
  }
}

/**
 * Enables fast switching between multiple templates by caching the DOM nodes
 * and TemplateInstances produced by the templates.
 *
 * Example:
 *
 * ```js
 * let checked = false;
 *
 * html`
 *   ${cache(checked ? html`input is checked` : html`input is not checked`)}
 * `
 * ```
 */
export const cache = directive(CacheDirective);

/**
 * The type of the class that powers this directive. Necessary for naming the
 * directive's return type.
 */
export type {CacheDirective};
