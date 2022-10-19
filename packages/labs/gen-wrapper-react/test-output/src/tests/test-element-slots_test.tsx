/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {assert} from '@esm-bundle/chai';

import React from 'react';
// eslint-disable-next-line import/extensions
import {render, unmountComponentAtNode} from 'react-dom';
import {ElementSlots} from '@lit-internal/test-element-slots-react/element-slots.js';
import {ElementSlots as ElementSlotsElement} from '@lit-internal/test-element-slots/element-slots.js';

suite('test-element-slots', () => {
  let container: HTMLElement;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) {
      unmountComponentAtNode(container);
      container.parentNode.removeChild(container);
    }
  });

  test('renders correctly', async () => {
    const c = 'Hello World';
    render(
      <React.StrictMode>
        <ElementSlots mainDefault={c}></ElementSlots>
      </React.StrictMode>,
      container
    );
    const el = container.querySelector('element-slots')! as ElementSlotsElement;
    await el.updateComplete;
    const {shadowRoot} = el;
    const {firstElementChild} = shadowRoot!;
    assert.equal(firstElementChild?.localName, 'h1');
    assert.equal(firstElementChild?.textContent, 'Slots');
    const main = shadowRoot!.querySelector<HTMLSlotElement>('slot[name=main]')!;
    assert.equal(main.assignedNodes({flatten: true})[0].textContent, c);
  });
});
