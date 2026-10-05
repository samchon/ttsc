import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { hashHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/hashHostInputPaths";
import { realpathHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";
import { readCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/readCapabilityResolution";
import { pluginSourceState } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceState";
import { writeCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/writeCapabilityResolution";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies capability-cache source proof trusts a digest only while metadata
 * holds.
 *
 * Corrupting only the stored digest distinguishes metadata reuse from a fresh
 * content reading: unchanged metadata must refuse that digest, whereas moved
 * metadata must reread the unchanged source bytes and accept their recorded
 * state.
 *
 * 1. Copy package-owned source inputs, settle their timestamps and record a hit.
 * 2. Corrupt the stored digest while retaining its signature and require a miss.
 * 3. Rewrite identical bytes to move metadata, corrupt the digest and require a
 *    hit.
 * 4. Edit source bytes after a valid record and require a miss.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct writeCapabilityResolution/readCapabilityResolution calls execute actual source-state and metadata proof. The original unchanged-hit, corrupted-digest miss, moved-metadata hit and changed-byte miss all remain, including stored-signature assertions.
 * @evidence contracts/testing.md#independent-expectations Authored fixture bytes and explicit timestamp/content transitions supply the oracle. Each tampered digest is asserted different from the persisted observed digest, rather than claiming any digest impossible; signature presence and actual mtime movement establish the tested lanes independently of read output.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged metadata trusts the deliberately wrong stored digest and refuses its state; changed metadata with identical bytes must ignore that digest and reread successfully, while changed bytes must refuse. A valid hit immediately precedes each refusing transition. Host proof/version/binary boundaries have a separate named API unit.
 * @evidence contracts/testing.md#execution-ownership This named API unit directly calls authored cache owners over private filesystem inputs and package-owned Go fixture bytes copied with TestProject. Real synchronous Go/toolchain environment observations may run; no native artifact is built, consumer installed or product host launched. No filesystem global is replaced and TestProject owns temporary roots.
 */
export function test_capabilityresolutioncache_reads_plugin_sources_only_when_their_metadata_moved(): void {
  const cwd = TestProject.tmpdir("ttsc-capability-source-reads-");
  const cache = path.join(cwd, "cache");
  const module = path.join(cwd, "plugin-module");
  const binary = path.join(cwd, "plugin.exe");
  const tsconfig = path.join(cwd, "tsconfig.json");
  fs.writeFileSync(tsconfig, "{}");
  fs.writeFileSync(binary, "binary");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "capabilityresolutioncache_reads_plugin_sources_only_when_their_metadata_moved",
      "inputs-1",
    ),
    module,
  );
  for (const parts of [
    ["cmd", "plugin", "main.go"],
    ["internal", "mark", "mark.go"],
  ]) {
    const file = path.join(module, ...parts);
    fs.renameSync(`${file}.txt`, file);
  }
  const files = [
    path.join(module, "go.mod"),
    path.join(module, "cmd", "plugin", "main.go"),
    path.join(module, "internal", "mark", "mark.go"),
  ];
  const settle = (): void => {
    const past = new Date(Date.now() - 3_600_000);
    for (const file of files) fs.utimesSync(file, past, past);
  };
  const key = {
    cwd,
    env: { TTSC_CACHE_DIR: cache },
    tsconfig: "tsconfig.json",
    version: "1.2.3",
  };
  const record = (): void => {
    writeCapabilityResolution(key, {
      hostInputHashes: hashHostInputPaths([tsconfig]),
      hostInputRealpaths: realpathHostInputPaths([tsconfig]),
      hostInputs: [tsconfig],
      manifest: "[]",
      pluginSources: { [module]: pluginSourceState(module) },
      plugins: [{ binary, capabilities: { graphNodes: true } }],
      projectContext: null,
    });
  };
  const answers = (): boolean => readCapabilityResolution(key) !== null;
  const misrecord = (): void => {
    const directory = path.join(cache, "capabilities");
    const entries = fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".json"));
    assert.equal(entries.length, 1, "exactly one authored cache entry");
    const file = path.join(directory, entries[0]!);
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
      pluginSources: Record<string, { digest?: string; signature?: string }>;
    };
    const source = entry.pluginSources[module]!;
    assert.equal(typeof source.signature, "string", "a signature was kept");
    const differentDigest = "0".repeat(64);
    assert.notEqual(
      source.digest,
      differentDigest,
      "the corruption changes the observed digest",
    );
    source.digest = differentDigest;
    fs.writeFileSync(file, JSON.stringify(entry), "utf8");
  };
  settle();
  record();
  assert.equal(answers(), true);
  misrecord();
  assert.equal(
    answers(),
    false,
    "unchanged metadata must trust and refuse the corrupted digest",
  );
  settle();
  record();
  assert.equal(answers(), true, "the entry holds before its metadata moves");
  const previousMtime = fs.statSync(files[1]!).mtimeMs;
  fs.writeFileSync(files[1]!, "package main\n");
  assert.notEqual(fs.statSync(files[1]!).mtimeMs, previousMtime);
  misrecord();
  assert.equal(answers(), true, "moved metadata must reread unchanged bytes");
  settle();
  record();
  assert.equal(answers(), true, "the entry holds before its bytes change");
  fs.writeFileSync(files[2]!, "package mark\n\n// edited\n");
  assert.equal(answers(), false);
}
