/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Generic tagged-template literal string concatenator with array value
 * flattening. Can be assigned to various tag names for syntax highlighting.
 */
const concat = (strings: TemplateStringsArray, ...values: unknown[]) => {
  return strings.slice(1).reduce((prev, next, i) => {
    let v = values[i];
    if (Array.isArray(v)) {
      v = v.flat(Infinity).join('');
    }
    return prev + v + next;
  }, strings[0]);
};

/**
 * Use https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html
 * for JS syntax highlighting
 */
export const javascript = concat;

/**
 * Converts string to initial cap.
 */
export const toInitialCap = (str: string) =>
  str ? `${str[0].toUpperCase()}${str.slice(1)}` : str;

/**
 * Converts kabob-case string to PascalCase.
 */
export const kabobToPascalCase = (str: string) =>
  toInitialCap(str).replace(/-[a-z]/g, (m) => m[1].toUpperCase());

/**
 * Converts kabob-case event name to an "on" event: `onEventName`.
 */
export const kabobToOnEvent = (str: string) => `on${kabobToPascalCase(str)}`;
