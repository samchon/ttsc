import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { RuntimeLoaderCapabilities } from "../../../../../packages/ttsc/lib/launcher/internal/runtime/RuntimeLoaderCapabilities.js";

/**
 * Verifies a CommonJS TypeScript entry stays Node's main module when an
 * `--import` preload makes Node run it through the ESM loader.
 *
 * Node runs every entry through its ESM loader once an `--import` preload is
 * present, which is how OpenTelemetry and Sentry are installed. ttsx handed
 * that entry to the loader as the ESM facade, which loads it as an ordinary
 * module, so `require.main` was undefined and a `require.main === module` guard
 * silently ran nothing (samchon/ttsc#1571). The entry is now handed over as
 * CommonJS with its source, as Node hands a JavaScript entry, and the
 * TypeScript it requires is served to whichever `require` the runtime gives
 * it.
 *
 * 1. Give a CommonJS project an entry that requires `./dep.js`, backed only by
 *    `dep.ts`, and reports its main-module identity.
 * 2. Run it through ttsx with an `--import` preload in `NODE_OPTIONS`, through
 *    `node --import ttsc/register`, and through `node --import <preload> -r
 *    ttsc/register`.
 * 3. Assert each run is the main module, requires its dependency, and has the
 *    `require` the runtime gives a hook-served CommonJS module.
 */
export const test_ttsx_keeps_a_commonjs_entry_the_main_module_under_an_import_preload =
  () => {
    const root = TestProject.commonJsProject({
      "src/main.ts": [
        `declare const require: any;`,
        `declare const module: any;`,
        `console.log(JSON.stringify({`,
        `  cache: typeof require.cache,`,
        `  dep: require("./dep.js").value,`,
        `  main: require.main === module,`,
        `}));`,
        ``,
      ].join("\n"),
      "src/dep.ts": `export const value: string = "dep";\n`,
      "preload.mjs": ``,
    });
    const preload = pathToFileURL(path.join(root, "preload.mjs")).href;
    const register = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "register.js",
    );
    const expected = {
      cache: RuntimeLoaderCapabilities.hookedCommonJsImportKeepsRequire()
        ? "object"
        : "undefined",
      dep: "dep",
      main: true,
    };
    for (const [label, result] of [
      [
        "ttsx",
        TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
          cwd: root,
          env: { NODE_OPTIONS: `--import=${preload}` },
        }),
      ],
      [
        "--import ttsc/register",
        TestProject.spawn(
          process.execPath,
          ["--import", pathToFileURL(register).href, "src/main.ts"],
          { cwd: root },
        ),
      ],
      [
        "--import preload -r ttsc/register",
        TestProject.spawn(
          process.execPath,
          ["--import", preload, "-r", register, "src/main.ts"],
          { cwd: root },
        ),
      ],
    ] as const) {
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.deepEqual(JSON.parse(result.stdout.trim()), expected, label);
    }
  };
