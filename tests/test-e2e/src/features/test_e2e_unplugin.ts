import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Scenarios } from "../internal/Scenarios";
import { createLinkedWorkspaceFixture } from "../internal/unplugin/internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { test_vite_serve_registers_no_watch_inputs_without_a_watcher } from "./unplugin/native-plugins/adapters/test_vite_serve_registers_no_watch_inputs_without_a_watcher";
import { test_vite_build_tolerates_missing_resolution_candidates } from "./unplugin/native-plugins/adapters/test_vite_build_tolerates_missing_resolution_candidates";
import { test_vite_serve_first_request_survives_missing_resolution_candidates } from "./unplugin/native-plugins/adapters/test_vite_serve_first_request_survives_missing_resolution_candidates";
import { runSharedWatcherlessViteDeliveries } from "../internal/unplugin/runSharedWatcherlessViteDeliveries";
import { runSharedViteBuildWatchLifecycle } from "../internal/unplugin/runSharedViteBuildWatchLifecycle";
import { test_webpack_watch_reuses_the_generation_across_rebuilds } from "./unplugin/native-plugins/adapters/test_webpack_watch_reuses_the_generation_across_rebuilds";
import { test_webpack_sequential_compilers_share_one_generation } from "./unplugin/native-plugins/adapters/test_webpack_sequential_compilers_share_one_generation";
import { test_vite_serve_with_a_watcher_keeps_persistent_validation } from "./unplugin/native-plugins/adapters/test_vite_serve_with_a_watcher_keeps_persistent_validation";
import { test_vite_serve_without_a_watcher_serves_the_startup_generation } from "./unplugin/native-plugins/adapters/test_vite_serve_without_a_watcher_serves_the_startup_generation";
import { test_vite_serve_reports_errors_at_the_authored_line } from "./unplugin/native-plugins/adapters/test_vite_serve_reports_errors_at_the_authored_line";
import { test_vite_build_serves_wrapper_queries_from_the_host } from "./unplugin/native-plugins/adapters/test_vite_build_serves_wrapper_queries_from_the_host";
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
import { test_turbopack_loader_proves_its_own_records_under_a_session } from "./unplugin/native-plugins/adapters/test_turbopack_loader_proves_its_own_records_under_a_session";
import { test_turbopack_loader_signals_a_change_before_turbopacks_baseline } from "./unplugin/native-plugins/adapters/test_turbopack_loader_signals_a_change_before_turbopacks_baseline";

