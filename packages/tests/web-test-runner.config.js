import { playwrightLauncher } from "@web/test-runner-playwright";
import { fromRollup } from "@web/dev-server-rollup";
import { resolveRemap } from "./rollup-resolve-remap.js";
import { prodResolveRemapConfig, devResolveRemapConfig } from "./wtr-config.js";

// TODO Replace this with log filter feature when/if added to wtr
// https://github.com/modernweb-dev/web/issues/595
const removeDevModeLogging = {
  name: "remove-dev-mode-logging",
  transform(context) {
    if (context.response.is("js")) {
      return {
        body: context.body.replace(/console\.warn\(.*in dev mode.*\);/, ""),
      };
    }
  },
};

const plugins = [];
if (process.env.TEST_PROD_BUILD) {
  console.log("Using production builds");
  plugins.push(fromRollup(resolveRemap)(prodResolveRemapConfig));
} else {
  console.log("Using development builds");
  plugins.push(fromRollup(resolveRemap)(devResolveRemapConfig));
  plugins.push(removeDevModeLogging);
}

export default {
  rootDir: "../../",
  files: [
    // TODO when https://github.com/modernweb-dev/web/issues/593 is fixed, we
    // can delete these symlinks and simply use a relative path.
    "lit-html/development/**/*_test.js",
    "lit-element/development/**/*_test.js",
  ],
  nodeResolve: true,
  browsers: [
    playwrightLauncher({ product: "chromium" }),
    playwrightLauncher({ product: "firefox" }),
    playwrightLauncher({ product: "webkit" }),
  ],
  testFramework: {
    config: {
      ui: "tdd",
      timeout: "2000",
    },
  },
  plugins,
};
