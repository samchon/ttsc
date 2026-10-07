import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pluginSourceState } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceState";
import { pluginSourceStateHolds } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceStateHolds";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies source-state proof follows a Go environment-file change without a
 * variable change.
 *
 * GOENV can change a build's effective flags while the process environment
 * stays fixed. The kept environment reading must agree with the fresh producer
 * state, accept that state and refuse the earlier state.
 *
 * 1. Copy the package-owned source and point GOENV at a private empty file.
 * 2. Write GOFLAGS into that file and compare the fresh and kept readings.
 * 3. Accept the fresh state, refuse the old state and restore GOENV in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct pluginSourceState and pluginSourceStateHolds calls preserve all five original assertions: initial acceptance, a changed fresh state, kept/fresh agreement, fresh acceptance and stale-state refusal after a private GOENV edit.
 * @evidence contracts/testing.md#independent-expectations The literal GOFLAGS file edit establishes an external input transition while source bytes and variables stay fixed. The supported fresh-versus-kept environment contract supplies inequality/equality and true/false expectations independently of their computed digest strings.
 * @evidence contracts/testing.md#distinguishing-cases Initial state is valid before the file-only mutation; afterwards the fresh state must hold and the old state must fail. Caller-supplied source digest behavior and supplied-reading composition have separate named API units.
 * @evidence contracts/testing.md#execution-ownership This named API unit calls the actual authored source-state owners using package-owned fixture bytes copied by TestProject. Real Go environment queries/toolchain observations run synchronously, but no native artifact, installed consumer or real compiler/product host is created. GOENV is restored in finally and TestProject owns private roots.
 */
export function test_plugin_source_state_holds_reads_the_environment_again_before_refuting(): void {
  const root = TestProject.tmpdir("ttsc-plugin-source-goenv-");
  const source = path.join(root, "plugin");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "e2e",
      "plugin_source_state_holds_reads_the_environment_again_before_refuting",
      "inputs-1",
    ),
    source,
  );
  const goenv = path.join(root, "go.env");
  fs.writeFileSync(goenv, "");
  const previous = process.env.GOENV;
  process.env.GOENV = goenv;
  try {
    const before = pluginSourceState(source);
    assert.equal(pluginSourceStateHolds(source, before), true);
    fs.writeFileSync(goenv, "GOFLAGS=-tags=ttsc_goenv_probe\n");
    const fresh = pluginSourceState(source, { env: process.env });
    assert.notEqual(fresh, before, "the environment file moved the state");
    assert.equal(
      pluginSourceState(source),
      fresh,
      "the process's reading follows the environment file",
    );
    assert.equal(
      pluginSourceStateHolds(source, fresh),
      true,
      "the state a compile would report now holds",
    );
    assert.equal(pluginSourceStateHolds(source, before), false);
  } finally {
    if (previous === undefined) delete process.env.GOENV;
    else process.env.GOENV = previous;
  }
}