/**
 * Verifies bundler hosts with one native fixture and one shared banner input.
 *
 * The unchanged generated source, descriptor and content-addressed Go plugin
 * are prepared once. A fresh production-session worker first proves its sibling
 * record without any parent bridge able to mask that proof. Vite and Rollup
 * then consume the unchanged baseline; after the
 * Vite build returns and Rollup's supported close resolves,
 * Rollup's dependency-report profile changes only its original plugin options.
 * After that bundle closes, esbuild adds its original run-counter configuration.
 * Its completed lifecycle permits the real watcherless startup server, whose actual close gates exact main/config byte restoration and lazy-input removal, then the original raw/url/plain Vite wrapper build; its actual return and entry removal precede the original out-of-program delivery and
 * default-options, plain/reporting project records, explicit prefix,
 * volatile/hermetic cacheability,
 * repeated dependency registration and
 * absent dependency-channel and pre-baseline signal/redelivery profiles before the
 * out-of-program and final missing-helper verdicts on the same producer.
 * A separately rooted linked-banner input is prepared once before host calls;
 * Rollup and esbuild consume its unchanged authored bytes, then the terminal
 * webpack/Rspack/Turbopack map profile writes its original marker source; after successful return, exact baseline source restoration permits the original real Vite SSR authored-stack profile.
 * One independently rooted four-module watcherless Vite session shares first
 * delivery and one plugin edit across unseen-module retention and repeated
 * first-module replacement, then awaits its modeled buildEnd in finally.
 * One linked-package candidate fixture is also prepared once: watcherless
 * registration returns before its production build, followed by the existing
 * real-server startup/restart/type-membership/preferred-candidate matrix last.
 *
 * 1. Generate one native-plugin consumer and execute real Vite/Rollup pipelines.
 * 2. Observe closes around the dependency-record and esbuild option transitions.
 * 3. Collect named verdicts and retain the common inputs for trace observation.
 *
 * @evidence contracts/testing.md#behavioral-verification Vite and Rollup retain generated PLUGIN output. Dependency watchFiles contain exactly its project record, omit the compiler input, and the record names src/types.d.ts. Esbuild retains setup/context/replacement/disposal and counter1/2/3 assertions. Final built Turbopack loader retains native helper.ts error1, generated module throwing that exact emitted message, rejection without emitError and missing-config rejection before compilation.
 * @evidence contracts/testing.md#independent-expectations Original PLUGIN/goUpper literals and one-byte compile counters remain in their owning bodies. Rollup closure is observed only after the actual supported bundle.close resolves; it is not inferred from an output or failure result.
 * @evidence contracts/testing.md#distinguishing-cases A failed output assertion with successful bundle close still allows the next named host; absent/failed close blocks configuration mutation. Esbuild distinguishes failed setup, one/last context disposal, delayed old disposal and final one-shot release.
 * @evidence contracts/testing.md#execution-ownership The consolidated Unplugin host entry calls twenty-three existing bodies with one generated native project and one separately rooted linked-banner input shared by four source-map bodies, plus one survivor joining the two original watcherless Vite matrices on a single four-module session. Legacy standalone donors retain their default preparation; registration and this authored subset do not certify all adapter profiles or actual execution. The startup proof launches its actual production-session Node worker; other Turbopack delivery uses its built loader/context connection and does not certify a running Next worker.
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup/esbuild lifecycle callbacks connect built adapters to native transforms; a fabricated adapter or direct cache-policy unit cannot witness those host connections.
 * @evidence contracts/e2e.md#shared-execution One generated consumer/source descriptor and shared content-addressed plugin cache serve the native fixture profiles. Three banner source-map bodies borrow one physical linked project and package link, replacing three identical setup paths; this banner producer is distinct from the native fixture producer. Host sessions, source changes and config generations remain separately observed; callbacks do not prove process or Program counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The production-session startup proof runs first and independently requires the shared root tool directory absent; a parent bridge cannot supply its sibling proof. Its actual worker close gates Vite/Rollup, which then read unchanged baseline. Their completion gates precede dependency options, its close precedes count-runs, and esbuild successful lifecycle precedes exact authored baseline-config restoration. Default loader return precedes original plain-record observations, then their completed assertions precede the original empty-config-plugin/reporting input on the same root. Reporting return gates later option profiles; both original single-record channels and relative/absolute/duplicate/self inputs remain. The original A: prefix options return before volatile then hermetic options. The original numeric PLUGIN suffix, [false] and [] cacheability observations remain; hermetic callback return gates distinct emit-dependencies options and its two identical requests, then the absent host channel. Original Before/After declaration bytes require repeated record movement, redelivery and five-second stopped movement before exact baseline-byte restoration; failed acknowledgment blocks later profiles. Actual cold/native cache events remain separately observable, not inferred from request order. Out-of-program delivery must return and restore the exact stderr descriptor before final read-helper options. Original src/helper.ts absence is checked. Uncertain completion blocks mutation; common inputs remain retained. Public operation boundaries do not certify arbitrary descendants and no mutation follows the failed-loader terminal profile.
 * @evidence contracts/e2e.md#preserved-coverage Original native fixture body literals, controls and host disposal assertions remain. Source-map bodies retain no SOURCEMAP_BROKEN, authored value coordinates, embedded source text, webpack/Rspack marker coordinates and Turbopack shifted-line plus exact map position. Rollup close gates the unchanged esbuild input; esbuild return gates the original terminal marker rewrite. Linked-project readers and failed fixture readers use separate roots; common inputs remain retained. The linked candidate fixture keeps empty watcherless registrations, production linked output and the existing combined first-request, unrelated creation, unchanged restart, automatic type-root membership and preferred-candidate HMR assertions; mutation phases run last after both earlier owning bodies return. The watch-build retention and teardown survivor shares one four-module project across three unchanged passes and close/reconstruction, preserving counts1/2 and every successful delivery. Other approved profiles, baseline measurement and actual selected survival remain pending; no donors are removed.
 */
