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
import { test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge } from "./unplugin/native-plugins/adapters/test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge";
import { test_webpack_filesystem_cache_control_serves_stale_without_a_graph } from "./unplugin/native-plugins/adapters/test_webpack_filesystem_cache_control_serves_stale_without_a_graph";
import { test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge } from "./unplugin/native-plugins/adapters/test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge";
import { test_rollup_disposes_at_the_right_boundary } from "./unplugin/native-plugins/adapters/test_rollup_disposes_at_the_right_boundary";
import { test_rollup_transforms_a_cached_module_the_bridge_still_owes } from "./unplugin/native-plugins/adapters/test_rollup_transforms_a_cached_module_the_bridge_still_owes";
import { test_build_hosts_register_the_project_record_alone } from "./unplugin/native-plugins/adapters/test_build_hosts_register_the_project_record_alone";
import { createRealNativeEnvelopeFixture } from "../internal/unplugin/internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { test_vite_serve_with_a_watcher_keeps_persistent_validation } from "./unplugin/native-plugins/adapters/test_vite_serve_with_a_watcher_keeps_persistent_validation";
import { test_bun_native_host_owns_build_and_runtime_sessions } from "./unplugin/native-plugins/adapters/test_bun_native_host_owns_build_and_runtime_sessions";
import { test_bun_register_preload_only_registers_a_single_default_plugin } from "./unplugin/native-plugins/adapters/test_bun_register_preload_only_registers_a_single_default_plugin";
import { test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order } from "./unplugin/native-plugins/adapters/test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order";
import { test_bun_adapter_survives_plugin_reported_dependencies } from "./unplugin/native-plugins/adapters/test_bun_adapter_survives_plugin_reported_dependencies";
import { test_bun_adapter_passes_through_an_out_of_program_module } from "./unplugin/native-plugins/adapters/test_bun_adapter_passes_through_an_out_of_program_module";
import { test_bun_adapter_forwards_bundler_build_start } from "./unplugin/native-plugins/adapters/test_bun_adapter_forwards_bundler_build_start";
import { test_bun_runtime_does_not_rehash_the_project_per_module } from "./unplugin/native-plugins/adapters/test_bun_runtime_does_not_rehash_the_project_per_module";
import { test_turbopack_loader_workers_share_one_compile } from "./unplugin/native-plugins/adapters/test_turbopack_loader_workers_share_one_compile";
import { test_vite_build_end_disposes_the_last_overlapping_cache_owner } from "./unplugin/native-plugins/adapters/test_vite_build_end_disposes_the_last_overlapping_cache_owner";
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
 * The type-edge root also serves Rollup's three kept-cache builds after the
 * webpack stale-control compilers close and original V1/reader-graph bytes
 * are restored. Unchanged code/transform count and the later AGE literal
 * remain Rollup-owned assertions, with no inferred shared Program.
 * After both Turbopack workers close, their original two-module root serves
 * captured Rollup teardown; its interval counts remain 1/1/2/3 and finally
 * awaits closeWatcher before any owner can complete.
 * A separate real-envelope root serves captured Rollup bridge debt, followed
 * only after its awaited closeWatcher by exact declaration restoration and
 * the original build-host record channels. Native observer and record literals
 * remain independent of the captured host metadata; mutation profiles end last.
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
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup/esbuild lifecycle callbacks connect built adapters to native transforms; a fabricated adapter or direct cache-policy unit cannot witness those host connections. The separate original Bun process runs two native build passes and a preload runtime, preserving outputs and compile counts2/3.
 * @evidence contracts/e2e.md#shared-execution One generated consumer/source descriptor and shared content-addressed plugin cache serve the native fixture profiles. Three banner source-map bodies borrow one physical linked project and package link, replacing three identical setup paths; this banner producer is distinct from the native fixture producer. Host sessions, source changes and config generations remain separately observed; callbacks do not prove process or Program counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The production-session startup proof runs first and independently requires the shared root tool directory absent; a parent bridge cannot supply its sibling proof. Its actual worker close gates Vite/Rollup, which then read unchanged baseline. Their completion gates precede dependency options, its close precedes count-runs, and esbuild successful lifecycle precedes exact authored baseline-config restoration. Default loader return precedes original plain-record observations, then their completed assertions precede the original empty-config-plugin/reporting input on the same root. Reporting return gates later option profiles; both original single-record channels and relative/absolute/duplicate/self inputs remain. The original A: prefix options return before volatile then hermetic options. The original numeric PLUGIN suffix, [false] and [] cacheability observations remain; hermetic callback return gates distinct emit-dependencies options and its two identical requests, then the absent host channel. Original Before/After declaration bytes require repeated record movement, redelivery and five-second stopped movement before exact baseline-byte restoration; failed acknowledgment blocks later profiles. Actual cold/native cache events remain separately observable, not inferred from request order. Out-of-program delivery must return and restore the exact stderr descriptor before final read-helper options. Original src/helper.ts absence is checked. Uncertain completion blocks mutation; common inputs remain retained. Public operation boundaries do not certify arbitrary descendants and no mutation follows the failed-loader terminal profile.
 * @evidence contracts/e2e.md#preserved-coverage Original native fixture body literals, controls and host disposal assertions remain. Source-map bodies retain no SOURCEMAP_BROKEN, authored value coordinates, embedded source text, webpack/Rspack marker coordinates and Turbopack shifted-line plus exact map position. Rollup close gates the unchanged esbuild input; esbuild return gates the original terminal marker rewrite. Linked-project readers and failed fixture readers use separate roots; common inputs remain retained. The unchanged-default Bun slot owns its actual build/preload children; their successful returns gate exact config restoration for captured default CJS/ESM registration, then empty-config explicit A/B/PRESERVED/locked/pending-ENOENT contrasts. Its two real process lifetimes remain necessary, not assumed savings; captured setup is not a real Bun host. The linked candidate fixture keeps empty watcherless registrations, production linked output and the existing combined first-request, unrelated creation, unchanged restart, automatic type-root membership and preferred-candidate HMR assertions; mutation phases run last after both earlier owning bodies return. The watch-build retention and teardown survivor shares one four-module project across three unchanged passes and close/reconstruction, preserving counts1/2 and every successful delivery. Other approved profiles, baseline measurement and actual selected survival remain pending; no donors are removed.
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
  // Bun's cold build/preload session requires its original default options,
  // unlike the mutable parent-process loader profiles on root.
  try {
    const bunRoot = TestUnpluginProject.createProject();
    TestProject.retainTemporaryDirectory(bunRoot, "Bun cold build and preload inputs retained for actual host observation");
    const bunConfigPath = path.join(bunRoot, "tsconfig.json");
    const bunConfig = fs.readFileSync(bunConfigPath);
    await Scenarios.invoke("shared-unplugin", "test_bun_native_host_owns_build_and_runtime_sessions", test_bun_native_host_owns_build_and_runtime_sessions, bunRoot);
    // Both real Bun processes returned before parent-process registration.
    fs.writeFileSync(bunConfigPath, bunConfig);
    assert.deepEqual(fs.readFileSync(bunConfigPath), bunConfig);
    await Scenarios.invoke("shared-unplugin", "test_bun_register_preload_only_registers_a_single_default_plugin", test_bun_register_preload_only_registers_a_single_default_plugin, bunRoot);
    // Captured default delivery has completed and its temporary global is
    // restored. The explicit-options original starts with no config plugins.
    const explicitConfig = JSON.parse(bunConfig.toString("utf8"));
    explicitConfig.compilerOptions.plugins = [];
    fs.writeFileSync(bunConfigPath, JSON.stringify(explicitConfig, null, 2));
    await Scenarios.invoke("shared-unplugin", "test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order", test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order, bunRoot);
  } catch (cause) {
    failures.push(new Error("real Bun build disposal and preload runtime session", { cause }));
  }
  try {
    const capturedRoot = TestUnpluginProject.createProject();
    TestProject.retainTemporaryDirectory(capturedRoot, "Captured Bun dependency, pass-through and lifecycle inputs retained");
    const configPath = path.join(capturedRoot, "tsconfig.json");
    const originalConfig = fs.readFileSync(configPath);
    const config = JSON.parse(originalConfig.toString("utf8"));
    config.compilerOptions.plugins = [{
      transform: "./plugin.cjs", name: "fixture", operation: "emit-dependencies",
      dependencies: ["src/types.d.ts", path.join("/abs", "types", "model.d.ts"), "src/types.d.ts", "src/main.ts"],
    }];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await Scenarios.invoke("shared-unplugin", "test_bun_adapter_survives_plugin_reported_dependencies", test_bun_adapter_survives_plugin_reported_dependencies, capturedRoot);
    fs.writeFileSync(configPath, originalConfig);
    assert.deepEqual(fs.readFileSync(configPath), originalConfig);
    await Scenarios.invoke("shared-unplugin", "test_bun_adapter_passes_through_an_out_of_program_module", test_bun_adapter_passes_through_an_out_of_program_module, capturedRoot);
    const runLog = path.join(TestProject.tmpdir("ttsc-shared-bun-hook-log-"), "compiles.bin");
    config.compilerOptions.plugins = [
      { transform: "./plugin.cjs", name: "fixture", operation: "echo-file", path: "src/secondary.ts" },
      { transform: "./plugin.cjs", name: "runs", operation: "count-runs", runLog },
    ];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await Scenarios.invoke("shared-unplugin", "test_bun_adapter_forwards_bundler_build_start", test_bun_adapter_forwards_bundler_build_start, { root: capturedRoot, runLog });
    // Successful return includes final onEnd. The runtime-only session gets
    // the original echo options and becomes this root's terminal mutation.
    config.compilerOptions.plugins.pop();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await Scenarios.invoke("shared-unplugin", "test_bun_runtime_does_not_rehash_the_project_per_module", test_bun_runtime_does_not_rehash_the_project_per_module, capturedRoot);
  } catch (cause) {
    failures.push(new Error("captured Bun dependencies, pass-through and build/runtime lifecycle", { cause }));
  }
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
      fs.writeFileSync(plugin, prepared.originalPlugin);
      assert.deepEqual(fs.readFileSync(plugin), prepared.originalPlugin);
      const configPath = path.join(prepared.root, "tsconfig.json");
      const originalConfig = fs.readFileSync(configPath);
      const overlapConfig = JSON.parse(originalConfig.toString("utf8"));
      assert.equal(overlapConfig.compilerOptions.plugins.length, 1);
      const overlapOptions = overlapConfig.compilerOptions.plugins[0];
      assert.equal(overlapOptions.graphCandidates, 0);
      assert.equal(overlapOptions.graphFanout, 0);
      overlapOptions.graphCandidates = 1;
      overlapOptions.graphFanout = 1;
      const dependency = path.join(prepared.root, "node_modules", "dep0");
      assert.equal(fs.existsSync(dependency), false);
      fs.mkdirSync(dependency, { recursive: true });
      const dependencyBytes = "export declare const dep0: number;\n";
      fs.writeFileSync(path.join(dependency, "index.d.ts"), dependencyBytes);
      fs.writeFileSync(configPath, JSON.stringify(overlapConfig, null, 2));
      await Scenarios.invoke("shared-unplugin", "test_vite_build_end_disposes_the_last_overlapping_cache_owner", test_vite_build_end_disposes_the_last_overlapping_cache_owner, prepared);
      // Every modeled lifecycle has ended before returning; restore the
      // original input contract before handing the root to real workers.
      fs.writeFileSync(plugin, prepared.originalPlugin);
      assert.deepEqual(fs.readFileSync(plugin), prepared.originalPlugin);
      fs.writeFileSync(configPath, originalConfig);
      assert.deepEqual(fs.readFileSync(configPath), originalConfig);
      assert.equal(fs.readFileSync(path.join(dependency, "index.d.ts"), "utf8"), dependencyBytes);
      fs.renameSync(dependency, path.join(prepared.root, "overlap-dependency-observed"));
      // Successful return includes awaited hook close. Restore the descriptor,
      // then retain the surplus modules outside the original include root.
      fs.writeFileSync(plugin, prepared.originalPlugin);
      assert.deepEqual(fs.readFileSync(plugin), prepared.originalPlugin);
      const held = path.join(prepared.root, "vite-observed");
      fs.mkdirSync(held);
      for (const name of ["mod2.ts", "mod3.ts"]) {
        const source = path.join(prepared.root, "src", name);
        const bytes = fs.readFileSync(source);
        fs.renameSync(source, path.join(held, name));
        assert.deepEqual(fs.readFileSync(path.join(held, name)), bytes);
      }
      for (const index of [0, 1])
        assert.equal(fs.readFileSync(path.join(prepared.root, "src", `mod${index}.ts`), "utf8"), `export const value${index}: string = "PROBE";\n`);
      await Scenarios.invoke("shared-unplugin", "test_turbopack_loader_workers_share_one_compile", test_turbopack_loader_workers_share_one_compile, prepared);
      await Scenarios.invoke("shared-unplugin", "test_rollup_disposes_at_the_right_boundary", test_rollup_disposes_at_the_right_boundary, prepared);
    });
  } catch (cause) {
    failures.push(new Error("watcherless Vite first and repeated deliveries", { cause }));
  }
  let watcherlessCandidateReturned = false;
  try {
    const recordFixture = createRealNativeEnvelopeFixture();
    TestProject.retainTemporaryDirectory(recordFixture.root, "Shared real-envelope bridge debt and record channel inputs retained");
    const originalDeclaration = fs.readFileSync(recordFixture.declaration);
    await Scenarios.invoke("shared-unplugin", "test_rollup_transforms_a_cached_module_the_bridge_still_owes", test_rollup_transforms_a_cached_module_the_bridge_still_owes, recordFixture);
    fs.writeFileSync(recordFixture.declaration, originalDeclaration);
    assert.deepEqual(fs.readFileSync(recordFixture.declaration), originalDeclaration);
    await Scenarios.invoke("shared-unplugin", "test_build_hosts_register_the_project_record_alone", test_build_hosts_register_the_project_record_alone, recordFixture);
  } catch (cause) {
    failures.push(new Error("real-envelope Rollup bridge debt and host record channels", { cause }));
  }
  try {
    await Scenarios.invoke("shared-unplugin", "webpack-watch-timestamp-and-type-edge", test_webpack_watch_reuses_the_generation_across_rebuilds, true, async (prepared: { root: string; runLog: string; originalType: Buffer }) => {
      const typeOnly = path.join(prepared.root, "src", "mytype.ts");
      fs.writeFileSync(typeOnly, prepared.originalType);
      assert.deepEqual(fs.readFileSync(typeOnly), prepared.originalType);
      await Scenarios.invoke("shared-unplugin", "test_webpack_sequential_compilers_share_one_generation", test_webpack_sequential_compilers_share_one_generation, prepared);
      const configPath = path.join(prepared.root, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      assert.deepEqual(config.compilerOptions.plugins.map((entry: { name: string }) => entry.name), ["reader", "graph", "runs"]);
      // Restore the original positive input; only this profile's webpack cache
      // is reset between experiments, never between either pair of builds.
      config.compilerOptions.plugins.pop();
      fs.writeFileSync(typeOnly, prepared.originalType);
      assert.deepEqual(fs.readFileSync(typeOnly), prepared.originalType);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      const positiveTypeConfig = fs.readFileSync(configPath);
      const webpackCache = path.join(prepared.root, ".cache", "webpack");
      fs.rmSync(webpackCache, { recursive: true, force: true });
      await Scenarios.invoke("shared-unplugin", "test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge", test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge, prepared.root);
      // Successful return includes both compiler closes. The control has the
      // original reader alone, and gets its own initially empty kept cache.
      fs.writeFileSync(typeOnly, prepared.originalType);
      assert.deepEqual(fs.readFileSync(typeOnly), prepared.originalType);
      config.compilerOptions.plugins.pop();
      assert.deepEqual(config.compilerOptions.plugins.map((entry: { name: string }) => entry.name), ["reader"]);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      fs.rmSync(webpackCache, { recursive: true, force: true });
      await Scenarios.invoke("shared-unplugin", "test_webpack_filesystem_cache_control_serves_stale_without_a_graph", test_webpack_filesystem_cache_control_serves_stale_without_a_graph, prepared.root);
      // Both control compilers have closed. Rollup receives the original
      // reader/graph inputs and keeps its own cache across all three builds.
      fs.writeFileSync(typeOnly, prepared.originalType);
      assert.deepEqual(fs.readFileSync(typeOnly), prepared.originalType);
      fs.writeFileSync(configPath, positiveTypeConfig);
      assert.deepEqual(fs.readFileSync(configPath), positiveTypeConfig);
      await Scenarios.invoke("shared-unplugin", "test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge", test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge, prepared.root);
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
