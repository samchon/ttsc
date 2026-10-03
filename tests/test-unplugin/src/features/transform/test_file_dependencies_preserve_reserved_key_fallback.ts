import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { selectFileDependencies } from "../../../../../packages/unplugin/src/core/transform/envelope/selectFileDependencies";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies exact own dependency entries and alternate producer spelling fallback
 * remain distinct when file keys resemble Object prototype members.
 *
 * This owns the direct file-addressed selector boundary. Extensionless files do
 * not claim a transformable TypeScript delivery or actual native bundler occurrence.
 *
 * 1. Create constructor, __proto__ and ordinary files before identity derivation.
 * 2. Report only absolute file keys and require their literal config dependency.
 * 3. Add own relative entries in a separate envelope and require their different
 *    config to take precedence; contrast an actually absent unreported file.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual selectFileDependencies receives native extensionless file addresses and authored absolute-key dependency records. Absent own relative keys must permit the physical-identity fallback; own relative records in a distinct immutable envelope take precedence and a truly missing unreported file returns an empty list.
 * @evidence contracts/testing.md#independent-expectations Literal fallback.json and exact.json paths specify different producer dependencies independently of the selector/index. Own-key absence confirms fixture setup but does not compute the expected list. The native files exist before envelope identity derivation, and the missing-file negative is independently absent on disk and from the producer record.
 * @evidence contracts/testing.md#distinguishing-cases constructor and __proto__ contrast an ordinary key under both absolute fallback and own-relative precedence. Distinct configs make the precedence decision observable; the missing unreported address returns no guessed dependency. Lexical aliases and duplicate spelling preservation retain their existing test_watch_inputs_preserve_graph_dependency_and_alias_rules owner and are not repeated here.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit directly calls the selector over real native temporary files and authored dependency maps. No compiler, watcher, process, installed artifact, native symlink, platform replacement or private generation authority is involved. Native producer/bundler connection remains outside this portable selector oracle.
 */
export function test_file_dependencies_preserve_reserved_key_fallback(): void {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-unplugin-dependency-keys-"));
  TestProject.writeFiles(root, {
    constructor: "constructor input\n",
    ["__proto__"]: "prototype input\n",
    ordinary: "ordinary input\n",
    "configs/fallback.json": "{}\n",
    "configs/exact.json": "{}\n",
  });
  const fallback = path.join(root, "configs", "fallback.json");
  const exact = path.join(root, "configs", "exact.json");
  const names = ["constructor", "__proto__", "ordinary"];
  const absolute = Object.fromEntries(names.map((name) => [path.join(root, name), [fallback]]));
  const fallbackResult: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: {},
    dependencies: absolute,
  };
  const exactResult: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: {},
    dependencies: Object.fromEntries([
      ...Object.entries(absolute),
      ...names.map((name) => [name, [exact]] as const),
    ]),
  };
  for (const name of names) {
    const file = path.join(root, name);
    assert.equal(fs.lstatSync(file).isFile(), true, "an actual ordinary extensionless input");
    assert.equal(Object.prototype.hasOwnProperty.call(absolute, name), false);
    assert.deepEqual(selectFileDependencies({ file, projectRoot: root, result: fallbackResult }), [fallback], `${name}: absent own key permits alternate producer spelling`);
    assert.equal(Object.prototype.hasOwnProperty.call(exactResult.dependencies, name), true);
    assert.deepEqual(selectFileDependencies({ file, projectRoot: root, result: exactResult }), [exact], `${name}: own relative entry takes precedence over the earlier absolute entry`);
  }
  const missing = path.join(root, "missing");
  assert.equal(fs.existsSync(missing), false);
  assert.equal(Object.prototype.hasOwnProperty.call(absolute, missing), false);
  assert.deepEqual(selectFileDependencies({ file: missing, projectRoot: root, result: fallbackResult }), [], "an unreported missing input has no dependency list");
}
