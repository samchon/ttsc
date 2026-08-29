import { assertAPassIgnoresAnUndeclaredProjectFileEdit } from "../../internal/transform-delivery-epoch";

/**
 * Verifies a pass keeps the generation when a file nothing compiled changes.
 *
 * A project root is a working directory: logs, coverage reports and generated
 * artifacts are written there while a build runs. Only a file the generation
 * declares as an input can change an output, so proving the pass against the
 * whole walk instead of the declared set would hand back the per-pass recompile
 * for a file no compile ever read. This is the boundary case of the reuse
 * rule.
 *
 * 1. Plant a non-source file under `src` before the first pass.
 * 2. Deliver every module, rewrite that file in place, open a second pass.
 * 3. Assert the fixture plugin still ran exactly one whole-project compile.
 */
export const test_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit =
  async () => {
    await assertAPassIgnoresAnUndeclaredProjectFileEdit();
  };
