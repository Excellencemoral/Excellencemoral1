/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {html, LitElement, TemplateResult} from 'lit';
import {property} from 'lit/decorators/property.js';
import {state} from 'lit/decorators/state.js';
import {repeat, KeyFn} from 'lit/directives/repeat.js';
import {Virtualizer} from './Virtualizer.js';
import {LayoutConfigValue} from './layouts/shared/Layout.js';
import {RangeChangedEvent} from './events.js';

type RenderItemFunction<T = unknown> = (
  item: T,
  index: number
) => TemplateResult;

const defaultKeyFunction: KeyFn<unknown> = (item: unknown) => item;
const defaultRenderItem: RenderItemFunction<unknown> = (
  item: unknown,
  idx: number
) => html`${idx}: ${JSON.stringify(item, null, 2)}`;

export class LitVirtualizer<T = unknown> extends LitElement {
  private _renderItem: RenderItemFunction<T> = (item, idx) =>
    defaultRenderItem(item, idx + this._first);
  private _providedRenderItem: RenderItemFunction<T> = defaultRenderItem;

  set renderItem(fn: RenderItemFunction<T>) {
    this._providedRenderItem = fn;
    this._renderItem = (item, idx) => fn(item, idx + this._first);
    this.requestUpdate();
  }

  @property()
  get renderItem() {
    return this._providedRenderItem;
  }

  private _keyFunction: KeyFn<T> = (item, idx) =>
    defaultKeyFunction(item, idx + this._first);
  private _providedKeyFunction: KeyFn<T> = defaultKeyFunction;

  set keyFunction(fn: KeyFn<T>) {
    this._providedKeyFunction = fn;
    this._keyFunction = (item, idx) => fn(item, idx + this._first);
    this.requestUpdate();
  }

  @property()
  get keyFunction() {
    return this._providedKeyFunction;
  }

  @property({attribute: false})
  items: Array<T> = [];

  @property({reflect: true, type: Boolean})
  scroller = false;

  @state()
  private _first = 0;

  @state()
  private _last = -1;

  private _virtualizer?: Virtualizer;

  @property({attribute: false})
  layout: LayoutConfigValue = {};

  get layoutComplete() {
    return this._virtualizer!.layoutComplete;
  }

  element(index: number) {
    return this._virtualizer!.element(index);
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('layout')) {
      const compatible =
        this._virtualizer && this._virtualizer.updateLayoutConfig(this.layout);
      if (!compatible) {
        this._makeVirtualizer();
      }
    }
    if (this._virtualizer && changed.has('items')) {
      this._virtualizer.items = this.items;
    }
  }

  _init() {
    this.addEventListener('rangeChanged', (e: RangeChangedEvent) => {
      e.stopPropagation();
      this._first = e.first;
      this._last = e.last;
    });
  }

  _makeVirtualizer() {
    if (this._virtualizer) {
      this._virtualizer.disconnected();
    }
    this._virtualizer = new Virtualizer({
      hostElement: this,
      layout: this.layout,
      scroller: this.scroller,
    });
    this._virtualizer.items = this.items;
    this._virtualizer.connected();
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._virtualizer) {
      this._virtualizer.connected();
    } else {
      this._init();
    }
  }

  disconnectedCallback() {
    if (this._virtualizer) {
      this._virtualizer.disconnected();
    }
    super.disconnectedCallback();
  }

  createRenderRoot() {
    return this;
  }

  render(): TemplateResult {
    const {items, _renderItem, _keyFunction} = this;
    const itemsToRender = [];
    // TODO (graynorton): Is this the best / only place to ensure
    // that _last isn't outside the current bounds of the items array?
    // Not sure we should ever arrive here with it out of bounds.
    // Repro case for original issue: https://tinyurl.com/yes8b2e6
    const lastItem = Math.min(items.length, this._last + 1);

    if (this._first >= 0 && this._last >= this._first) {
      for (let i = this._first; i < lastItem; i++) {
        itemsToRender.push(items[i]);
      }
    }

    return repeat(itemsToRender, _keyFunction, _renderItem) as TemplateResult;
  }
}
