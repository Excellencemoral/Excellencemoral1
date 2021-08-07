/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reactiveElementPlatformSupport: (options: {[index: string]: any}) => void;
}

// Augment existing types with styling API
interface ShadowRoot {
  adoptedStyleSheets: CSSStyleSheet[];
}

interface CSSStyleSheet {
  replaceSync(cssText: string): void;
}
