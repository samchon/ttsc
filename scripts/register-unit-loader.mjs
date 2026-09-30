import { registerHooks } from "node:module";

import { load, resolve } from "./typescript-loader.mjs";

// Workspace unit tests execute the authored TypeScript export, before a build.
// Dependencies keep their normal runtime exports and package integration stays
// on register-typescript-loader.mjs, which exercises the shipped JavaScript.
registerHooks({
  load,
  resolve(specifier, context, nextResolve) {
    return resolve(
      specifier,
      specifier === "ttsc" || specifier.startsWith("ttsc/")
        ? { ...context, conditions: [...context.conditions, "types"] }
        : context,
      nextResolve,
    );
  },
});
process.setSourceMapsEnabled(true);
