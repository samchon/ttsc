import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { test_esbuild_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_esbuild_adapter_runs_the_configured_ttsc_source_transform";
import { test_rollup_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_rollup_adapter_runs_the_configured_ttsc_source_transform";
import { test_rollup_build_registers_plugin_dependencies_as_watch_files } from "./unplugin/native-plugins/adapters/test_rollup_build_registers_plugin_dependencies_as_watch_files";
import { test_vite_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_vite_adapter_runs_the_configured_ttsc_source_transform";
import { test_turbopack_loader_keeps_its_worker_through_a_failed_compile } from "./unplugin/native-plugins/adapters/test_turbopack_loader_keeps_its_worker_through_a_failed_compile";
import { test_turbopack_loader_passes_through_an_out_of_program_module } from "./unplugin/native-plugins/adapters/test_turbopack_loader_passes_through_an_out_of_program_module";

/**
 * Verifies bundler hosts and Turbopack failure delivery on one plugin project.
 *
 * The unchanged generated source, descriptor and content-addressed Go plugin
 * are prepared once. Vite and Rollup consume the unchanged baseline; after the
 * Vite build returns and Rollup's supported close resolves,
 * Rollup's dependency-report profile changes only its original plugin options.
 * After that bundle closes, esbuild adds its original run-counter configuration.
 * Its completed lifecycle permits the original out-of-program delivery and
 * final missing-helper verdict on the same prepared producer.
 *
 * 1. Generate one native-plugin consumer and execute real Vite/Rollup pipelines.
 * 2. Observe closes around the dependency-record and esbuild option transitions.
 * 3. Collect named verdicts and retain the common inputs for trace observation.
 *
 * @evidence contracts/testing.md#behavioral-verification Vite and Rollup retain generated PLUGIN output. Dependency watchFiles contain exactly its project record, omit the compiler input, and the record names src/types.d.ts. Esbuild retains setup/context/replacement/disposal and counter1/2/3 assertions. Final built Turbopack loader retains native helper.ts error1, generated module throwing that exact emitted message, rejection without emitError and missing-config rejection before compilation.
 * @evidence contracts/testing.md#independent-expectations Original PLUGIN/goUpper literals and one-byte compile counters remain in their owning bodies. Rollup closure is observed only after the actual supported bundle.close resolves; it is not inferred from an output or failure result.
 * @evidence contracts/testing.md#distinguishing-cases A failed output assertion with successful bundle close still allows the next named host; absent/failed close blocks configuration mutation. Esbuild distinguishes failed setup, one/last context disposal, delayed old disposal and final one-shot release.
 * @evidence contracts/testing.md#execution-ownership The consolidated Unplugin host entry calls six existing bodies with one borrowed physical project. Legacy standalone donors remain unchanged in default arguments; registration and this authored subset do not certify all adapter profiles or actual execution. Turbopack delivery uses its actual built loader/context connection and does not certify a running Next worker.
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup/esbuild lifecycle callbacks connect built adapters to native transforms; a fabricated adapter or direct cache-policy unit cannot witness those host connections.
 * @evidence contracts/e2e.md#shared-execution One generated consumer/source descriptor and shared content-addressed plugin cache serve both hosts. Host sessions and changed-config native generations stay distinct observations; two callbacks do not prove two processes or one Program.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Vite/Rollup read unchanged baseline. Their completion gates precede dependency options, its close precedes count-runs, and esbuild successful lifecycle precedes exact authored baseline-config restoration. Out-of-program delivery must return and restore the exact stderr descriptor before final read-helper options. Original src/helper.ts absence is checked. Uncertain completion blocks mutation; common inputs remain retained. Public operation boundaries do not certify arbitrary descendants and no mutation follows the failed-loader terminal profile.
 * @evidence contracts/e2e.md#preserved-coverage Both original body literals, controls and host disposal assertions remain. Other approved Unplugin profiles, baseline measurement and actual selected survival remain pending; donors are not removed by this authored family subset.
 */
export async function test_e2e_unplugin(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  TestProject.retainTemporaryDirectory(root);
  const baselineConfig = fs.readFileSync(path.join(root, "tsconfig.json"));
  const failures: unknown[] = [];
  let esbuildCompleted = false;
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
        esbuildCompleted = true;
      } catch (cause) {
        failures.push(new Error("esbuild configured source transform and lifetimes", { cause }));
      }
    }
  }
  if (esbuildCompleted) {
    let outOfProgramReturned = false;
    try {
      fs.writeFileSync(path.join(root, "tsconfig.json"), baselineConfig);
      await test_turbopack_loader_passes_through_an_out_of_program_module(root, () => {
        outOfProgramReturned = true;
      });
    } catch (cause) {
      failures.push(new Error("turbopack out-of-program delivery", { cause }));
    }
    if (!outOfProgramReturned)
      failures.push(new Error("turbopack failure profile blocked: prior delivery or stderr restoration was unobserved"));
    else {
      try {
        await test_turbopack_loader_keeps_its_worker_through_a_failed_compile(root);
      } catch (cause) {
        failures.push(new Error("turbopack native failure delivery", { cause }));
      }
    }
  } else {
    failures.push(new Error("turbopack failure profiles blocked: esbuild lifecycle did not complete"));
  }
  if (failures.length)
    throw new AggregateError(failures, "shared unplugin hosts");
}
