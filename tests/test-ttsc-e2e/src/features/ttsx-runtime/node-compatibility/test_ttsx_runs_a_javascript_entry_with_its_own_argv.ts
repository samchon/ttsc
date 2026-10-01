import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a JavaScript entry as Node's main module, hands it the
 * argv after it, and serves the TypeScript it loads.
 *
 * Ttsx took only a TypeScript-extensioned token as the entry, so `ttsx
 * script.js --config x` reported "entry file is required" and parsed every
 * token after `script.js` as a compiler flag (samchon/ttsc#1569). A CLI's bin
 * script run this way, so that the TypeScript configuration it loads is served,
 * never started. The entry is now the first token that is no option's value,
 * and a JavaScript entry runs under the runtime `ttsc/register` installs, which
 * checks each TypeScript file it reaches through its project.
 *
 * 1. Give a CommonJS project a `script.js` that requires `./src/config.js`, backed
 *    only by `config.ts`, and prints its argv.
 * 2. Run `ttsx script.js --config x --port 3 --help`.
 * 3. Assert the script is the main module, got every token after it, and read the
 *    TypeScript value.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual public launcher runs script.js as CommonJS main and serves config.ts behind config.js; exact JSON proves main true, typed value and every post-entry argument.
 * @evidence contracts/testing.md#independent-expectations The original argument literals and typed export establish the answer independently; --help after the entry must remain a program argument rather than terminate the launcher.
 * @evidence contracts/testing.md#distinguishing-cases This owns a JavaScript frontdoor entry with typed dependency and option-shaped argv; parser units own lexical entry selection and other typed-main cases own TypeScript entries.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary The actual public launcher runs script.js as CommonJS main and serves config.ts behind config.js; exact JSON proves main true, typed value and every post-entry argument. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One JavaScript entry host and one compiler-owned typed graph cover main, argv and source rescue in a single request; no separate per-argument host is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh fixture lacks src/config.js and has a real JavaScript entry; synchronous spawn closes the host before TestProject releases its workspace.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_runs_a_javascript_entry_with_its_own_argv() {
  const root = TestProject.commonJsProject({
    "script.js": [
      `const { value } = require("./src/config.js");`,
      `console.log(JSON.stringify({ argv: process.argv.slice(2), main: require.main === module, value }));`,
      ``,
    ].join("\n"),
    "src/config.ts": `export const value: string = "typed";\n`,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["script.js", "--config", "x", "--port", "3", "--help"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    argv: ["--config", "x", "--port", "3", "--help"],
    main: true,
    value: "typed",
  });
}
