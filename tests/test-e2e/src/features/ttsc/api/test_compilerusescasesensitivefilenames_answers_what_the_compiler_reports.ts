import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import {
  TtscCompiler,
  assert,
  createProject,
  path,
} from "../../../internal/ttsc/internal/compiler";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/ttsc/internal/plugin-cache";

/**
 * Compares the early cache-root policy approximation with one actual compiler
 * report while changing the apparent process platform.
 *
 * Hosts that decide project membership before any compile, the Metro key, the
 * unplugin selection of a referenced project, and its first walk, took the case
 * policy from `process.platform === "linux"`. TypeScript-Go takes it from the
 * executable it runs as (samchon/ttsc#1563).
 * `compilerUsesCaseSensitiveFileNames` probes a physical cache-root proxy on
 * non-Windows hosts, not the selected executable itself. Directory policy,
 * lexical spelling and Unicode mapping can make that approximation disagree.
 *
 * 1. Transform a project through the compiler host in one cache root, and read the
 *    case policy its graph reports.
 * 2. Ask the helper for the same project and root.
 * 3. Ask it again, for a sibling root on the same volume, while `process.platform`
 *    names a platform whose ordinary answer is the other one.
 * 4. Assert all three agree.
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms a real compiler project, reads its boolean graph policy, and compares compilerUsesCaseSensitiveFileNames in the same and sibling cache roots while process.platform is changed.
 * @evidence contracts/testing.md#independent-expectations The real native compiler graph is an independent producer for the JavaScript helper answer; the test checks agreement rather than hardcoding an OS policy.
 * @evidence contracts/testing.md#distinguishing-cases Shared-cache and project-local sibling-cache answers are compared with the native report under opposite apparent process.platform. Their equal policy/volume premise is not independently asserted; the comparison does not establish cross-volume, per-directory, Unicode or arbitrary-executable classifier accuracy.
 * @evidence contracts/testing.md#execution-ownership The exported API feature executes native transform and direct helper calls through TestExecutor. The consolidated compiler entry instead supplies the actual asserted baseline transform response and its physical project root; the same success, boolean and equality assertions execute here.
 * @evidence contracts/e2e.md#necessary-boundary Actual native transform reporting supplies a reference distinct from the helper's root proxy. Agreement checks this selected fixture observation, not an external OS specification or proof that every future executable matches the proxy.
 * @evidence contracts/e2e.md#shared-execution Standalone execution obtains one transform report for two helper calls; consolidated execution borrows the real API baseline response and its same physical root. Both helper queries remain and the sibling helper uses filesystem probing. The borrowed response assumes root filesystem policy stays stable while the API changes owned source/config contents; it does not establish arbitrary directory equivalence. Internal child starts, Program constructions, cache hits and executable-byte identity are separate observations, not inferred from these call counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone execution owns a fresh project; consolidated execution borrows the API root before its inputs are moved for CLI staging. The exact process.platform descriptor is restored in finally after the controlled helper call. Shared cache/module state and the helper's per-root answer memo persist; TestProject tracks fixture paths. This does not certify arbitrary descendant shutdown or equivalent native directory policies for both roots.
 * @evidence contracts/e2e.md#preserved-coverage Original success, boolean policy and both equality assertions remain; equality can expose disagreement but cannot prove both components follow an external case specification.
 */
export const test_compilerusescasesensitivefilenames_answers_what_the_compiler_reports =
  (prepared?: { root: string; result: { type: string; graph?: { useCaseSensitiveFileNames?: boolean } } }): void => {
    const root = prepared?.root ?? createProject();
    const result = prepared?.result ?? new TtscCompiler({
      cacheDir: SHARED_PLUGIN_CACHE_DIR,
      cwd: root,
    }).transform();
    assert.equal(result.type, "success");
    const reported = result.graph?.useCaseSensitiveFileNames;
    assert.equal(typeof reported, "boolean", "the compiler reported no policy");

    assert.equal(
      compilerUsesCaseSensitiveFileNames({
        cacheDir: SHARED_PLUGIN_CACHE_DIR,
        projectRoot: root,
      }),
      reported,
    );

    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", {
      ...platform,
      value: process.platform === "linux" ? "darwin" : "linux",
    });
    let answer: boolean;
    try {
      answer = compilerUsesCaseSensitiveFileNames({
        cacheDir: path.join(root, "sibling-cache"),
        projectRoot: root,
      });
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
    assert.equal(answer, reported, "the answer followed process.platform");
  };
