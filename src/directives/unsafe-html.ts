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

import {createDirective, forNodePart} from '../lib/createDirective.js';
import {isPrimitive, NodePart} from '../lit-html.js';

/**
 * Renders the result as HTML, rather than text.
 *
 * Note, this is unsafe to use with any user-provided input that hasn't been
 * sanitized or escaped, as it may lead to cross-site-scripting
 * vulnerabilities.
 */

export const unsafeHTML = createDirective(forNodePart((part: NodePart) => {
  let init = false;
  let previousValue: any;
  return (value: any) => {
    // Dirty check primitive values
    if (previousValue === value && isPrimitive(value) && init) {
      return;
    }

    // Use a <template> to parse HTML into Nodes
    const tmp = document.createElement('template');
    tmp.innerHTML = value;
    part.commitValue(document.importNode(tmp.content, true));
    previousValue = value;
    init = true;
  };
}));
