import fs from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "ts-legacy";

import { load, resolve } from "./typescript-loader.mjs";

// Workspace unit tests execute the authored TypeScript export, before a build.
// Dependencies keep their normal runtime exports and package integration stays
// on register-typescript-loader.mjs, which exercises the shipped JavaScript.
const commonjsSources = [
  "ttsc",
  "wasm",
  "playground",
  "banner",
  "paths",
  "strip",
  "lint",
]
  .map((owner) => new URL(`../packages/${owner}/src/`, import.meta.url).href)
  .concat(
    new URL("../benchmarks/evidence/src/", import.meta.url).href,
    new URL("../tests/test-evidence-benchmark/src/", import.meta.url).href,
  );
registerHooks({
  load(url, context, nextLoad) {
    // These owners emit CommonJS. Preserve their dependency export conditions,
    // __dirname and require cache while compiling the authored source in units.
    if (
      url.endsWith(".ts") &&
      commonjsSources.some((prefix) => url.startsWith(prefix))
    ) {
      const filename = fileURLToPath(url);
      const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          esModuleInterop: true,
          inlineSourceMap: true,
          inlineSources: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ESNext,
        },
        fileName: filename,
      });
      return {
        format: "commonjs",
        shortCircuit: true,
        source: output.outputText,
      };
    }
    return load(url, context, nextLoad);
  },
  resolve(specifier, context, nextResolve) {
    if (specifier === "@ttsc/unplugin/api")
      return resolve(
        fileURLToPath(
          new URL("../packages/unplugin/src/api.ts", import.meta.url),
        ),
        context,
        nextResolve,
      );
    if (specifier === "@ttsc/wasm")
      return resolve(
        fileURLToPath(
          new URL("../packages/wasm/src/index.ts", import.meta.url),
        ),
        context,
        nextResolve,
      );
    if (specifier === "ttsc" || specifier.startsWith("ttsc/"))
      return resolve(
        specifier,
        {
          ...context,
          // Authored-source units may import owners that the filtered install
          // did not link. Resolve this workspace package through its actual
          // public export map, rather than requiring an incidental parent link.
          parentURL: new URL("../packages/ttsc/package.json", import.meta.url)
            .href,
          conditions: [...context.conditions, "types"],
        },
        nextResolve,
      );
    return resolve(specifier, context, nextResolve);
  },
});
process.setSourceMapsEnabled(true);
