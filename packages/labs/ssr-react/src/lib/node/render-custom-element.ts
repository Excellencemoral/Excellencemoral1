/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {LitElementRenderer} from '@lit-labs/ssr/lib/lit-element-renderer.js';
import {getElementRenderer} from '@lit-labs/ssr/lib/element-renderer.js';
import type {RenderInfo} from '@lit-labs/ssr';

const reservedReactProperties = new Set([
  'children',
  'localName',
  'ref',
  'style',
  'className',
]);

const attributesToProps = (attrs: NamedNodeMap) => {
  const props: {[index: string]: string} = {};
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    props[attr.name] = attr.value;
  }
  return props;
};

/**
 * Renders the shadow contents of the provided custom element type with props.
 * Should only be called in server environments.
 */
export const renderCustomElement = (
  tagName: string,
  props: Record<PropertyKey, unknown> | null
) => {
  const renderInfo: RenderInfo = {
    elementRenderers: [LitElementRenderer],
    customElementInstanceStack: [],
    customElementHostStack: [],
    deferHydration: false,
  };

  const renderer = getElementRenderer(renderInfo, tagName);

  if (renderer.element !== undefined && props != null) {
    for (const [k, v] of Object.entries(props)) {
      // Reserved React Props do not need to be set on the element
      if (reservedReactProperties.has(k)) {
        continue;
      }

      if (k in renderer.element) {
        renderer.setProperty(k, v);
      } else {
        renderer.setAttribute(k, String(v));
      }
    }
  }

  renderer.connectedCallback();

  renderInfo.customElementInstanceStack.push(renderer);

  const shadowContents = renderer.renderShadow(renderInfo);

  // elementAttributes will be provided to React as props for the host element
  // for properly rendering reflected attributes
  const elementAttributes =
    renderer.element !== undefined
      ? attributesToProps(renderer.element.attributes)
      : {};

  const {mode = 'open', delegatesFocus} = renderer.shadowRootOptions;
  const templateAttributes = {
    shadowroot: mode,
    shadowrootmode: mode,
    ...(delegatesFocus ? {shadowrootdelegatesfocus: ''} : {}),
  };

  return {
    shadowContents,
    elementAttributes,
    templateAttributes,
  };
};
