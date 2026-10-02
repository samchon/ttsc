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
 * Verifies banner, path rewriting and stripping in one native compiler Program.
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
 * 3. Collect independent failures and join every process before workspace removal.
 *
 * @evidence contracts/testing.md#behavioral-verification Exact banner/shebang/map assertions remain with their named scenarios. The combined native emit must rewrite JSON to ./data.json without an invented .js file, remove configured calls/statements while retaining warn/info and StripBox declarations, and execute both outputs with exactly ttsc:42 and kept on stdout.
 * @evidence contracts/testing.md#independent-expectations Authored configuration lists, literal copied JSON values, Node module extension rules and retained unconfigured neighbors supply expectations independently. Source-map assertions retain their independent VLQ decoder and authored source bytes.
 * @evidence contracts/testing.md#distinguishing-cases CommonJS JSON copying, four-line banner/shebang ordering and configured/unconfigured strip calls coexist in the shared Program. Native external maps, missing/inline configurations, own/ancestor discovery, overrides and ttsx remain separately named real inputs. TestUtilityBannerMapsPreserveAuthoredLinesAcrossEmitModes owns the original inline/removeComments maps and banner-absence literals directly. TestUtilityEmitPreservesBundlerAndNodeNextSpecifiers owns the full Bundler/NodeNext alias, four JavaScript-extension and JSON-attribute/copy matrix through actual in-process compiler emission.
 * @evidence contracts/testing.md#execution-ownership test_e2e_utilities is the single discovery entry for banner, paths and strip selections; aliased package selections are deduplicated. Named scenario declarations retain their own contracts; exact Go names select their existing standalone protocol boundaries.
 * @evidence contracts/e2e.md#necessary-boundary The combined real native compiler output connects configuration loading, AST transforms, map correction, JSON copying and the Node loader. Distinct standalone utility command protocols remain Go-owned, while portable plugin decisions remain the package units.
 * @evidence contracts/e2e.md#shared-execution Three CommonJS compiler Programs become one and two output runtime children become one. Three fixture copies become one root with one set of three package links and a content-keyed plugin cache. Two paths-only launcher invocations are removed after their complete serialized output expectations execute through the direct owning Go emitter unit; it needs two in-process Programs for incompatible compiler options but no native producer or product subprocess. Two further inline/removeComments native invocations are removed after their original actual output checks pass in the direct Go map unit. It needs two incompatible in-process Programs but no artifact producer or child. Configuration discovery/error states retain their real runs; no cold or invalidation result is reused.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Sources have distinct output identities and only the combined baseline consumes its JSON/strip configuration. Other configurations explicitly select their ordinary source or strip source and cannot inherit baseline-only plugin settings. Sibling manifests do not become ancestors. Synchronous launcher/runtime calls join before assertions and final removal verifies all linked checkout packages survive.
 * @evidence contracts/e2e.md#preserved-coverage Original paths CommonJS specifier/copied-file/absent-invented-file/runtime assertions and every configured stripping JavaScript/declaration/runtime assertion execute in the combined baseline. All former Bundler/NodeNext file-content, alias-absence, extension, declaration, copied-JSON and attribute expectations execute in packages/paths/test/unit/utility_emit_preserves_bundler_and_nodenext_specifiers_test.go against actual compiler output; its static matrix preserves the nineteen original authored inputs and adds an actual no-data.js-sibling check. Banner and strip configuration-loading, command-dispatch and junction-resolution failure identities are now in-process units in their packages; the real sidecar entries still execute here, because the host plugin of each generated native build is the process that ttsc starts. Metadata aliases, empty argv, unsupported and flag-shaped first tokens, and malformed manifest rejection are owned by the direct TestUtilityCommandPrintsVersionAliases, TestUtilityCommandRequiresArgument, TestUtilityCommandRejectsUnknown and TestUtilityCommandRejectsInvalidPluginManifest units; their fifteen former entries no longer start twenty-seven native command invocations.
 */
export async function test_e2e_utilities(): Promise<void> {
  const workspace = UtilityWorkspace.open();
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
            "One actual Program runs the shared native ApplyProgram probe with banner, paths and strip registrations",
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
    UtilityWorkspace.close(workspace);
  } catch (error) {
    failures.push(new Error("utility workspace cleanup", { cause: error }));
  }
  if (failures.length)
    throw new AggregateError(failures, "Utility plugin experiments failed");
}
