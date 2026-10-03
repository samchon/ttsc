import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { matchesCachedSource } from "../../../../../packages/unplugin/src/core/transform/validation/matchesCachedSource";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a file excluded from the literal program can use complete snapshot
 * proof even when its root-relative name resembles an Object prototype member.
 *
 * This directly exercises the file-addressed validation operation. Extensionless
 * inputs are not represented as transformable TypeScript or native symlink cases.
 *
 * 1. Create constructor, __proto__ and ordinary files before real input capture.
 * 2. Observe a literal src/main.ts-only generation and require absent own baselines
 *    and outputs for those unrelated files.
 * 3. Permit unchanged program proof and unrelated edits, reject recorded source
 *    and config edits, and permit restored recorded bytes again.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual matchesCachedSource consumes an authored successful envelope whose program/external/universal snapshot is recorded from real files by observeValidationUnitGeneration. Excluded extensionless files have no own source baseline or output, so unchanged complete program proof must admit them rather than compare inherited prototype values as compiled hashes.
 * @evidence contracts/testing.md#independent-expectations The literal files list and literal output map contain only src/main.ts; constructor/__proto__/ordinary bytes are established before capture and have independently asserted absent own baseline entries. True/false expectations follow irrelevant versus recorded input edits, not an own-property guard copied as the verdict oracle.
 * @evidence contracts/testing.md#distinguishing-cases Both inherited-name forms contrast an ordinary absent key. Changing those excluded bytes leaves the program unchanged; editing its included source or the captured config rejects complete proof, and restoring the original bytes recovers. This owns the direct file-addressed boundary, not the transform coordinator's .ts filter or a native symlink occurrence.
 * @evidence contracts/testing.md#execution-ownership One discoverable unit uses actual native temporary files, existing snapshot observation and direct cached-source validation. Hashes establish observed capture data, not expected admission results. No compiler, watcher, installed consumer, native artifact, platform replacement or private tracker authority mutation runs.
 */
export function test_cached_source_reserved_names_keep_absent_baselines(): void {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-unplugin-reserved-baseline-"));
  const source = "export const value = 1;\n";
  const config = '{"files":["src/main.ts"]}';
  TestProject.writeFiles(root, {
    "src/main.ts": source,
    constructor: "unrelated constructor bytes\n",
    ["__proto__"]: "unrelated prototype bytes\n",
    ordinary: "ordinary unrelated bytes\n",
    "tsconfig.json": config,
  });
  const tsconfig = path.join(root, "tsconfig.json");
  const result: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: { "src/main.ts": source },
    hostInputs: [tsconfig],
    hostInputHashes: { [tsconfig]: createHash("sha256").update(config).digest("hex") },
  };
  const cached = observeValidationUnitGeneration(root, result);
  assert.deepEqual(Object.keys(cached.inputHashes), ["src/main.ts"]);
  assert.deepEqual(Object.keys(result.typescript), ["src/main.ts"]);
  const files = ["constructor", "__proto__", "ordinary"].map((name) => path.join(root, name));
  for (const file of files) {
    assert.equal(fs.lstatSync(file).isFile(), true, "the actual input is an ordinary extensionless file");
    assert.equal(Object.prototype.hasOwnProperty.call(cached.inputHashes, path.basename(file)), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.typescript, path.basename(file)), false);
    assert.equal(matchesCachedSource(cached, file, fs.readFileSync(file, "utf8"), undefined), true, "an unchanged program admits an unrelated file without a baseline");
    fs.appendFileSync(file, "unrelated edit\n");
    assert.equal(matchesCachedSource(cached, file, fs.readFileSync(file, "utf8"), undefined), true, "excluded bytes do not become a program dependency");
  }
  fs.writeFileSync(path.join(root, "src", "main.ts"), "export const value = 2;\n");
  for (const file of files) assert.equal(matchesCachedSource(cached, file, fs.readFileSync(file, "utf8"), undefined), false, "recorded source changed");
  fs.writeFileSync(path.join(root, "src", "main.ts"), source);
  for (const file of files) assert.equal(matchesCachedSource(cached, file, fs.readFileSync(file, "utf8"), undefined), true, "recorded source recovered");
  fs.writeFileSync(tsconfig, '{"files":["src/main.ts","constructor"]}');
  for (const file of files) assert.equal(matchesCachedSource(cached, file, fs.readFileSync(file, "utf8"), undefined), false, "recorded config changed");
  fs.writeFileSync(tsconfig, config);
  for (const file of files) assert.equal(matchesCachedSource(cached, file, fs.readFileSync(file, "utf8"), undefined), true, "recorded config recovered");
}
