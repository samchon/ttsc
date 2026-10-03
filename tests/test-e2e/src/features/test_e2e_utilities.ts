import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Scenarios } from "../internal/Scenarios";
import { UtilityWorkspace } from "../internal/UtilityWorkspace";
import { case_banner_diagnostic_lines_point_at_original_source } from "./banner/scenes/case_banner_diagnostic_lines_point_at_original_source";
import { case_banner_preserves_executable_shebang } from "./banner/scenes/case_banner_preserves_executable_shebang";
import { case_banner_rejects_missing_config_and_inline_options } from "./banner/scenes/case_banner_rejects_missing_config_and_inline_options";
import { case_banner_selects_configuration_by_source } from "./banner/scenes/case_banner_selects_configuration_by_source";
import { case_banner_shared_host_ignores_future_optional_flags } from "./banner/scenes/case_banner_shared_host_ignores_future_optional_flags";
import { case_banner_source_maps_point_at_original_source } from "./banner/scenes/case_banner_source_maps_point_at_original_source";
import { case_banner_ttsx_discovers_an_installed_package_root_config } from "./banner/scenes/case_banner_ttsx_discovers_an_installed_package_root_config";
import { case_paths_rewrites_only_unshadowed_require } from "./paths/scenes/case_paths_rewrites_only_unshadowed_require";
import { case_strip_explicit_config_sources_override_package_auto_plugin } from "./strip/scenes/case_strip_explicit_config_sources_override_package_auto_plugin";
import { case_strip_package_auto_plugin_uses_default_config } from "./strip/scenes/case_strip_package_auto_plugin_uses_default_config";
import { case_strip_rejects_inline_config_keys } from "./strip/scenes/case_strip_rejects_inline_config_keys";

/**
 * Verifies banner, path rewriting and stripping through shared emitted outputs.
 *
 * The CommonJS baseline contains ordinary and shebang sources, a JSON alias and
 * configured stripping controls. One compile emits all four sources with all
 * three actual plugins, and one Node execution loads the JSON and stripped
 * outputs together. Configuration discovery states keep their authored inputs
 * inside the same owned workspace. Bundler and NodeNext serialized paths
 * matrices are owned by the direct Go emitter unit, rather than repeating
 * native launcher preparation to inspect files.
 *
 * 1. Compile the combined baseline and independently check banner/map, JSON,
 *    stripping and runtime results under their original failure identities.
 * 2. Exercise configuration-discovery inputs; incompatible serialized outputs use
 *    actual in-process compiler units.
 * 3. Collect independent failures and attempt owned workspace cleanup.
 *
 * @evidence contracts/testing.md#behavioral-verification Exact banner/shebang/map assertions remain with their named scenarios. The combined native emit must rewrite JSON to ./data.json without an invented .js file, remove configured calls/statements while retaining warn/info and StripBox declarations, and execute both outputs with exactly ttsc:42 and kept on stdout.
 * @evidence contracts/testing.md#independent-expectations Authored configuration lists, literal copied JSON values, Node module extension rules and retained unconfigured neighbors supply expectations independently. Source-map assertions retain their independent VLQ decoder and authored source bytes.
 * @evidence contracts/testing.md#distinguishing-cases The shared CommonJS output holds JSON copying, banner/shebang and configured/unconfigured strip controls; external maps, discovery, rejection, overrides and ttsx retain separate named inputs. Existing direct Go emitter/map matrices have their exact inputs and differences recorded separately, not blanket runtime equivalence to every loader or shebang input.
 * @evidence contracts/testing.md#execution-ownership This parent calls named utility scenes plus baseline observers and aggregates cleanup failures. It starts no GoBoundary selection; standalone direct Go units have their own root test:go selection. Package aliases in the test runner do not establish native producer or Program-object identity.
 * @evidence contracts/e2e.md#necessary-boundary Actual native output connects loaded plugin configuration, transforms, maps, JSON copying and Node execution. Direct command guard/emitter/map semantics remain separately owned; banner CJS build/check/transform loader connections are not all proven by this one baseline.
 * @evidence contracts/e2e.md#shared-execution One copied workspace and three checkout package links support shared immutable CommonJS output and distinct configuration/runtime inputs. A supplied prepared workspace is borrowed without allocating or removing another dependency owner; the common consumer retains final cleanup. The one-byte ApplyProgram probe records that fixture effect, not all Program constructions or successful cache hits. Historical removed calls and directory counts are not measured before/after reductions; actual process/generation populations and cold or invalidated inputs remain separately observed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Output identities and selected per-scene inputs remain distinct, with sibling configurations off ancestor paths. Shared environment/cache remain shared. Synchronous launcher/runtime results precede assertions; final cleanup checks root absence and surviving linked package manifests, not arbitrary descendant shutdown, loaded-image identity or every upstream resolution.
 * @evidence contracts/e2e.md#preserved-coverage All current JSON specifier/copy/no-data.js, configured JS/declaration, exact ordered runtime and named scene oracles remain. Exact direct owners include packages/paths/test/unit/utility_emit_preserves_bundler_and_nodenext_specifiers_test.go::TestUtilityEmitPreservesBundlerAndNodeNextSpecifiers and packages/banner/test/unit/utility_banner_maps_preserve_authored_lines_across_emit_modes_test.go::TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes. Their recorded matrices preserve portable serialized meanings with original loader/shebang differences disclosed; body presence is not runtime survival. Version/argv/unknown/manifest direct command owners do not certify product-process or executable-config transport; no further donor removal is permitted without actual survival proof.
 */
