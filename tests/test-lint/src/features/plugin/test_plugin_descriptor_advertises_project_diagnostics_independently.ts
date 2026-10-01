import assert from "node:assert/strict";

import { TestLintPlugin } from "../internal/TestLintPlugin";

/**
 * Verifies the lint descriptor advertises standalone project diagnostics.
 *
 * `projectInputs` promises only filesystem topology. The LSP launcher must see
 * a separate capability before invoking `lsp-project-diagnostics`, otherwise a
 * third-party topology-only sidecar is probed with an unsupported command.
 *
 * 1. Call the authored `@ttsc/lint` descriptor factory.
 * 2. Construct its check-stage plugin descriptor.
 * 3. Assert project diagnostics and project inputs are advertised separately.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored factory must return true for both projectDiagnostics and projectInputs separately, detecting loss of the diagnostics capability despite retained topology support.
 * @evidence contracts/testing.md#independent-expectations The public plugin protocol treats diagnostics support and input topology as distinct promises; each must be explicitly advertised by lint.
 * @evidence contracts/testing.md#distinguishing-cases The two separate true assertions distinguish a topology-only descriptor from lint diagnostics support; built descriptor assembly is checked in the surviving package boundary.
 * @evidence contracts/testing.md#execution-ownership This named source unit constructs the descriptor through the authored factory without building or launching the native plugin.
 */
export function test_plugin_descriptor_advertises_project_diagnostics_independently(): void {
    const factory = TestLintPlugin.loadFactory();
    const descriptor = factory(
      TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    );

    assert.equal(descriptor.capabilities?.projectDiagnostics, true);
    assert.equal(descriptor.capabilities?.projectInputs, true);
  }
