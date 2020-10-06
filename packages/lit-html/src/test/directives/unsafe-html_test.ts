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

import {unsafeHTML} from '../../directives/unsafe-html.js';
import {render, html} from '../../lit-html.js';
import {stripExpressionMarkers} from '../test-utils/strip-markers.js';
import {assert} from '@esm-bundle/chai';
import '../polyfills.js';

suite('unsafeHTML directive', () => {
  let container: HTMLElement;

  setup(() => {
    container = document.createElement('div');
  });

  test('renders HTML', () => {
    render(
      html`<div>before${unsafeHTML('<span>inner</span>after')}</div>`,
      container
    );
    assert.equal(
      stripExpressionMarkers(container.innerHTML),
      '<div>before<span>inner</span>after</div>'
    );
  });

  test('dirty checks primitive values', () => {
    const value = 'aaa';
    const t = () => html`<div>${unsafeHTML(value)}</div>`;

    // Initial render
    render(t(), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>aaa</div>');

    // Modify instance directly. Since lit-html doesn't dirty check against
    // actual DOM, but against previous part values, this modification should
    // persist through the next render if dirty checking works.
    const text = container.querySelector('div')!.childNodes[1] as Text;
    text.textContent = 'bbb';
    assert.equal(
      stripExpressionMarkers(container.innerHTML),
      '<div>bbb</div>',
      'A'
    );

    // Re-render with the same value
    render(t(), container);

    assert.equal(
      stripExpressionMarkers(container.innerHTML),
      '<div>bbb</div>',
      'B'
    );
    const text2 = container.querySelector('div')!.childNodes[1] as Text;
    assert.strictEqual(text, text2);
  });

  test('throws on non-string values', () => {
    const value = ['aaa'];
    const t = () => html`<div>${unsafeHTML(value as any)}</div>`;
    assert.throws(() => render(t(), container));
  });

  test('renders after other values', () => {
    const value = '<span></span>';
    const primitive = 'aaa';
    const t = (content: any) => html`<div>${content}</div>`;

    // Initial unsafeHTML render
    render(t(unsafeHTML(value)), container);
    assert.equal(
      stripExpressionMarkers(container.innerHTML),
      '<div><span></span></div>'
    );

    // Re-render with a non-unsafeHTML value
    render(t(primitive), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>aaa</div>');

    // Re-render with unsafeHTML again
    render(t(unsafeHTML(value)), container);
    assert.equal(
      stripExpressionMarkers(container.innerHTML),
      '<div><span></span></div>'
    );
  });
});
