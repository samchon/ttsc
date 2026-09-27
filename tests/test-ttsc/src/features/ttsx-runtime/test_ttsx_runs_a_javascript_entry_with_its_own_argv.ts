import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a JavaScript entry as Node's main module, hands it the
 * argv after it, and serves the TypeScript it loads.
 *
 * ttsx took only a TypeScript-extensioned token as the entry, so `ttsx
 * script.js --config x` reported "entry file is required" and parsed every
 * token after `script.js` as a compiler flag (samchon/ttsc#1569). A CLI's bin
 * script run this way, so that the TypeScript configuration it loads is
 * served, never started. The entry is now the first token that is no option's
 * value, and a JavaScript entry runs under the runtime `ttsc/register`
 * installs, which checks each TypeScript file it reaches through its project.
 *
 * 1. Give a CommonJS project a `script.js` that requires `./src/config.js`,
 *    backed only by `config.ts`, and prints its argv.
 * 2. Run `ttsx script.js --config x --port 3 --help`.
 * 3. Assert the script is the main module, got every token after it, and read
 *    the TypeScript value.
 */
export const test_ttsx_runs_a_javascript_entry_with_its_own_argv = () => {
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
};