export async function test_e2e_unplugin(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  TestProject.retainTemporaryDirectory(root, "Shared unplugin host inputs retained for session and trace observation");
  const baselineConfig = fs.readFileSync(path.join(root, "tsconfig.json"));
  const baselineMain = fs.readFileSync(TestUnpluginProject.mainFile(root));
  const linkedBanner = createLinkedPluginProject(["banner"], path.join(root, "linked-banner"));
  const linkedBaselineMain = fs.readFileSync(linkedBanner.main);
  const candidateFixture = createLinkedWorkspaceFixture();
  TestProject.retainTemporaryDirectory(path.dirname(candidateFixture.app), "Linked candidate inputs retained for host and watcher closure observation");
  const failures: unknown[] = [];
  // Startup proof must precede any parent-process loader/host bridge for root.
  let startupWorkerClosed = false;
  try {
    await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_proves_its_own_records_under_a_session", test_turbopack_loader_proves_its_own_records_under_a_session, root, () => {
      startupWorkerClosed = true;
    });
  } catch (cause) {
    failures.push(new Error("turbopack session startup record proof", { cause }));
  }
  let esbuildCompleted = false;
  let viteReturned = false;
  if (startupWorkerClosed) {
    try {
      await Scenarios.invoke("shared-unplugin", "test_vite_adapter_runs_the_configured_ttsc_source_transform", test_vite_adapter_runs_the_configured_ttsc_source_transform, root, () => {
        viteReturned = true;
      });
    } catch (cause) {
      failures.push(new Error("vite configured source transform", { cause }));
    }
  } else {
    failures.push(new Error("vite profile blocked: startup worker close was unobserved"));
  }
  let rollupClosed = false;
  if (startupWorkerClosed) {
    try {
      await Scenarios.invoke("shared-unplugin", "test_rollup_adapter_runs_the_configured_ttsc_source_transform", test_rollup_adapter_runs_the_configured_ttsc_source_transform, root, () => {
        rollupClosed = true;
      });
    } catch (cause) {
      failures.push(new Error("rollup configured source transform", { cause }));
    }
  } else {
    failures.push(new Error("rollup profile blocked: startup worker close was unobserved"));
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
    let startupServerClosed = false;
    let startupInputsRestored = false;
    const lazy = path.join(root, "src", "lazy.ts");
    try {
      assert.equal(fs.existsSync(lazy), false, "shared startup lazy input must be absent before its profile");
      await Scenarios.invoke("shared-unplugin", "test_vite_serve_without_a_watcher_serves_the_startup_generation", test_vite_serve_without_a_watcher_serves_the_startup_generation, root, () => {
        startupServerClosed = true;
      });
    } catch (cause) {
      failures.push(new Error("real watcherless Vite startup generation", { cause }));
    }
    if (startupServerClosed) {
      try {
        fs.writeFileSync(TestUnpluginProject.mainFile(root), baselineMain);
        fs.writeFileSync(path.join(root, "tsconfig.json"), baselineConfig);
        fs.rmSync(lazy);
        assert.deepEqual(fs.readFileSync(TestUnpluginProject.mainFile(root)), baselineMain);
        assert.deepEqual(fs.readFileSync(path.join(root, "tsconfig.json")), baselineConfig);
        assert.equal(fs.existsSync(lazy), false);
        startupInputsRestored = true;
      } catch (cause) {
        failures.push(new Error("watcherless startup input restoration", { cause }));
      }
    }
    let wrapperBuildReturned = false;
    let wrapperInputsRestored = false;
    const wrapperEntry = path.join(root, "src", "entry.ts");
    if (startupInputsRestored) {
      try {
        assert.equal(fs.existsSync(wrapperEntry), false, "wrapper entry must be absent before its shared profile");
        await Scenarios.invoke("shared-unplugin", "test_vite_build_serves_wrapper_queries_from_the_host", test_vite_build_serves_wrapper_queries_from_the_host, root, () => {
          wrapperBuildReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("Vite raw/url/plain wrapper imports", { cause }));
      }
      if (wrapperBuildReturned) {
        try {
          fs.rmSync(wrapperEntry);
          assert.equal(fs.existsSync(wrapperEntry), false);
          wrapperInputsRestored = true;
        } catch (cause) {
          failures.push(new Error("Vite wrapper entry restoration", { cause }));
        }
      }
    }
    let defaultLoaderReturned = false;
    if (wrapperInputsRestored) {
      try {
        fs.writeFileSync(path.join(root, "tsconfig.json"), baselineConfig);
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_transforms_source_through_the_webpack_loader_contract", test_turbopack_loader_transforms_source_through_the_webpack_loader_contract, root, () => {
          defaultLoaderReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack default-options delivery", { cause }));
      }
    } else {
      failures.push(new Error("turbopack default profile blocked: Vite startup or wrapper completion/restoration was unobserved"));
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
    let signalAcknowledged = false;
    if (optionalChannelReturned) {
      try {
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_signals_a_change_before_turbopacks_baseline", test_turbopack_loader_signals_a_change_before_turbopacks_baseline, root);
        signalAcknowledged = true;
      } catch (cause) {
        failures.push(new Error("turbopack pre-baseline record signal and acknowledgment", { cause }));
      }
    } else {
      failures.push(new Error("turbopack signal profile blocked: optional channel return was unobserved"));
    }
    let outOfProgramReturned = false;
    if (signalAcknowledged) {
      try {
        fs.writeFileSync(path.join(root, "tsconfig.json"), baselineConfig);
        await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_passes_through_an_out_of_program_module", test_turbopack_loader_passes_through_an_out_of_program_module, root, () => {
          outOfProgramReturned = true;
        });
      } catch (cause) {
        failures.push(new Error("turbopack out-of-program delivery", { cause }));
      }
    } else {
      failures.push(new Error("turbopack out-of-program delivery blocked: record signal acknowledgment was unobserved"));
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
  let mapContractsReturned = false;
  if (mapBuildReturned) {
    try {
      await Scenarios.invoke("shared-unplugin", "test_webpack_contract_hosts_map_transformed_modules_to_the_authored_source", test_webpack_contract_hosts_map_transformed_modules_to_the_authored_source, linkedBanner);
      mapContractsReturned = true;
    } catch (cause) {
      failures.push(new Error("webpack rspack and turbopack authored source-map composition", { cause }));
    }
  } else {
    failures.push(new Error("webpack source-map profile blocked: esbuild return was unobserved"));
  }
  if (mapContractsReturned) {
    try {
      fs.writeFileSync(linkedBanner.main, linkedBaselineMain);
      assert.deepEqual(fs.readFileSync(linkedBanner.main), linkedBaselineMain);
      await Scenarios.invoke("shared-unplugin", "test_vite_serve_reports_errors_at_the_authored_line", test_vite_serve_reports_errors_at_the_authored_line, linkedBanner);
    } catch (cause) {
      failures.push(new Error("Vite SSR authored source-map stack", { cause }));
    }
  } else {
    failures.push(new Error("Vite SSR stack profile blocked: prior source-map contracts did not complete"));
  }
  try {
    await Scenarios.invoke("shared-unplugin", "watcherless-vite-unseen-and-repeated-deliveries", runSharedWatcherlessViteDeliveries, async (prepared: { root: string; runLog: string; originalPlugin: Buffer }) => {
      const plugin = path.join(prepared.root, "plugin.cjs");
      fs.writeFileSync(plugin, prepared.originalPlugin);
      assert.deepEqual(fs.readFileSync(plugin), prepared.originalPlugin);
      await Scenarios.invoke("shared-unplugin", "test_vite_serve_with_a_watcher_keeps_persistent_validation", test_vite_serve_with_a_watcher_keeps_persistent_validation, prepared);
    });
  } catch (cause) {
    failures.push(new Error("watcherless Vite first and repeated deliveries", { cause }));
  }
  let watcherlessCandidateReturned = false;
  try {
    await Scenarios.invoke("shared-unplugin", "webpack-watch-timestamp-and-type-edge", test_webpack_watch_reuses_the_generation_across_rebuilds, true, async (prepared: { root: string; runLog: string; originalType: Buffer }) => {
      const typeOnly = path.join(prepared.root, "src", "mytype.ts");
      fs.writeFileSync(typeOnly, prepared.originalType);
      assert.deepEqual(fs.readFileSync(typeOnly), prepared.originalType);
      await Scenarios.invoke("shared-unplugin", "test_webpack_sequential_compilers_share_one_generation", test_webpack_sequential_compilers_share_one_generation, prepared);
    });
  } catch (cause) {
    failures.push(new Error("webpack same-byte redelivery and type-edge replacement", { cause }));
  }
  try {
    await Scenarios.invoke("shared-unplugin", "vite-watch-build-retention-and-close", runSharedViteBuildWatchLifecycle);
  } catch (cause) {
    failures.push(new Error("Vite watch build retention and teardown", { cause }));
  }
  try {
    await Scenarios.invoke("shared-unplugin", "test_vite_serve_registers_no_watch_inputs_without_a_watcher", test_vite_serve_registers_no_watch_inputs_without_a_watcher, candidateFixture);
    watcherlessCandidateReturned = true;
  } catch (cause) {
    failures.push(new Error("watcherless linked candidate registration", { cause }));
  }
  let candidateBuildReturned = false;
  if (watcherlessCandidateReturned) {
    try {
      await Scenarios.invoke("shared-unplugin", "test_vite_build_tolerates_missing_resolution_candidates", test_vite_build_tolerates_missing_resolution_candidates, candidateFixture);
      candidateBuildReturned = true;
    } catch (cause) {
      failures.push(new Error("linked candidate production build", { cause }));
    }
  } else {
    failures.push(new Error("linked candidate build blocked: watcherless hook return was unobserved"));
  }
  if (candidateBuildReturned) {
    try {
      await Scenarios.invoke("shared-unplugin", "test_vite_serve_first_request_survives_missing_resolution_candidates", test_vite_serve_first_request_survives_missing_resolution_candidates, candidateFixture);
    } catch (cause) {
      failures.push(new Error("linked candidate startup restart membership and HMR", { cause }));
    }
  } else {
    failures.push(new Error("linked candidate server blocked: production build return was unobserved"));
  }
  if (failures.length)
    throw new AggregateError(failures, "shared unplugin hosts");
}
