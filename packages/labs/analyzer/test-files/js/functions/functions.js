/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Function 1 description
 */
export function function1() {}

/**
 * @summary Function 2 summary
 * with wraparound
 *
 * @description Function 2 description
 * with wraparound
 *
 * @param {string} a Param a description
 * @param {boolean} b Param b description
 * with wraparound
 *
 * @param {number[]} c Param c description
 * @returns {string} Function 2 return description
 *
 * @deprecated Function 2 deprecated
 */
export function function2(a, b = false, ...c) {
  return b ? a : c[0].toFixed();
}

/**
 * Default function description
 * @returns {string} Default function return description
 */
export default function () {
  return 'default';
}