export async function test_e2e_utilities(preparedWorkspace?: UtilityWorkspace.IWorkspace): Promise<void> {
  const workspace = preparedWorkspace ?? UtilityWorkspace.open();
  const banner = { ...workspace, root: path.join(workspace.root, "banner") };
  const strip = { ...workspace, root: path.join(workspace.root, "strip") };
  const failures: unknown[] = [];
  try {
    await Scenarios.collect("utility plugins", [
      [
        "paths_rewrites_only_unshadowed_require",
        () => case_paths_rewrites_only_unshadowed_require(workspace),
      ],
      [
        "preserves_executable_shebang",
        () => case_banner_preserves_executable_shebang(banner),
      ],
      [
        "source_maps_point_at_original_source",
        () => case_banner_source_maps_point_at_original_source(banner),
      ],
      [
        "shared_compiler_program_owns_all_linked_contributors",
        () => {
          assert.equal(
            fs.readFileSync(workspace.programRunLog).length,
            1,
            "The shared native ApplyProgram probe records one fixture effect with banner, paths and strip registrations",
          );
        },
      ],
      [
        "rewrites_commonjs_json_alias_to_copied_extension",
        () => {
          const js = UtilityWorkspace.read(
            banner,
            "external-maps",
            "dist/path-case.js",
          );
          assert.match(js, /require\("\.\/data\.json"\)/);
          assert.doesNotMatch(js, /require\("\.\/data\.js"\)/);
          assert.doesNotMatch(js, /@data/);
          assert.ok(
            UtilityWorkspace.exists(banner, "external-maps", "dist/data.json"),
            "dist/data.json must be copied by the compiler",
          );
          assert.ok(
            !UtilityWorkspace.exists(banner, "external-maps", "dist/data.js"),
            "no invented dist/data.js sibling may exist",
          );
        },
      ],
      [
        "configured_calls_and_statements",
        () => {
          const js = UtilityWorkspace.read(
            banner,
            "external-maps",
            "dist/strip-case.js",
          );
          assert.doesNotMatch(js, /console\.(?:log|debug)/);
          assert.doesNotMatch(js, /\bdebugger\b/);
          assert.doesNotMatch(js, /assert\.equal/);
          assert.doesNotMatch(js, /guarded-log-call/);
          assert.match(js, /console\.info\("kept"\)/);
          assert.match(js, /console\.warn\("warn-call"\)/);
          const dts = UtilityWorkspace.read(
            banner,
            "external-maps",
            "dist/strip-case.d.ts",
          );
          assert.match(dts, /interface StripBox/);
          assert.match(dts, /value: string/);
          assert.doesNotMatch(dts, /console|debugger|assert/);
        },
      ],
      [
        "commonjs_json_and_stripped_output_runtime",
        () => {
          const cwd = UtilityWorkspace.project(banner, "external-maps");
          const run = TestProject.runNode(path.join(cwd, "runtime.cjs"), {
            cwd,
          });
          console.log(
            "Utility shared output runtime invocation " +
              JSON.stringify({ pid: run.pid, status: run.status }),
          );
          assert.equal(run.status, 0, run.stderr);
          assert.deepEqual(run.stdout.trim().split(/\r?\n/), [
            "ttsc:42",
            "kept",
          ]);
        },
      ],
      [
        "banner_selects_configuration_by_source",
        () => case_banner_selects_configuration_by_source(banner),
      ],
      [
        "banner_rejects_missing_config_and_inline_options",
        () => case_banner_rejects_missing_config_and_inline_options(banner),
      ],
      [
        "banner_diagnostic_lines_point_at_original_source",
        () => case_banner_diagnostic_lines_point_at_original_source(banner),
      ],
      [
        "banner_shared_host_ignores_future_optional_flags",
        () => case_banner_shared_host_ignores_future_optional_flags(banner),
      ],
      [
        "banner_ttsx_discovers_an_installed_package_root_config",
        () =>
          case_banner_ttsx_discovers_an_installed_package_root_config(banner),
      ],
      [
        "strip_package_auto_plugin_uses_default_config",
        () => case_strip_package_auto_plugin_uses_default_config(strip),
      ],
      [
        "strip_explicit_config_sources_override_package_auto_plugin",
        () =>
          case_strip_explicit_config_sources_override_package_auto_plugin(
            strip,
          ),
      ],
      [
        "strip_rejects_inline_config_keys",
        () => case_strip_rejects_inline_config_keys(strip),
      ],
    ]);
  } catch (error) {
    failures.push(error);
  }
  try {
    if (!preparedWorkspace) UtilityWorkspace.close(workspace);
  } catch (error) {
    failures.push(new Error("utility workspace cleanup", { cause: error }));
  }
  if (failures.length)
    throw new AggregateError(failures, "Utility plugin experiments failed");
}
