/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {test} from 'uvu';
import {compileTsFragment, CompilerHostCache} from './compile-ts-fragment.js';
import * as ts from 'typescript';
import * as assert from 'uvu/assert';
import * as prettier from 'prettier';
import idiomaticLitDecoratorTransformer from '../idiomatic.js';

const cache = new CompilerHostCache();

/**
 * Compile the given fragment of TypeScript source code using the idiomatic
 * decorator transform. Check that there are no errors and that the output
 * matches (prettier-formatted).
 */
function checkTransform(inputTs: string, expectedJs: string) {
  const options = ts.getDefaultCompilerOptions();
  options.target = ts.ScriptTarget.ESNext;
  options.module = ts.ModuleKind.ESNext;
  options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
  options.importHelpers = true;
  // Don't automatically load typings from nodes_modules/@types, we're not using
  // them here, so it's a waste of time.
  options.typeRoots = [];
  options.experimentalDecorators = true;
  const result = compileTsFragment(inputTs, options, cache, () => ({
    before: [idiomaticLitDecoratorTransformer()],
  }));

  let formattedExpected = prettier.format(expectedJs, {parser: 'typescript'});
  // TypeScript >= 4 will add an empty export statement if there are no imports
  // or exports to ensure this is a module. We don't care about checking this.
  const unformattedActual = (result.code || '').replace('export {};', '');
  let formattedActual;
  try {
    formattedActual = prettier.format(unformattedActual, {
      parser: 'typescript',
    });
  } catch {
    // We might emit invalid TypeScript in a failing test. Rather than fail with
    // a Prettier parse exception, it's more useful to see a diff.
    formattedExpected = expectedJs;
    formattedActual = unformattedActual;
  }
  assert.is(formattedActual, formattedExpected);
  assert.equal(
    result.diagnostics.map((diagnostic) =>
      ts.formatDiagnostic(diagnostic, result.host)
    ),
    []
  );
}

test('@customElement', () => {
  const input = `
  import {LitElement} from 'lit';
  import {customElement} from 'lit/decorators.js';
  @customElement('my-element')
  class MyElement extends LitElement {
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
  }
  customElements.define('my-element', MyElement);
  `;
  checkTransform(input, expected);
});

test('@property', () => {
  const input = `
  import {LitElement} from 'lit';
  import {property} from 'lit/decorators.js';
  class MyElement extends LitElement {
    @property()
    str = "foo";

    @property({type: Number, attribute: false})
    num = 42;
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
    constructor() {
      super(...arguments);
      this.str = "foo";
      this.num = 42;
    }
    static get properties() {
      return {
        str: {},
        num: {type: Number, attribute: false},
      };
    }
  }
  `;
  checkTransform(input, expected);
});

test('@property (merge with existing static properties)', () => {
  const input = `
  import {LitElement} from 'lit';
  import {property} from 'lit/decorators.js';
  class MyElement extends LitElement {
    static get properties() {
      return {
        str: {},
      };
    }

    @property({type: Number})
    num = 42;

    constructor() {
      super();
    }
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
    constructor() {
      super();
      this.num = 42;
    }
    static get properties() {
      return {
        str: {},
        num: {type: Number},
      };
    }
  }
  `;
  checkTransform(input, expected);
});

test('@state', () => {
  const input = `
  import {LitElement} from 'lit';
  import {state} from 'lit/decorators.js';
  class MyElement extends LitElement {
    @state()
    num = 42;

    @state({hasChanged: () => false})
    num2 = 24;
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
    constructor() {
      super(...arguments);
      this.num = 42;
      this.num2 = 24;
    }
    static get properties() {
      return {
        num: {state: true, attribute: false},
        num2: {hasChanged: () => false, state: true, attribute: false},
      };
    }
  }
  `;
  checkTransform(input, expected);
});

test('@query (non-caching)', () => {
  const input = `
  import {LitElement} from 'lit';
  import {query} from 'lit/decorators.js';
  class MyElement extends LitElement {
    @query('#myDiv')
    div?: HTMLDivElement;
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
    get div() {
      return this.renderRoot?.querySelector('#myDiv');
    }
  }
  `;
  checkTransform(input, expected);
});

test('@query (caching)', () => {
  const input = `
  import {LitElement} from 'lit';
  import {query} from 'lit/decorators.js';
  class MyElement extends LitElement {
    @query('#mySpan', true)
    span?: HTMLSpanElement;
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
    get span() {
      if (this.__span === undefined) {
        this.__span = this.renderRoot?.querySelector('#mySpan');
      }
      return this.__span;
    }
  }
  `;
  checkTransform(input, expected);
});

test('@queryAll', () => {
  const input = `
  import {LitElement} from 'lit';
  import {queryAll} from 'lit/decorators.js';
  class MyElement extends LitElement {
    @queryAll('.myInput')
    inputs: NodeListOf<HTMLInputElement>;
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
    get inputs() {
      return this.renderRoot?.querySelectorAll('.myInput');
    }
  }
  `;
  checkTransform(input, expected);
});

test('@queryAsync', () => {
  const input = `
  import {LitElement} from 'lit';
  import {queryAsync} from 'lit/decorators.js';
  class MyElement extends LitElement {
    @queryAsync('#myButton')
    button: Promise<HTMLElement>;
  }
  `;

  const expected = `
  import {LitElement} from 'lit';
  class MyElement extends LitElement {
    async get button() {
      await this.updateComplete;
      return this.renderRoot?.querySelector('#myButton');
    }
  }
  `;
  checkTransform(input, expected);
});

test.run();
