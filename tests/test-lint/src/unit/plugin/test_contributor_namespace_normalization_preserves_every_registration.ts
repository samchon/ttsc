import assert from "node:assert/strict";

import { normalizeContributors } from "../../../../../packages/lint/src/internal/normalizeContributors";

/**
 * Verifies namespace collisions fail deterministically before repeated names fold.
 *
 * The config evaluator has already resolved contributor sources when this
 * decision runs. Its permutations and precedence do not require another host.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored normalizeContributors detects distinct namespaces that share a Go name and preserves exact repeated namespaces' first source; diagnostics and returned descriptors are asserted directly.
 * @evidence contracts/testing.md#independent-expectations Go package naming replaces hyphens with underscores, while distinct user namespaces must never be discarded. Literal name/source descriptors and diagnostic spellings independently express those contracts.
 * @evidence contracts/testing.md#distinguishing-cases Two-way collisions in both orders, three-way collisions, exact repetition with different source paths, two independent namespaces, a single hyphenated namespace and an empty list retain the original CJS case's meaningful decisions. A second collision group pins deterministic ordering across groups.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the owning normalization operation without filesystem preparation, config evaluation or native build. Surviving CJS and TypeScript collision E2E entries retain real evaluator transport and config-path diagnostics.
 */
export function test_contributor_namespace_normalization_preserves_every_registration(): void {
  const entries = (names: string[]) => names.map((namespace, index) => ({ namespace, source: "/contributors/source-" + index }));
  const collision = (names: string[], goName: string): string => {
    let message = "";
    assert.throws(() => normalizeContributors(entries(names), "/fixture/lint.config.cjs"), (error: unknown) => {
      assert.ok(error instanceof Error);
      message = error.message;
      assert.match(message, /lint\.config\.cjs/);
      assert.ok(message.includes(JSON.stringify(goName)));
      for (const name of names) assert.ok(message.includes(JSON.stringify(name)));
      return true;
    });
    return message;
  };
  assert.equal(collision(["a-b", "a_b"], "a_b"), collision(["a_b", "a-b"], "a_b"));
  collision(["a-b-c", "a_b-c", "a-b_c"], "a_b_c");
  assert.deepEqual(normalizeContributors([
    {namespace: "react-hooks", source: "/contributors/first"},
    {namespace: "react-hooks", source: "/contributors/later"},
  ], "/fixture/lint.config.cjs"), [{name: "react_hooks", source: "/contributors/first"}]);
  assert.deepEqual(normalizeContributors(entries(["a-b", "c-d"]), "/fixture/lint.config.cjs"), [
    {name: "a_b", source: "/contributors/source-0"},
    {name: "c_d", source: "/contributors/source-1"},
  ]);
  assert.deepEqual(normalizeContributors(entries(["react-hooks"]), "/fixture/lint.config.cjs"), [{name: "react_hooks", source: "/contributors/source-0"}]);
  assert.deepEqual(normalizeContributors([], "/fixture/lint.config.cjs"), []);
  const multi = collision(["z-z", "z_z", "a-a", "a_a"], "a_a");
  assert.ok(multi.indexOf('"a-a", "a_a"') < multi.indexOf('"z-z", "z_z"'), multi);
}
