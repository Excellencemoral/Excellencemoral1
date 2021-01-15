/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

interface MaybePolyfilledCe extends CustomElementRegistry {
  readonly polyfillWrapFlushCallback?: object;
}

/**
 * True if the custom elements polyfill is in use.
 */
export const isCEPolyfill = typeof window !== 'undefined' &&
    window.customElements != null &&
    (window.customElements as MaybePolyfilledCe).polyfillWrapFlushCallback !==
        undefined;

/**
 * True if scoped registries are supported
 */
export const scopedRegistriesSupported = typeof ShadowRoot !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    ShadowRoot.prototype.importNode !== undefined;

/**
 * Reparents nodes, starting from `start` (inclusive) to `end` (exclusive),
 * into another container (could be the same container), before `before`. If
 * `before` is null, it appends the nodes to the container.
 */
export const reparentNodes =
    (container: Node,
     start: Node|null,
     end: Node|null = null,
     before: Node|null = null): void => {
      while (start !== end) {
        const n = start!.nextSibling;
        container.insertBefore(start!, before);
        start = n;
      }
    };

/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
export const removeNodes =
    (container: Node, start: Node|null, end: Node|null = null): void => {
      while (start !== end) {
        const n = start!.nextSibling;
        container.removeChild(start!);
        start = n;
      }
    };
