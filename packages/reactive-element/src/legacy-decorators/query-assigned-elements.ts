/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/*
 * IMPORTANT: For compatibility with tsickle and the Closure JS compiler, all
 * property decorators (but not class decorators) in this file that have
 * an @ExportDecoratedItems annotation must be defined as a regular function,
 * not an arrow function.
 */

import type {ReactiveElement} from '../reactive-element.js';
import type {QueryAssignedNodesOptions} from './query-assigned-nodes.js';
import {queryAssignedElements as standardQueryAssignedElements} from '../std-decorators/query-assigned-elements.js';
import {Interface} from './base.js';

export type QueryAssignedElementsDecorator = {
  // legacy
  (
    proto: Interface<ReactiveElement>,
    name: PropertyKey
    // Note TypeScript requires the return type to be `void|any`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): void | any;

  // standard
  <C extends Interface<ReactiveElement>, V extends Array<Element>>(
    value: ClassAccessorDecoratorTarget<C, V>,
    context: ClassAccessorDecoratorContext<C, V>
  ): void;
};

/**
 * A tiny module scoped polyfill for HTMLSlotElement.assignedElements.
 */
const slotAssignedElements =
  globalThis.HTMLSlotElement?.prototype.assignedElements != null
    ? (slot: HTMLSlotElement, opts?: AssignedNodesOptions) =>
        slot.assignedElements(opts)
    : (slot: HTMLSlotElement, opts?: AssignedNodesOptions) =>
        slot
          .assignedNodes(opts)
          .filter(
            (node): node is Element => node.nodeType === Node.ELEMENT_NODE
          );

/**
 * Options for the {@linkcode queryAssignedElements} decorator. Extends the
 * options that can be passed into
 * [HTMLSlotElement.assignedElements](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/assignedElements).
 */
export interface QueryAssignedElementsOptions
  extends QueryAssignedNodesOptions {
  /**
   * CSS selector used to filter the elements returned. For example, a selector
   * of `".item"` will only include elements with the `item` class.
   */
  selector?: string;
}

/**
 * A property decorator that converts a class property into a getter that
 * returns the `assignedElements` of the given `slot`. Provides a declarative
 * way to use
 * [`HTMLSlotElement.assignedElements`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/assignedElements).
 *
 * Can be passed an optional {@linkcode QueryAssignedElementsOptions} object.
 *
 * Example usage:
 * ```ts
 * class MyElement {
 *   @queryAssignedElements({ slot: 'list' })
 *   listItems!: Array<HTMLElement>;
 *   @queryAssignedElements()
 *   unnamedSlotEls!: Array<HTMLElement>;
 *
 *   render() {
 *     return html`
 *       <slot name="list"></slot>
 *       <slot></slot>
 *     `;
 *   }
 * }
 * ```
 *
 * Note, the type of this property should be annotated as `Array<HTMLElement>`.
 *
 * @category Decorator
 */
export function queryAssignedElements(
  options?: QueryAssignedElementsOptions
): QueryAssignedElementsDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (<C extends Interface<ReactiveElement>, V extends Array<Element>>(
    protoOrTarget: ClassAccessorDecoratorTarget<C, V>,
    nameOrContext: PropertyKey | ClassAccessorDecoratorContext<C, V>
  ) => {
    if (typeof nameOrContext === 'object') {
      return standardQueryAssignedElements(options)(
        protoOrTarget,
        nameOrContext as ClassAccessorDecoratorContext<C, V>
      );
    } else {
      const {slot, selector} = options ?? {};
      Object.defineProperty(protoOrTarget, nameOrContext as PropertyKey, {
        get(this: ReactiveElement) {
          const slotSelector = `slot${
            slot ? `[name=${slot}]` : ':not([name])'
          }`;
          const slotEl =
            this.renderRoot?.querySelector<HTMLSlotElement>(slotSelector);
          const elements =
            slotEl != null ? slotAssignedElements(slotEl, options) : [];
          if (selector) {
            return elements.filter((node) => node.matches(selector));
          }
          return elements;
        },
        enumerable: true,
        configurable: true,
      });
      return;
    }
  }) as QueryAssignedElementsDecorator;
}
