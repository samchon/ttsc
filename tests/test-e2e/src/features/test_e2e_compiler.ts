import { Scenarios } from "../internal/Scenarios";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { CompilerApiWorkspace } from "../internal/ttsc/internal/CompilerApiWorkspace";
import { test_ttsccompiler_plugin_free_compile_and_transform_share_one_project } from "./ttsc/api/test_ttsccompiler_plugin_free_compile_and_transform_share_one_project";
import { test_compilerusescasesensitivefilenames_answers_what_the_compiler_reports } from "./ttsc/api/test_compilerusescasesensitivefilenames_answers_what_the_compiler_reports";
import { test_factory_jsx_strings_roundtrip_through_native_compile } from "./ttsc/api/test_factory_jsx_strings_roundtrip_through_native_compile";
import { test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries } from "./ttsc/compiler/test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries";

/**
 * Runs real API and compiler/CLI/watch profiles on one owned corpus allocation.
 * The API first enters its exact baseline and overlays in project/. The CLI
 * owner then writes its original corpus, support and subproject inputs into the
 * same allocation; native tool identity is shared, never a compiled result.
 *
 * 1. Allocate one root and execute the original plugin-free API state matrix.
 * 2. Compare both case-policy helper answers with the asserted baseline native reply.
 * 3. Hold API inputs aside and run the native JSX value and rejection batch in the same root.
 * 4. Hold JSX inputs aside, then stage compiler/CLI/watch inputs and collect their verdicts.
 *
 * @evidence contracts/testing.md#behavioral-verification The API owns its nine native calls and record/diagnostic/no-disk-output literals; the native JSX batch owns all 661 value expectations and malformed JSX status/diagnostics; the compiler corpus owns its existing emit/refusal/cache/JSX/watch assertions. This entry changes their preparation owner, not expected outcomes.
 * @evidence contracts/testing.md#independent-expectations Original fixture markers, exact diagnostics, emitted paths, source ownership and later watcher completion markers stay in their owning bodies.
 * @evidence contracts/testing.md#distinguishing-cases API in-memory operations precede actual disk emission. Each configuration and watch transition retains separate requests; an unsuccessful API prerequisite blocks mutation of its borrowed input.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated Real compiler entry selects these already shared native API and compiler corpora without separately allocating both project roots.
 * @evidence contracts/e2e.md#necessary-boundary Native API replies, actual emitted bytes and live watch process protocols require the real producer; a scripted compiler or DTO unit is not their oracle.
 * @evidence contracts/e2e.md#shared-execution One allocation and fixed checkout compiler tools serve API, case-policy, native JSX and CLI/watch phases. Case-policy borrows the asserted API baseline response and physical root, preserving both helper queries. JSX stages its exact source/config in that root and still asks the existing source/environment-keyed builder to admit its executable; no cache hit or skipped build is inferred. Every actual request and constructor remains independently counted, and source-level sharing is not measured reduction.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity API entries move into api-observed after successful API and policy checks, leaving the same physical project root empty for exact JSX source/config. JSX entries move into jsx-observed only after its positive/negative observations succeed; CLI staging starts without prior package/source/output inputs. JSX error/signal/null-status blocks mutable reuse and retains inputs. Borrowed owners do not remove the common root, retained on success/failure for actual join and trace observation; synchronous results do not certify arbitrary descendants.
 * @evidence contracts/e2e.md#preserved-coverage Four owner bodies retain their assertions and names: API failures, case-policy success/boolean/two equalities and platform restoration, native JSX values/no disk emission/status2/main.tsx error1002, and compiler/watch negative recovery. Other approved Real compiler profiles and actual selected execution remain pending; this body authorizes no donor removal.
 */
export async function test_e2e_compiler(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-shared-real-compiler-");
  TestProject.retainTemporaryDirectory(root, "Shared compiler corpus retained for trace and process closure observation");
  const project = path.join(root, "project");
  fs.mkdirSync(project);
  CompilerApiWorkspace.enter({ root: project }, "baseline");
  let nativePolicyWitness: { root: string; result: { type: string; graph?: { useCaseSensitiveFileNames?: boolean } } } | undefined;
  try {
    await Scenarios.invoke("shared-family", "test_ttsccompiler_plugin_free_compile_and_transform_share_one_project", test_ttsccompiler_plugin_free_compile_and_transform_share_one_project, { root: project }, (nativeRoot: string, result: { type: string; graph?: { useCaseSensitiveFileNames?: boolean } }) => {
      nativePolicyWitness = { root: nativeRoot, result };
    });
  } catch (cause) {
    throw new AggregateError([new Error("real compiler API profiles", { cause })], "CLI profiles blocked by failed API prerequisite");
  }
  if (nativePolicyWitness === undefined)
    throw new Error("Native API graph observation missing before case-policy comparison");
  await Scenarios.invoke("shared-family", "test_compilerusescasesensitivefilenames_answers_what_the_compiler_reports", test_compilerusescasesensitivefilenames_answers_what_the_compiler_reports, nativePolicyWitness);
  const observed = path.join(root, "api-observed");
  fs.mkdirSync(observed);
  for (const name of fs.readdirSync(project))
    fs.renameSync(path.join(project, name), path.join(observed, name));
  await Scenarios.invoke("shared-family", "test_factory_jsx_strings_roundtrip_through_native_compile", test_factory_jsx_strings_roundtrip_through_native_compile, undefined, undefined, project);
  const jsxObserved = path.join(root, "jsx-observed");
  fs.mkdirSync(jsxObserved);
  for (const name of fs.readdirSync(project))
    fs.renameSync(path.join(project, name), path.join(jsxObserved, name));
  await Scenarios.invoke("shared-family", "test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries", test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries, true, root);
}
