import { assertViteAdapterTransformsSource } from "../../internal/adapter-vite";

/**
 * Verifies vite adapter runs the configured ttsc source transform.
 *
 * This unplugin adapter scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_vite_adapter_runs_the_configured_ttsc_source_transform =
  async () => {
    await assertViteAdapterTransformsSource();
  };
