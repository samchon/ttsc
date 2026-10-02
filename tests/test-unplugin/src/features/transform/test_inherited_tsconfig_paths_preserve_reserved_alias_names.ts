import assert from "node:assert/strict";
import path from "node:path";

import { readEffectiveTsconfigPaths } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigPaths";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies inherited paths retain reserved JavaScript property names as aliases.
 *
 * A configuration names aliases, not object prototype operations. Relocating
 * inherited mappings must preserve each declared key in serialized output.
 *
 * 1. Write a base config with literal __proto__, constructor and ordinary paths,
 *    then extend it from a child directory.
 * 2. Read the actual effective overlay and compare all own entries with
 *    independently anchored targets.
 * 3. Check serialized mappings retain the same aliases and that an absent
 *    reserved name has not acquired an inherited mapping.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual inherited-path reader over two native configuration files and checks reserved alias keys survive target anchoring, own-entry enumeration and JSON serialization.
 * @evidence contracts/testing.md#independent-expectations Literal JSON configuration keys and authored absolute target paths define expectations; no adapter path reader constructs expected mappings.
 * @evidence contracts/testing.md#distinguishing-cases __proto__ and constructor contrast with an ordinary alias and absent toString. Own-entry and serialized output checks reject an alias that only changes the returned object's prototype.
 * @evidence contracts/testing.md#execution-ownership A source unit calls readEffectiveTsconfigPaths directly on a temporary extends chain. No TypeScript compiler, plugin binary or consumer host runs; this checks wrapper input assembly rather than actual import resolution.
 */
export function test_inherited_tsconfig_paths_preserve_reserved_alias_names(): void {
  const root = TestProject.createProject({
    "base.json": '{"compilerOptions":{"paths":{"__proto__":["./src/proto.ts"],"constructor":["./src/constructor.ts"],"ordinary":["./src/ordinary.ts"]}}}',
    "child/tsconfig.json": '{"extends":"../base.json"}',
  });
  const actual = readEffectiveTsconfigPaths(path.join(root, "child", "tsconfig.json"));
  const entries: Array<[string, string[]]> = [
    ["__proto__", [path.join(root, "src", "proto.ts").split(path.sep).join("/")]],
    ["constructor", [path.join(root, "src", "constructor.ts").split(path.sep).join("/")]],
    ["ordinary", [path.join(root, "src", "ordinary.ts").split(path.sep).join("/")]],
  ];
  const failures: unknown[] = [];
  for (const check of [
    () => assert.deepEqual(Object.entries(actual), entries),
    () => assert.equal(Object.hasOwn(actual, "__proto__"), true),
    () => assert.deepEqual(JSON.parse(JSON.stringify(actual)), Object.fromEntries(entries)),
    () => assert.equal(Object.hasOwn(actual, "toString"), false),
  ]) {
    try { check(); } catch (error) { failures.push(error); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "Inherited alias ownership failed");
}
