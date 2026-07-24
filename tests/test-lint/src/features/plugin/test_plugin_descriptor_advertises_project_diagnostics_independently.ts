import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies the lint descriptor advertises standalone project diagnostics.
 *
 * `projectInputs` promises only filesystem topology. The LSP launcher must see
 * a separate capability before invoking `lsp-project-diagnostics`, otherwise a
 * third-party topology-only sidecar is probed with an unsupported command.
 *
 * 1. Load the built `@ttsc/lint` descriptor factory.
 * 2. Construct its check-stage plugin descriptor.
 * 3. Assert project diagnostics and project inputs are advertised separately.
 */
export const test_plugin_descriptor_advertises_project_diagnostics_independently =
  () => {
    const factory = TestLintPlugin.loadFactory();
    const descriptor = factory(
      TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    );

    assert.equal(descriptor.capabilities?.projectDiagnostics, true);
    assert.equal(descriptor.capabilities?.projectInputs, true);
  };
