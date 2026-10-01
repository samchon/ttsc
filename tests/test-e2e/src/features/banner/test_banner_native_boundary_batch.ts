import { case_banner_auto_discovered_config_requires_banner_config_file } from "./native-plugins/consumer/case_banner_auto_discovered_config_requires_banner_config_file";
import { case_banner_diagnostic_lines_point_at_original_source } from "./native-plugins/consumer/case_banner_diagnostic_lines_point_at_original_source";
import { case_banner_inline_source_map_lines_point_at_original_source } from "./native-plugins/consumer/case_banner_inline_source_map_lines_point_at_original_source";
import { case_banner_json_config_file_loads_banner_text } from "./native-plugins/consumer/case_banner_json_config_file_loads_banner_text";
import { case_banner_package_auto_discovers_config_file } from "./native-plugins/consumer/case_banner_package_auto_discovers_config_file";
import { case_banner_preserves_executable_shebang } from "./native-plugins/consumer/case_banner_preserves_executable_shebang";
import { case_banner_shared_host_ignores_future_optional_flags } from "./native-plugins/consumer/case_banner_shared_host_ignores_future_optional_flags";
import { case_banner_source_map_lines_correct_under_remove_comments } from "./native-plugins/consumer/case_banner_source_map_lines_correct_under_remove_comments";
import { case_banner_source_map_lines_point_at_original_source } from "./native-plugins/consumer/case_banner_source_map_lines_point_at_original_source";
import { case_banner_tsconfig_config_overrides_package_auto_config } from "./native-plugins/consumer/case_banner_tsconfig_config_overrides_package_auto_config";
import { case_banner_ttsx_discovers_an_installed_package_root_config } from "./native-plugins/consumer/case_banner_ttsx_discovers_an_installed_package_root_config";
import { case_banner_rejects_inline_options_in_tsconfig_entry } from "./case_banner_rejects_inline_options_in_tsconfig_entry";

/**
 * Verifies banner native emission, registration and runtime connections in one batch.
 *
 * Portable option and config semantics execute in their Go/TypeScript units.
 * This batch owns actual emitted text/maps/diagnostics, package registration,
 * the native command protocol and ttsx dependency preparation.
 *
 * 1. Run retained connection scenes using one content-keyed native artifact cache.
 * 2. Share compatible emit, map and embedded-source observations in one compile.
 * 3. Collect every independent scene failure before rejecting the batch.
 *
 * @evidence contracts/testing.md#behavioral-verification Scene assertions observe real native output, diagnostics, protocol JSON or runtime stdout; the scene helper comments identify their individual oracles.
 * @evidence contracts/testing.md#independent-expectations Authored config/source bytes, literal source coordinates and supported output/status contracts establish expected results independently of the compiler.
 * @evidence contracts/testing.md#distinguishing-cases Retained/removed comments, external/inline maps, valid/invalid registration, missing/competing config, interpreter directive and dependency runtime scenes retain their separate assertions.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this sole test_banner_native_boundary_batch function. Ordinary case_banner helpers are explicit scene calls, not separately discovered tests; this address owns the complete execution population.
 * @evidence contracts/e2e.md#necessary-boundary The surviving scenes connect the descriptor, native preamble/emit pipeline, serialized maps/diagnostics, executable command and ttsx dependency preparation. Direct units do not prove those connections.
 * @evidence contracts/e2e.md#shared-execution One process and content-keyed artifact cache serve the batch. Emit/declaration/maps/embedded-source assertions share one compilation, and removed-comment text/maps share another. Different registration/config inputs, failed typecheck, incompatible inline-map mode and ttsx execution still require distinct product invocations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each scene owns its temporary project through TestProject; completed map output is immutable and its project is released in finally. Native artifact reuse requires unchanged compiler/plugin/build inputs. Synchronous children finish before scene assertions and independent failures do not skip later scenes.
 * @evidence contracts/e2e.md#preserved-coverage All meaningful original text/count/trailer/map/source-content/diagnostic/registration/protocol/runtime assertions remain in the retained scene bodies. Injection/inlineSources and removed-comment duplicates have their assertions in the map scenes; no portable coverage is claimed from an unexecuted owner.
 */
export async function test_banner_native_boundary_batch() {
  const failures: Error[] = [];
  const scenes: Array<[string, () => unknown]> = [
    ["auto_discovered_config_requires_banner_config_file", case_banner_auto_discovered_config_requires_banner_config_file],
    ["diagnostic_lines_point_at_original_source", case_banner_diagnostic_lines_point_at_original_source],
    ["inline_source_map_lines_point_at_original_source", case_banner_inline_source_map_lines_point_at_original_source],
    ["json_config_file_loads_banner_text", case_banner_json_config_file_loads_banner_text],
    ["package_auto_discovers_config_file", case_banner_package_auto_discovers_config_file],
    ["preserves_executable_shebang", case_banner_preserves_executable_shebang],
    ["shared_host_ignores_future_optional_flags", case_banner_shared_host_ignores_future_optional_flags],
    ["source_map_lines_correct_under_remove_comments", case_banner_source_map_lines_correct_under_remove_comments],
    ["source_map_lines_point_at_original_source", case_banner_source_map_lines_point_at_original_source],
    ["tsconfig_config_overrides_package_auto_config", case_banner_tsconfig_config_overrides_package_auto_config],
    ["ttsx_discovers_an_installed_package_root_config", case_banner_ttsx_discovers_an_installed_package_root_config],
    ["rejects_inline_options_in_tsconfig_entry", case_banner_rejects_inline_options_in_tsconfig_entry],
  ];
  for (const [name, run] of scenes) {
    try {
      await run();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  }
  if (failures.length) throw new AggregateError(failures, "banner boundary scenes failed");
}
