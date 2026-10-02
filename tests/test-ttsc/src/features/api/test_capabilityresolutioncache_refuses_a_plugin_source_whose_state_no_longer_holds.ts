import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/readCapabilityResolution";
import { writeCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/writeCapabilityResolution";
import { hashHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/hashHostInputPaths";
import { realpathHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";
import { pluginSourceState } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceState";

/**
 * Verifies a cached capability answer is refused once a plugin source it was
 * built from no longer holds the state the entry recorded for it.
 *
 * A recorded binary path stands for the sources and build environment it was
 * built from. When a plugin's Go source is edited, the old binary still exists
 * on disk, so the reader must refuse the entry by the source state rather than
 * by the binary's presence, or a project that just changed its plugin keeps the
 * old plugin's capability answer (samchon/ttsc#1492).
 *
 * 1. Record an entry whose plugin source carries the state of a real Go module
 *    directory, and require it to hit.
 * 2. Edit the module's Go source and require the entry to be refused although the
 *    recorded binary still exists.
 * 3. Restore the original bytes and require the entry to hit again, then record
 *    an entry with a state different from the observed one and require refusal.
 *
 * @evidence contracts/testing.md#behavioral-verification writeCapabilityResolution and readCapabilityResolution run over a real Go module directory and a real binary file: the unchanged source hits, an edited main.go makes the reader return null while the binary file remains, the restored bytes hit again, and an entry recording an all-zero source state returns null.
 * @evidence contracts/testing.md#independent-expectations Authored edits, restoration and a recorded all-zero state established as different from the observed state decide hit or miss under the cache contract. Positive controls use pluginSourceState to record the state, so this test verifies cache invalidation rather than independently certifying the digest value.
 * @evidence contracts/testing.md#distinguishing-cases The positive cases are the unchanged and restored sources; the negatives are an edited source with an existing binary and a state that never matched. The writer also records a source digest and metadata signature when the files are separable from its clock reference, so which of the full-read or metadata-accelerated proofs a given run takes is decided by the writer; the unchanged and restored controls and the edit must hold under either, and the accelerated branch alone is not pinned.
 * @evidence contracts/testing.md#execution-ownership A unit test calling the TypeScript capability reader, writer and source-state composer directly over files in a private temp directory with TTSC_CACHE_DIR pointing at it; it reads the Go build environment through the product reader but builds no plugin and starts no ttsc host.
 */
export function test_capabilityresolutioncache_refuses_a_plugin_source_whose_state_no_longer_holds() {
  const cwd = TestProject.tmpdir("ttsc-capability-source-state-");
  const cache = path.join(cwd, "cache");
  const source = path.join(cwd, "plugin");
  const binary = path.join(cwd, "plugin.exe");
  const tsconfig = path.join(cwd, "tsconfig.json");
  const manifest = path.join(cwd, "package.json");
  TestProject.copyDirectory(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "test", "fixtures", "unit", "capabilityresolutioncache_refuses_a_plugin_source_whose_state_no_longer_holds", "inputs-1"), source);
  fs.renameSync(path.join(source, "main.go.txt"), path.join(source, "main.go"));
  const original = fs.readFileSync(path.join(source, "main.go"), "utf8");
  fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: {} }));
  fs.writeFileSync(manifest, JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(binary, "binary");
  const key = {
    cwd,
    env: { TTSC_CACHE_DIR: cache },
    tsconfig: "tsconfig.json",
    version: "1.2.3",
  };
  const record = (state: string): void => {
    writeCapabilityResolution(key, {
      hostInputHashes: hashHostInputPaths([tsconfig, manifest]),
      hostInputRealpaths: realpathHostInputPaths([tsconfig, manifest]),
      hostInputs: [tsconfig, manifest],
      manifest: '[{"name":"@unit/plugin","stage":"check"}]',
      pluginSources: { [source]: state },
      plugins: [{ binary, capabilities: { graphNodes: true } }],
      projectContext: null,
    });
  };

  const initialState = pluginSourceState(source);
  const differentState = "0".repeat(64);
  assert.notEqual(initialState, differentState);
  record(initialState);
  assert.notEqual(
    readCapabilityResolution(key),
    null,
    "an unchanged plugin source did not answer from its own entry",
  );

  fs.writeFileSync(
    path.join(source, "main.go"),
    "package main\n\nfunc main() { println(1) }\n",
  );
  assert.equal(fs.existsSync(binary), true);
  assert.equal(
    readCapabilityResolution(key),
    null,
    "an edited plugin source still answered because its old binary exists",
  );

  fs.writeFileSync(path.join(source, "main.go"), original);
  assert.notEqual(
    readCapabilityResolution(key),
    null,
    "the restored plugin source no longer matched its recorded state",
  );

  record(differentState);
  assert.equal(
    readCapabilityResolution(key),
    null,
    "a state different from the observed source was believed",
  );
}
