import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx preserves prefix-only Node builtin URLs in CommonJS graphs.
 *
 * Node 22.15 through 22.17 can strip the `node:` scheme from the synchronous
 * resolve result for prefix-only builtins. Returning that stripped result from
 * the ttsx hook makes Node reject the builtins' otherwise valid null source
 * before the entry can execute.
 *
 * 1. Create a CommonJS entry that requires every prefix-only builtin family.
 * 2. Run the entry through the real ttsx launcher on the current Node runtime.
 * 3. Assert every builtin loads and the entry reaches its success marker.
 */
export const test_ttsx_commonjs_loads_prefix_only_node_builtins = () => {
  const root = TestProject.commonJsProject({
    "src/main.ts": `
      declare function require(specifier: string): unknown;
      const builtins = [
        "node:sqlite",
        "node:test",
        "node:test/reporters",
        "node:sea",
      ].map((specifier) => require(specifier));
      console.log(builtins.every((value) => value !== null && value !== undefined));
    `,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "true");
};
