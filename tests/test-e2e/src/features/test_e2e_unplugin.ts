import { TestProject, TestUnpluginProject } from "@ttsc/testing";

import { test_esbuild_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_esbuild_adapter_runs_the_configured_ttsc_source_transform";
import { test_rollup_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_rollup_adapter_runs_the_configured_ttsc_source_transform";
import { test_rollup_build_registers_plugin_dependencies_as_watch_files } from "./unplugin/native-plugins/adapters/test_rollup_build_registers_plugin_dependencies_as_watch_files";
import { test_vite_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_vite_adapter_runs_the_configured_ttsc_source_transform";

/**
 * Verifies Vite, Rollup and esbuild hosts on one prepared plugin project.
 *
 * The unchanged generated source, descriptor and content-addressed Go plugin
 * are prepared once. Vite and Rollup consume the unchanged baseline; after the
 * Vite build returns and Rollup's supported close resolves,
 * Rollup's dependency-report profile changes only its original plugin options.
 * After that bundle closes, esbuild adds its original run-counter configuration.
 *
 * 1. Generate one native-plugin consumer and execute real Vite/Rollup pipelines.
 * 2. Observe closes around the dependency-record and esbuild option transitions.
 * 3. Collect named verdicts and retain the common inputs for trace observation.
 *
 * @evidence contracts/testing.md#behavioral-verification Vite and Rollup retain generated PLUGIN output. The dependency profile retains watchFiles containing exactly its project record, omitting the compiler input itself, and the written record naming src/types.d.ts. Esbuild retains failed setup, overlapping context/replacement builds, each public disposal observation and original counter1/2/3 plus transformed output assertions.
 * @evidence contracts/testing.md#independent-expectations Original PLUGIN/goUpper literals and one-byte compile counters remain in their owning bodies. Rollup closure is observed only after the actual supported bundle.close resolves; it is not inferred from an output or failure result.
 * @evidence contracts/testing.md#distinguishing-cases A failed output assertion with successful bundle close still allows the next named host; absent/failed close blocks configuration mutation. Esbuild distinguishes failed setup, one/last context disposal, delayed old disposal and final one-shot release.
 * @evidence contracts/testing.md#execution-ownership The consolidated Unplugin host entry calls these four existing bodies with one borrowed physical project. Legacy standalone donors remain unchanged in default arguments; registration and this authored subset do not certify all adapter profiles or actual execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup/esbuild lifecycle callbacks connect built adapters to native transforms; a fabricated adapter or direct cache-policy unit cannot witness those host connections.
 * @evidence contracts/e2e.md#shared-execution One generated consumer/source descriptor and shared content-addressed plugin cache serve both hosts. Host sessions and changed-config native generations stay distinct observations; two callbacks do not prove two processes or one Program.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Vite and Rollup read the unchanged baseline. Vite build must fulfill and Rollup close must resolve before the dependency-report options are written; that profile's bundle close must resolve before esbuild writes count-runs configuration. Fulfillment is a public operation boundary, not certification of arbitrary Vite descendants. Changed options invalidate prior proof; run log starts absent. Uncertain prior completion blocks mutation and retains input; esbuild owns its original disposals.
 * @evidence contracts/e2e.md#preserved-coverage Both original body literals, controls and host disposal assertions remain. Other approved Unplugin profiles, baseline measurement and actual selected survival remain pending; donors are not removed by this authored family subset.
 */
export async function test_e2e_unplugin(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  TestProject.retainTemporaryDirectory(root);
  const failures: unknown[] = [];
  let viteReturned = false;
  try {
    await test_vite_adapter_runs_the_configured_ttsc_source_transform(root, () => {
      viteReturned = true;
    });
  } catch (cause) {
    failures.push(new Error("vite configured source transform", { cause }));
  }
  let rollupClosed = false;
  try {
    await test_rollup_adapter_runs_the_configured_ttsc_source_transform(root, () => {
      rollupClosed = true;
    });
  } catch (cause) {
    failures.push(new Error("rollup configured source transform", { cause }));
  }
  if (!rollupClosed || !viteReturned)
    failures.push(new Error("esbuild profiles blocked: Vite build return or Rollup closure was not observed"));
  else {
    let dependencyBundleClosed = false;
    try {
      await test_rollup_build_registers_plugin_dependencies_as_watch_files(root, () => {
        dependencyBundleClosed = true;
      });
    } catch (cause) {
      failures.push(new Error("rollup plugin dependency watch record", { cause }));
    }
    if (!dependencyBundleClosed)
      failures.push(new Error("esbuild profiles blocked: dependency bundle closure was not observed"));
    else {
      try {
        await test_esbuild_adapter_runs_the_configured_ttsc_source_transform(root);
      } catch (cause) {
        failures.push(new Error("esbuild configured source transform and lifetimes", { cause }));
      }
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "shared unplugin hosts");
}
