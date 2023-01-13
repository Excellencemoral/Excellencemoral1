/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {LitElement} from 'lit';

/**
 * A cool custom element.
 *
 * @slot basic
 * @slot with-description Description for with-description
 * with wraparound
 * @slot with-description-dash - Description for with-description-dash
 * @slot with-description-colon: Description for with-description-colon
 * @cssPart basic
 * @cssPart with-description Description for :part(with-description)
 * with wraparound
 * @cssPart with-description-dash - Description for :part(with-description-dash)
 * @cssPart with-description-colon: Description for :part(with-description-colon)
 * @cssProperty --basic
 * @cssProperty --with-description Description for --with-description
 * with wraparound
 * @cssProperty --with-description-dash - Description for --with-description-dash
 * @cssProperty --with-description-colon: Description for --with-description-colon
 * @cssProp --short-basic
 * @cssProp --short-with-description Description for --short-with-description
 * with wraparound
 * @cssProp --short-with-description-dash - Description for --short-with-description-dash
 * @cssProp --short-with-description-colon: Description for --short-with-description-colon
 */
export class ElementA extends LitElement {
  /**
   * Class field 1 description
   * with wraparound
   * @private
   */
  field1 = 'default1';

  /**
   * @summary Class field 2 summary
   * with wraparound
   *
   * @description Class field 2 description
   * with wraparound
   * @protected
   * @type {number | string}
   */
  field2;

  /**
   * @description Class field 3 description
   * with wraparound
   * @optional
   * @type {string}
   * @deprecated
   */
  field3;

  /**
   * Class field 4 description
   * with wraparound
   * @summary Class field 4 summary
   * with wraparound
   * @type {Promise<void>}
   * @deprecated Class field 4 deprecated
   */
  field4 = new Promise((r) => r());

  /**
   * Method 1 description
   * with wraparound
   */
  method1() {}

  /**
   * @summary Method 2 summary
   * with wraparound
   *
   * @description Method 2 description
   * with wraparound
   *
   * @param {string} a Param a description
   * @param {boolean} b Param b summary
   * with wraparound
   *
   * Param b description
   * with wraparound
   *
   * @param {number[]} c Param c description
   * @returns {string} Method 2 return summary
   *
   * Method 2 return description
   *
   * @deprecated Method 2 deprecated
   */
  method2(a, b = false, ...c) {
    return b ? a : c[0].toFixed();
  }
}
customElements.define('element-a', ElementA);

/**
 * @description TaggedDescription description. Lorem ipsum dolor sit amet, consectetur
 * adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna
 * aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
 * nisi ut aliquip ex ea commodo consequat.
 * @summary TaggedDescription summary.
 * @deprecated TaggedDescription deprecated message.
 */
export class TaggedDescription extends LitElement {}

/**
 * UntaggedDescription description. Lorem ipsum dolor sit amet, consectetur
 * adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna
 * aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
 * nisi ut aliquip ex ea commodo consequat.
 *
 * @deprecated UntaggedDescription deprecated message.
 * @summary UntaggedDescription summary.
 */
export class UntaggedDescription extends LitElement {}
