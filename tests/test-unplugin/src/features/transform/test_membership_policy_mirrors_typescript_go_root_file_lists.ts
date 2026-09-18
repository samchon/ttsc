import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";

/**
 * Verifies the membership policy resolves `files` and `include` exactly as
 * TypeScript-Go's config parser does, default include included.
 *
 * A project with neither list compiles every file below its config
 * (`defaultIncludeSpec`), and the policy used to answer that case with "any
 * path at all", so tool output in `node_modules`, `.cache`, or `coverage`
 * counted as a membership change and cost a whole-project recompile
 * (samchon/ttsc#1385). The permissive answer now belongs only to a config that
 * cannot be read. How a list is inherited is the other half: a config that
 * declares a key owns it even as `null`, and among several `extends` entries
 * the last array wins, so an entry holding `null` does not erase an earlier
 * one.
 *
 * 1. Read policies for configs with no list, `null` and non-array values, a
 *    files-only list, an empty include, and both lists.
 * 2. Read policies whose lists are inherited through single and multiple `extends`
 *    entries, `${configDir}`, and a leaf that blocks inheritance.
 * 3. Assert each resolves to the lists TypeScript-Go would use, and an unreadable
 *    config keeps the permissive fallback.
 */
export async function test_membership_policy_mirrors_typescript_go_root_file_lists(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-unplugin-root-lists-");
  const at = (...segments: string[]): string =>
    path.join(root, ...segments).replace(/\\/g, "/");
  const read = (
    leaf: Record<string, unknown>,
    files: Record<string, unknown> = {},
  ) => {
    TestProject.writeFiles(root, {
      ...Object.fromEntries(
        Object.entries(files).map(([name, value]) => [
          name,
          JSON.stringify(value),
        ]),
      ),
      "tsconfig.json": JSON.stringify(leaf),
    });
    const specs = readProjectMembershipPolicy(
      path.join(root, "tsconfig.json"),
    ).rootFileSpecs;
    return specs && { files: specs.files, include: specs.include };
  };
  const everything = { files: [], include: [at("**", "*")] };

  assert.deepEqual(read({}), everything, "no list uses the default include");
  assert.deepEqual(read({ include: null }), everything, "null is no list");
  assert.deepEqual(read({ include: "src" }), everything, "a non-array too");
  assert.deepEqual(
    read({ files: ["src/main.ts"] }),
    { files: [at("src", "main.ts")], include: [] },
    "a files-only project has no implicit include",
  );
  assert.deepEqual(read({ include: [] }), { files: [], include: [] });
  assert.deepEqual(
    read({ files: ["a.ts", 1], include: ["src"] }),
    { files: [at("a.ts")], include: [at("src")] },
    "non-string entries are dropped, and both lists form a union",
  );

  assert.deepEqual(
    read(
      { extends: "./config/base.json" },
      { "config/base.json": { include: ["../src", "${configDir}/types"] } },
    ),
    { files: [], include: [at("src"), at("types")] },
    "an inherited list stays anchored at its declaring config, and configDir at the leaf",
  );
  assert.deepEqual(
    read(
      { extends: ["./first.json", "./second.json"] },
      {
        "first.json": { include: ["first"] },
        "second.json": { include: null },
      },
    ),
    { files: [], include: [at("first")] },
    "a later extends entry holding null does not erase an earlier list",
  );
  assert.deepEqual(
    read(
      { extends: ["./first.json", "./second.json"] },
      {
        "first.json": { include: ["first"] },
        "second.json": { include: ["second"] },
      },
    ),
    { files: [], include: [at("second")] },
    "the last extends entry holding an array wins",
  );
  assert.deepEqual(
    read(
      { extends: "./base.json", include: null },
      { "base.json": { include: ["inherited"] } },
    ),
    everything,
    "a leaf that declares the key blocks inheritance, even as null",
  );

  TestProject.writeFiles(root, { "tsconfig.json": "{ not json" });
  assert.equal(
    readProjectMembershipPolicy(path.join(root, "tsconfig.json")).rootFileSpecs,
    undefined,
    "an unreadable config keeps the permissive fallback",
  );
}
