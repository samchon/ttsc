import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { Scenarios } from "../internal/Scenarios";
import { createLinkedPluginProject } from "../internal/unplugin/internal/transform-linked-completeness/createLinkedPluginProject";
import { test_rollup_build_maps_transformed_modules_to_the_authored_source } from "./unplugin/native-plugins/adapters/test_rollup_build_maps_transformed_modules_to_the_authored_source";
import { test_esbuild_build_maps_transformed_modules_to_the_authored_source } from "./unplugin/native-plugins/adapters/test_esbuild_build_maps_transformed_modules_to_the_authored_source";
import { test_webpack_contract_hosts_map_transformed_modules_to_the_authored_source } from "./unplugin/native-plugins/adapters/test_webpack_contract_hosts_map_transformed_modules_to_the_authored_source";

import { test_esbuild_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_esbuild_adapter_runs_the_configured_ttsc_source_transform";
import { test_rollup_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_rollup_adapter_runs_the_configured_ttsc_source_transform";
import { test_rollup_build_registers_plugin_dependencies_as_watch_files } from "./unplugin/native-plugins/adapters/test_rollup_build_registers_plugin_dependencies_as_watch_files";
import { test_vite_adapter_runs_the_configured_ttsc_source_transform } from "./unplugin/native-plugins/adapters/test_vite_adapter_runs_the_configured_ttsc_source_transform";
import { test_turbopack_loader_keeps_its_worker_through_a_failed_compile } from "./unplugin/native-plugins/adapters/test_turbopack_loader_keeps_its_worker_through_a_failed_compile";
import { test_turbopack_loader_passes_through_an_out_of_program_module } from "./unplugin/native-plugins/adapters/test_turbopack_loader_passes_through_an_out_of_program_module";
import { test_turbopack_loader_transforms_source_through_the_webpack_loader_contract } from "./unplugin/native-plugins/adapters/test_turbopack_loader_transforms_source_through_the_webpack_loader_contract";
import { test_turbopack_loader_transforms_without_an_add_dependency_context } from "./unplugin/native-plugins/adapters/test_turbopack_loader_transforms_without_an_add_dependency_context";
import { test_turbopack_loader_forwards_rule_options_to_the_transform } from "./unplugin/native-plugins/adapters/test_turbopack_loader_forwards_rule_options_to_the_transform";
import { test_turbopack_loader_registers_plugin_dependencies_on_cache_hit } from "./unplugin/native-plugins/adapters/test_turbopack_loader_registers_plugin_dependencies_on_cache_hit";
import { test_turbopack_loader_marks_volatile_modules_uncacheable } from "./unplugin/native-plugins/adapters/test_turbopack_loader_marks_volatile_modules_uncacheable";
import { test_turbopack_loader_registers_the_project_record_alone } from "./unplugin/native-plugins/adapters/test_turbopack_loader_registers_the_project_record_alone";

/**
 * Verifies bundler hosts with one native fixture and one shared banner input.
 *
 * The unchanged generated source, descriptor and content-addressed Go plugin
 * are prepared once. Vite and Rollup consume the unchanged baseline; after the
 * Vite build returns and Rollup's supported close resolves,
 * Rollup's dependency-report profile changes only its original plugin options.
 * After that bundle closes, esbuild adds its original run-counter configuration.
 * Its completed lifecycle permits the original out-of-program delivery and
 * default-options, plain/reporting project records, explicit prefix,
 * volatile/hermetic cacheability,
 * repeated dependency registration and
 * absent dependency-channel deliveries before the
 * out-of-program and final missing-helper verdicts on the same producer.
 * A separately rooted linked-banner input is prepared once before host calls;
 * Rollup and esbuild consume its unchanged authored bytes, then the terminal
 * webpack/Rspack/Turbopack map profile writes its original marker source.
 *
 * 1. Generate one native-plugin consumer and execute real Vite/Rollup pipelines.
 * 2. Observe closes around the dependency-record and esbuild option transitions.
 * 3. Collect named verdicts and retain the common inputs for trace observation.
 *
 * @evidence contracts/testing.md#behavioral-verification Vite and Rollup retain generated PLUGIN output. Dependency watchFiles contain exactly its project record, omit the compiler input, and the record names src/types.d.ts. Esbuild retains setup/context/replacement/disposal and counter1/2/3 assertions. Final built Turbopack loader retains native helper.ts error1, generated module throwing that exact emitted message, rejection without emitError and missing-config rejection before compilation.
 * @evidence contracts/testing.md#independent-expectations Original PLUGIN/goUpper literals and one-byte compile counters remain in their owning bodies. Rollup closure is observed only after the actual supported bundle.close resolves; it is not inferred from an output or failure result.
 * @evidence contracts/testing.md#distinguishing-cases A failed output assertion with successful bundle close still allows the next named host; absent/failed close blocks configuration mutation. Esbuild distinguishes failed setup, one/last context disposal, delayed old disposal and final one-shot release.
 * @evidence contracts/testing.md#execution-ownership The consolidated Unplugin host entry calls fifteen existing bodies with one generated native project and one separately rooted linked-banner input shared by three source-map bodies. Legacy standalone donors retain their default preparation; registration and this authored subset do not certify all adapter profiles or actual execution. Turbopack delivery uses its actual built loader/context connection and does not certify a running Next worker.
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup/esbuild lifecycle callbacks connect built adapters to native transforms; a fabricated adapter or direct cache-policy unit cannot witness those host connections.
 * @evidence contracts/e2e.md#shared-execution One generated consumer/source descriptor and shared content-addressed plugin cache serve the native fixture profiles. Three banner source-map bodies borrow one physical linked project and package link, replacing three identical setup paths; this banner producer is distinct from the native fixture producer. Host sessions, source changes and config generations remain separately observed; callbacks do not prove process or Program counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Vite/Rollup read unchanged baseline. Their completion gates precede dependency options, its close precedes count-runs, and esbuild successful lifecycle precedes exact authored baseline-config restoration. Default loader return precedes original plain-record observations, then their completed assertions precede the original empty-config-plugin/reporting input on the same root. Reporting return gates later option profiles; both original single-record channels and relative/absolute/duplicate/self inputs remain. The original A: prefix options return before volatile then hermetic options. The original numeric PLUGIN suffix, [false] and [] cacheability observations remain; hermetic callback return gates distinct emit-dependencies options and its two identical requests, then the absent host channel and exact baseline-byte restoration. Actual cold/native cache events remain separately observable, not inferred from request order. Out-of-program delivery must return and restore the exact stderr descriptor before final read-helper options. Original src/helper.ts absence is checked. Uncertain completion blocks mutation; common inputs remain retained. Public operation boundaries do not certify arbitrary descendants and no mutation follows the failed-loader terminal profile.
 * @evidence contracts/e2e.md#preserved-coverage Original native fixture body literals, controls and host disposal assertions remain. Source-map bodies retain no SOURCEMAP_BROKEN, authored value coordinates, embedded source text, webpack/Rspack marker coordinates and Turbopack shifted-line plus exact map position. Rollup close gates the unchanged esbuild input; esbuild return gates the original terminal marker rewrite. Linked-project readers and failed fixture readers use separate roots; common inputs remain retained. Other approved profiles, baseline measurement and actual selected survival remain pending; no donors are removed.
 */
export async function test_e2e_unplugin(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  TestProject.retainTemporaryDirectory(root);
  const baselineConfig = fs.readFileSync(path.join(root, "tsconfig.json"));
  const linkedBanner = createLinkedPluginProject(["banner"], path.join(root, "linked-banner"));
  const failures: unknown[] = [];
  let esbuildCompleted = false;
  let viteReturned = false;
  try {
    await Scenarios.invoke("shared-unplugin", "test_vite_adapter_runs_the_configured_ttsc_source_transform", test_vite_adapter_runs_the_configured_ttsc_source_transform, root, () => {
      viteReturned = true;
    });
  } catch (cause) {
    failures.push(new Error("vite configured source transform", { cause }));
  }
  let rollupClosed = false;
  try {
    await Scenarios.invoke("shared-unplugin", "test_rollup_adapter_runs_the_configured_ttsc_source_transform", test_rollup_adapter_runs_the_configured_ttsc_source_transform, root, () => {
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
      await Scenarios.invoke("shared-unplugin", "test_rollup_build_registers_plugin_dependencies_as_watch_files", test_rollup_build_registers_plugin_dependencies_as_watch_files, root, () => {
        dependencyBundleClosed = true;
      });
    } catch (cause) {
      failures.push(new Error("rollup plugin dependency watch record", { cause }));
    }
    if (!dependencyBundleClosed)
      failures.push(new Error("esbuild profiles blocked: dependency bundle closure was not observed"));
    else {
      try {
        await Scenarios.invoke("shared-unplugin", "test_esbuild_adapter_runs_the_configured_ttsc_source_transform", test_esbuild_adapter_runs_the_configured_ttsc_source_transform, root);
        esbuildCompleted = true;
      } catch (cause) {
        failures.push(new Error("esbuild configured source transform and lifetimes", { cause }));
      }
    }
  }
  if (esbuildCompleted) {
    let defaultLoaderReturned = false;
    try {
      fs.writeFileSync(path.join(root, "tsconfig.json"), baselineConfig);
      await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_transforms_source_through_the_webpack_loader_contract", test_turbopack_loader_transforms_source_through_the_webpack_loader_contract, root, () => {
        defaultLoaderReturned = true;
      });
    } catch (cause) {
      failures.push(new Error("turbopack default-options delivery", { cause }));
    }
    let projectRecordReturned = false;
    if (defaultLoaderReturned) {
      try {
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_registers_the_project_record_alone", test_turbopack_loader_registers_the_project_record_alone, root, () => {
          projectRecordReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack project-record channels", { cause }));
      }
    } else {
      failures.push(new Error("turbopack record profile blocked: default loader return was unobserved"));
    }
    let ruleOptionsReturned = false;
    if (projectRecordReturned) {
      try {
        const config = JSON.parse(baselineConfig.toString("utf8"));
        config.compilerOptions.plugins = [];
        fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify(config));
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_forwards_rule_options_to_the_transform", test_turbopack_loader_forwards_rule_options_to_the_transform, root, () => {
          ruleOptionsReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack rule options delivery", { cause }));
      }
    } else {
      failures.push(new Error("turbopack rule options blocked: record delivery return was unobserved"));
    }
    let cacheabilityReturned = false;
    if (ruleOptionsReturned) {
      try {
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_marks_volatile_modules_uncacheable", test_turbopack_loader_marks_volatile_modules_uncacheable, root, () => {
          cacheabilityReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack volatile and hermetic cacheability", { cause }));
      }
    } else {
      failures.push(new Error("turbopack cacheability profile blocked: rule options return was unobserved"));
    }
    let repeatedDependenciesReturned = false;
    if (cacheabilityReturned) {
      try {
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_registers_plugin_dependencies_on_cache_hit", test_turbopack_loader_registers_plugin_dependencies_on_cache_hit, root, () => {
          repeatedDependenciesReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack repeated dependency registration", { cause }));
      }
    } else {
      failures.push(new Error("turbopack repeated dependency profile blocked: cacheability returns were unobserved"));
    }
    let optionalChannelReturned = false;
    if (repeatedDependenciesReturned) {
      try {
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_transforms_without_an_add_dependency_context", test_turbopack_loader_transforms_without_an_add_dependency_context, root, () => {
          optionalChannelReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack optional dependency channel", { cause }));
      }
    } else {
      failures.push(new Error("turbopack optional channel blocked: repeated dependency returns were unobserved"));
    }
    let outOfProgramReturned = false;
    if (optionalChannelReturned) {
      try {
        fs.writeFileSync(path.join(root, "tsconfig.json"), baselineConfig);
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_passes_through_an_out_of_program_module", test_turbopack_loader_passes_through_an_out_of_program_module, root, () => {
          outOfProgramReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack out-of-program delivery", { cause }));
      }
    } else {
      failures.push(new Error("turbopack out-of-program delivery blocked: optional channel return was unobserved"));
    }
    if (!outOfProgramReturned)
      failures.push(new Error("turbopack failure profile blocked: prior delivery or stderr restoration was unobserved"));
    else {
      try {
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_keeps_its_worker_through_a_failed_compile", test_turbopack_loader_keeps_its_worker_through_a_failed_compile, root);
      } catch (cause) {
        failures.push(new Error("turbopack native failure delivery", { cause }));
      }
    }
  } else {
    failures.push(new Error("turbopack failure profiles blocked: esbuild lifecycle did not complete"));
  }
  let mapBundleClosed = false;
  try {
    await Scenarios.invoke("shared-unplugin", "test_rollup_build_maps_transformed_modules_to_the_authored_source", test_rollup_build_maps_transformed_modules_to_the_authored_source, linkedBanner, () => {
      mapBundleClosed = true;
    });
  } catch (cause) {
    failures.push(new Error("rollup authored source-map composition", { cause }));
  }
  let mapBuildReturned = false;
  if (mapBundleClosed) {
    try {
      await Scenarios.invoke("shared-unplugin", "test_esbuild_build_maps_transformed_modules_to_the_authored_source", test_esbuild_build_maps_transformed_modules_to_the_authored_source, linkedBanner, () => {
        mapBuildReturned = true;
      });
    } catch (cause) {
      failures.push(new Error("esbuild authored source-map composition", { cause }));
    }
  } else {
    failures.push(new Error("esbuild source-map profile blocked: Rollup closure was unobserved"));
  }
  if (mapBuildReturned) {
    try {
      await Scenarios.invoke("shared-unplugin", "test_webpack_contract_hosts_map_transformed_modules_to_the_authored_source", test_webpack_contract_hosts_map_transformed_modules_to_the_authored_source, linkedBanner);
    } catch (cause) {
      failures.push(new Error("webpack rspack and turbopack authored source-map composition", { cause }));
    }
  } else {
    failures.push(new Error("webpack source-map profile blocked: esbuild return was unobserved"));
  }
  if (failures.length)
    throw new AggregateError(failures, "shared unplugin hosts");
}
