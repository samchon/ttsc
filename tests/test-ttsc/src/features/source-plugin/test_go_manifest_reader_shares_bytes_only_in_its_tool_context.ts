import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies copied Go manifests share parsing without hiding current edits.
 *
 * Go owns grammar; equivalent bytes inside one selected-tool reader can share
 * its parsed syntax while separate loads and edited manifests cannot.
 *
 * 1. Copy one maintained native fixture into two independent source directories.
 * 2. Observe equal bytes through one reader, then change and remove a manifest.
 * 3. Refuse invalid syntax, repair it, and distinguish a separate reader scope.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual selected Go parses maintained manifest bytes; equal copies return the same parsed record, edited bytes change module identity, missing manifests return no module, malformed syntax throws and restored bytes recover. A separate reader returns equivalent but independently acquired data.
 * @evidence contracts/testing.md#independent-expectations The maintained fixture declares example.com/plugin; an authored module-name edit declares example.com/changed. Identity equality contrasts reuse with fresh acquisition, and native removal/invalid syntax independently require absence/refusal.
 * @evidence contracts/testing.md#distinguishing-cases Same bytes at different scratch addresses, changed bytes at the same address, missing/repaired manifest, invalid grammar and different reader contexts distinguish content reuse from pathname or global positive caching.
 * @evidence contracts/testing.md#execution-ownership Discovered ttsc source unit copies the existing native fixture and invokes real selected Go mod edit through the actual reader. No compiler/plugin binary is built, no tool method is replaced, and no consumer install or host starts; TestProject owns temporary cleanup.
 */
export function test_go_manifest_reader_shares_bytes_only_in_its_tool_context(): void {
  const root = TestProject.tmpdir("ttsc-manifest-context-");
  const fixture = path.join(TestProject.WORKSPACE_ROOT, "packages/unplugin/test/fixtures/e2e/createMovingEnvironmentFixture/inputs-1/plugin");
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  TestProject.copyDirectory(fixture, first);
  TestProject.copyDirectory(fixture, second);
  const go = GoToolResolution.resolveGoToolForBuild(resolveGoCompiler(process.env).binary, process.env, first);
  const reader = SourcePluginWorkspace.createGoModReader(go, "manifest-context", process.env);
  const original = fs.readFileSync(path.join(first, "go.mod"), "utf8");
  const parsed = reader.read(first);
  assert.equal(parsed.modulePath, "example.com/plugin");
  assert.equal(reader.read(second), parsed, "identical materialized bytes share one actual Go parse");
  const manifest = path.join(second, "go.mod");
  fs.writeFileSync(manifest, original.replace("example.com/plugin", "example.com/changed"));
  const changed = reader.read(second);
  assert.notEqual(changed, parsed);
  assert.equal(changed.modulePath, "example.com/changed");
  fs.unlinkSync(manifest);
  assert.equal(reader.read(second).modulePath, null);
  fs.writeFileSync(manifest, "this is not a Go module directive\n");
  assert.throws(() => reader.read(second), /reading go.mod/);
  fs.writeFileSync(manifest, original);
  assert.equal(reader.read(second), parsed);
  const separate = SourcePluginWorkspace.createGoModReader(go, "another-load", process.env).read(first);
  assert.notEqual(separate, parsed, "a new tool/load context acquires its own Go observation");
  assert.deepEqual(separate, parsed);
}
