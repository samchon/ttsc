import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the ttsx compatibility path leaves ordinary Node builtins alone.
 *
 * Ordinary builtins such as `node:crypto` already retain their scheme in the
 * affected Node resolver. The prefix-only correction must not replace or
 * otherwise perturb this successful CommonJS resolution path.
 *
 * 1. Create a CommonJS entry that requires `node:crypto`.
 * 2. Run the entry through the real ttsx launcher.
 * 3. Assert the native builtin API executes successfully.
 */
export const test_ttsx_commonjs_keeps_ordinary_node_builtin_resolution = () => {
  const root = TestProject.commonJsProject({
    "src/main.ts": `
      declare function require(specifier: "node:crypto"): {
        randomUUID(): string;
      };
      console.log(require("node:crypto").randomUUID().length);
    `,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "36");
};
