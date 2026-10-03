import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx declares the TypeScript extensions in `require.extensions`, so
 * CommonJS tools that detect a loader there load a `.ts` config.
 *
 * `rechoir`, which `webpack-cli`, `gulp-cli`, and `knex` use for
 * `webpack.config.ts` and its siblings, takes a present
 * `require.extensions[".ts"]` as "a loader is installed" and otherwise tries to
 * install `ts-node` or another loader of its own, failing when none is found.
 * Node defines no TypeScript key on any release, and #1559 had removed the one
 * ttsx set, so `webpack-cli` stopped with "Please install one of them" under
 * ttsx and `ttsc/register` (samchon/ttsc#1560). The key now carries Node's own
 * `.js` handler, and the hooks still serve the source. Node probes these keys
 * after its own for an extensionless request, which the case also pins.
 *
 * 1. In a CommonJS project, check the key the way `rechoir.prepare` does, then
 *    `require` a typed config through it.
 * 2. Require and resolve a lone `y.ts` without an extension, and require an `x`
 *    that exists as both `x.js` and `x.ts`.
 * 3. Assert the key is Node's `.js` handler, the typed config loads, the lone
 *    source is found, and `x.js` still wins, as it does for Node.
 *
 * @evidence contracts/testing.md#behavioral-verification A native CommonJS entry checks require.extensions, loads typed config, resolves extensionless y.ts and prefers x.js over adjacent x.ts; the exact JSON pins every result.
 * @evidence contracts/testing.md#independent-expectations Node native .js handler identity and literal fixture exports independently establish loader detection and Node extension precedence.
 * @evidence contracts/testing.md#distinguishing-cases Typed-only resolution is positive and colliding x.js/x.ts is the counterexample where source must not displace JavaScript.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary A native CommonJS entry checks require.extensions, loads typed config, resolves extensionless y.ts and prefers x.js over adjacent x.ts; the exact JSON pins every result. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One CommonJS project load and host execute all detection, resolution and precedence probes without extra installations or CLI invocations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Separate x/y fixture paths distinguish collision from source-only resolution; synchronous spawn closes the sole process and TestProject owns its directory.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_advertises_typescript_to_commonjs_extension_detection() {
    const root = TestProject.commonJsProject(FixtureFiles.read("ttsc/ttsx_advertises_typescript_to_commonjs_extension_detection/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      config: "typed-config",
      lone: "only-ts",
      loneResolved: true,
      nodeHandler: true,
      precedence: "from-js",
    });
  }
