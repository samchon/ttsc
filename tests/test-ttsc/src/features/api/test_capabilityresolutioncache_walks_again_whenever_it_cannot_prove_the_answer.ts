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
 * Verifies capability-cache proof follows selected source and effective build
 * inputs.
 *
 * A binary that still exists does not prove its source state. Own and sibling
 * packages, module configuration, dot-directory files and new source files all
 * belong to the source population; node_modules changes are deliberately
 * pruned.
 *
 * 1. Copy package-owned Go inputs and record a valid source-bearing answer.
 * 2. Re-record before each selected-source change and require the old answer
 *    refused.
 * 3. Contrast a GOFLAGS transition with a pruned node_modules edit, restoring
 *    flags.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual read/write cache owners preserve initial acceptance and graphNodes declaration, refuse own/sibling/module/dot/new source changes and a real GOFLAGS change, and retain an answer across a node_modules-only change.
 * @evidence contracts/testing.md#independent-expectations Authored selected/pruned inputs and literal source/environment mutations establish which build inputs moved. Every transition first records and accepts its own unchanged state; literal null/non-null and graphNodes true expectations follow cache freshness and source selection, independently of digest computation.
 * @evidence contracts/testing.md#distinguishing-cases Five selected-source changes and one effective environment change contrast with the irrelevant node_modules control. Every negative case retains its pre-change valid-hit control, and the pruned control now also verifies its baseline. Host input, binary, malformed and version proof differences have a separate named API unit.
 * @evidence contracts/testing.md#execution-ownership This named API unit invokes actual authored cache and source-state owners over TestProject-private paths and copied package-owned Go fixture bytes. It may synchronously query real Go/toolchain state, but builds no native artifact, installs no consumer and starts no real compiler or product host. GOFLAGS is restored in finally; no foreign filesystem method is replaced.
 */
export function test_capabilityresolutioncache_walks_again_whenever_it_cannot_prove_the_answer(): void {
  const cwd = TestProject.tmpdir("ttsc-capability-resolution-");
  const cache = path.join(cwd, "cache");
  const module = path.join(cwd, "plugin-module");
  const binary = path.join(cwd, "plugin.exe");
  const tsconfig = path.join(cwd, "tsconfig.json");
  const manifest = path.join(cwd, "package.json");
  fs.writeFileSync(tsconfig, JSON.stringify({ compilerOptions: {} }));
  fs.writeFileSync(manifest, JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(binary, "binary");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "capabilityresolutioncache_walks_again_whenever_it_cannot_prove_the_answer",
      "inputs-1",
    ),
    module,
  );
  for (const parts of [
    ["cmd", "plugin", "main.go"],
    ["internal", "mark", "mark.go"],
    [".generated", "gen.go"],
  ]) {
    const file = path.join(module, ...parts);
    fs.renameSync(`${file}.txt`, file);
  }
  const key = {
    cwd,
    env: { TTSC_CACHE_DIR: cache },
    tsconfig: "tsconfig.json",
    version: "1.2.3",
  };
  const record = (): void => {
    writeCapabilityResolution(key, {
      hostInputHashes: hashHostInputPaths([tsconfig, manifest]),
      hostInputRealpaths: realpathHostInputPaths([tsconfig, manifest]),
      hostInputs: [tsconfig, manifest],
      manifest: '[{"name":"@ttsc/lint","stage":"check"}]',
      pluginSources: { [module]: pluginSourceState(module) },
      plugins: [{ binary, capabilities: { graphNodes: true } }],
      projectContext: '{"physicalProjectRoot":"/fixture"}',
    });
  };
  const read = () => readCapabilityResolution(key);
  const changeSelectedInput = (name: string, change: () => void): void => {
    record();
    assert.notEqual(read(), null, `${name}: the entry holds before the change`);
    change();
    assert.equal(
      read(),
      null,
      `${name}: changed build inputs must refuse reuse`,
    );
  };
  record();
  const hit = read();
  assert.notEqual(hit, null, "an unchanged source-bearing project must hit");
  assert.equal(hit!.plugins[0]?.capabilities.graphNodes, true);
  changeSelectedInput("own package", () => {
    fs.writeFileSync(
      path.join(module, "cmd", "plugin", "main.go"),
      "package main\n\nfunc main() {}\n",
    );
  });
  changeSelectedInput("sibling package", () => {
    fs.writeFileSync(
      path.join(module, "internal", "mark", "mark.go"),
      "package mark\n\n// edited\n",
    );
  });
  changeSelectedInput("module configuration", () => {
    fs.appendFileSync(path.join(module, "go.mod"), "\n// edited\n");
  });
  changeSelectedInput("dot-directory source", () => {
    fs.writeFileSync(
      path.join(module, ".generated", "gen.go"),
      "package generated\n\n// edited\n",
    );
  });
  changeSelectedInput("new source", () => {
    fs.writeFileSync(path.join(module, "extra.go"), "package main\n");
  });
  const previousFlags = process.env.GOFLAGS;
  const changedFlags =
    previousFlags === "-tags=ttsc_capability_cache_probe"
      ? "-tags=ttsc_capability_cache_probe_changed"
      : "-tags=ttsc_capability_cache_probe";
  try {
    changeSelectedInput("Go build environment", () => {
      process.env.GOFLAGS = changedFlags;
    });
  } finally {
    if (previousFlags === undefined) delete process.env.GOFLAGS;
    else process.env.GOFLAGS = previousFlags;
  }
  record();
  assert.notEqual(
    read(),
    null,
    "the entry holds before its pruned input changes",
  );
  fs.writeFileSync(
    path.join(module, "node_modules", "pkg", "index.js"),
    "// moved\n",
  );
  assert.notEqual(read(), null, "a pruned input must not discard the answer");
}
