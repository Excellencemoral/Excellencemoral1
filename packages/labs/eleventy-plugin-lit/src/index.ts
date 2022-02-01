/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

// Note this file must be CommonJS for compatibility with Eleventy, but we can't
// rely on TypeScript's CommonJS output mode, because that will also convert
// dynamic import() calls to require() calls. That would be bad, because we need
// to import ES modules from @lit-labs/ssr, which requires preserved import()
// calls.
//
// So instead we use TypeScript's ESM output mode, but explicitly write
// require() calls for the CommonJS modules we import.
//
// See https://github.com/microsoft/TypeScript/issues/43329 and
// https://github.com/microsoft/TypeScript#22321 for more details.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');

type LitPluginOptions = {
  componentModules?: string[];
};

module.exports = {
  configFunction: function (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eleventyConfig: any,
    options: LitPluginOptions = {}
  ) {
    eleventyConfig.addTransform(
      'render-lit',
      async (content: string, outputPath: string) => {
        if (!outputPath.endsWith('.html')) {
          return content;
        }

        const render = (
          await import('@lit-labs/ssr/lib/render-with-global-dom-shim.js')
        ).render;
        const html = (await import('lit')).html;
        const unsafeHTML = (await import('lit/directives/unsafe-html.js'))
          .unsafeHTML;
        // TODO(aomarks) This doesn't work in Eleventy --watch mode, because
        // the ES module cache never gets cleared. Switch to isolated VM
        // modules so that we can control this.
        await Promise.all(
          (options.componentModules ?? []).map(
            (module) => import(path.resolve(process.cwd(), module))
          )
        );

        const rendered = iterableToString(render(html`${unsafeHTML(content)}`));
        // Lit SSR includes special comment markers around templates to identify
        // them during hydration. However, it's not possible for the top-level
        // template that we've just rendered to ever be hydrated, because it was
        // only defined ephemerally right now. So the comments serve no purpose
        // in this case and can be removed. This also avoids the issue of
        // comments appearing before <!doctype> declarations.
        const outerMarkersTrimmed = rendered
          .replace(/^((<!--[^<>]*-->)|(<\?>)|\s)+/, '')
          .replace(/((<!--[^<>]*-->)|(<\?>)|\s)+$/, '');
        return outerMarkersTrimmed;
      }
    );
  },
};

// Assuming this is faster than Array.from(iter).join();
// TODO: perf test
const iterableToString = (iterable: Iterable<string>) => {
  let s = '';
  for (const i of iterable) {
    s += i;
  }
  return s;
};
