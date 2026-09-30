import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";


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
 *
 * @evidence contracts/testing.md#behavioral-verification Three actual bootstraps reach one CommonJS typed main under import preloading; each exact JSON verifies main identity, typed dependency and require.cache availability.
 * @evidence contracts/testing.md#independent-expectations main true and dep are literal NativeNode and fixture expectations; a separate native JavaScript main under a public passthrough load hook establishes require.cache availability independently of product capability detection.
 * @evidence contracts/testing.md#distinguishing-cases CLI NODE_OPTIONS, native --import register and native preload with -r register are distinct loader entry paths, each preserving main-module semantics.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary Three actual bootstraps reach one CommonJS typed main under import preloading; each exact JSON verifies main identity, typed dependency and require.cache availability. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One immutable workspace supplies all three product bootstraps plus one inexpensive native-reference host with no product compiler preparation. Distinct Node process starts are necessary because preload mode is chosen at process creation; equivalent compiler preparation is still mediated by the runtime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All consumers read the same immutable source/preload files; synchronous spawns complete each host before the next and no source mutation or cold-cache claim is made.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_keeps_a_commonjs_entry_the_main_module_under_an_import_preload() {
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
      "native-reference.cjs": `console.log(JSON.stringify({ cache: typeof require.cache, main: require.main === module }));\n`,
      "native-reference-hook.mjs": `import { registerHooks } from "node:module";\nregisterHooks({ load(url, context, nextLoad) { return nextLoad(url, context); } });\n`,
    });
    const preload = pathToFileURL(path.join(root, "preload.mjs")).href;
    const register = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "register.js",
    );
    const reference = TestProject.spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(path.join(root, "native-reference-hook.mjs")).href,
        "native-reference.cjs",
      ],
      { cwd: root },
    );
    assert.equal(reference.status, 0, reference.stderr);
    const native = JSON.parse(reference.stdout.trim()) as {
      cache: string;
      main: boolean;
    };
    assert.equal(native.main, true);
    assert.ok(native.cache === "object" || native.cache === "undefined");
    const expected = { cache: native.cache, dep: "dep", main: true };
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
  }
