import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { CompilerApiWorkspace } from "../internal/ttsc/internal/CompilerApiWorkspace";
import { test_ttsccompiler_plugin_free_compile_and_transform_share_one_project } from "./ttsc/api/test_ttsccompiler_plugin_free_compile_and_transform_share_one_project";
import { test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries } from "./ttsc/compiler/test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries";

/**
 * Runs real API and compiler/CLI/watch profiles on one owned corpus allocation.
 * The API first enters its exact baseline and overlays in project/. The CLI
 * owner then writes its original corpus, support and subproject inputs into the
 * same allocation; native tool identity is shared, never a compiled result.
 *
 * 1. Allocate one root and execute the original plugin-free API state matrix.
 * 2. After that matrix completes, stage the compiler corpus and its original watch inputs.
 * 3. Collect compiler/CLI/watch verdicts and retain the owner for observation.
 *
 * @evidence contracts/testing.md#behavioral-verification The API owns its nine native calls and record/diagnostic/no-disk-output literals; the compiler corpus owns its existing emit/refusal/cache/JSX/watch assertions. This entry changes their preparation owner, not expected outcomes.
 * @evidence contracts/testing.md#independent-expectations Original fixture markers, exact diagnostics, emitted paths, source ownership and later watcher completion markers stay in their owning bodies.
 * @evidence contracts/testing.md#distinguishing-cases API in-memory operations precede actual disk emission. Each configuration and watch transition retains separate requests; an unsuccessful API prerequisite blocks mutation of its borrowed input.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated Real compiler entry selects these already shared native API and compiler corpora without separately allocating both project roots.
 * @evidence contracts/e2e.md#necessary-boundary Native API replies, actual emitted bytes and live watch process protocols require the real producer; a scripted compiler or DTO unit is not their oracle.
 * @evidence contracts/e2e.md#shared-execution One allocation and fixed checkout compiler tools serve the API and CLI/watch phases. Every actual request and constructor remains independently counted; compiler instance, generation and Program construction are not conflated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The API retains its exact bounded baseline/overlay reset. After successful API completion, its observed entries are moved into an owned sibling holding directory while the physical project root stays unchanged; CLI staging therefore starts without an API package manifest or dotted source/output tree. Borrowed owners do not remove the common root. The root stays retained on both success and failure for actual join and trace observation.
 * @evidence contracts/e2e.md#preserved-coverage Both existing owner bodies keep all current assertions and names, including distinct API failures and compiler/watch negative recovery. Other approved Real compiler profiles and actual selected execution remain pending, and donor removal is not authorized by this body.
 */
export async function test_e2e_compiler(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-shared-real-compiler-");
  TestProject.retainTemporaryDirectory(root);
  const project = path.join(root, "project");
  fs.mkdirSync(project);
  CompilerApiWorkspace.enter({ root: project }, "baseline");
  try {
    await test_ttsccompiler_plugin_free_compile_and_transform_share_one_project({ root: project });
  } catch (cause) {
    throw new AggregateError([new Error("real compiler API profiles", { cause })], "CLI profiles blocked by failed API prerequisite");
  }
  const observed = path.join(root, "api-observed");
  fs.mkdirSync(observed);
  for (const name of fs.readdirSync(project))
    fs.renameSync(path.join(project, name), path.join(observed, name));
  await test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries(true, root);
}
