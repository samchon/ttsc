import { Scenarios } from "../../internal/Scenarios";
import { UtilityWorkspace } from "../../internal/UtilityWorkspace";
import { case_paths_rewrites_bundler_esm_and_allow_js_targets } from "./scenes/case_paths_rewrites_bundler_esm_and_allow_js_targets";
import { case_paths_rewrites_commonjs_json_alias_to_copied_extension } from "./scenes/case_paths_rewrites_commonjs_json_alias_to_copied_extension";
import { case_paths_uses_nodenext_extensions_and_json_import_attributes } from "./scenes/case_paths_uses_nodenext_extensions_and_json_import_attributes";

/**
 * Verifies the @ttsc/paths plugin through one shared workspace.
 *
 * The experiment copies `fixtures/paths/workspace` once, links the real package
 * once and reuses the content-keyed plugin cache. The five former projects had
 * three distinct compiler settings (bundler ES modules, NodeNext, CommonJS), so
 * the workspace holds one project per setting and the inputs that shared a
 * setting are merged into it rather than compiled separately. Scenarios are
 * independent and failures are reported under their names.
 *
 * 1. Open the workspace and run the bundler, NodeNext and CommonJS scenarios.
 * 2. Collect every scenario failure instead of stopping at the first.
 * 3. Remove the workspace and verify the linked package was not reached.
 *
 * @evidence contracts/testing.md#behavioral-verification Each scenario emits through the built launcher and asserts rewritten specifiers, copied files and runtime loading; this entry adds only the cleanup check.
 * @evidence contracts/testing.md#independent-expectations Expected specifiers come from authored tsconfig paths, source trees and module-kind extension rules documented in each scenario.
 * @evidence contracts/testing.md#distinguishing-cases The three module settings select different output extension rules, and each scenario covers its own alias forms with negative checks for surviving aliases and invented siblings.
 * @evidence contracts/testing.md#execution-ownership test_e2e_paths is the discoverable entry of the single test-e2e module; the three scenarios are exported case functions selected by the same Evidence claim, and path matching and prediction remain Go units.
 * @evidence contracts/e2e.md#necessary-boundary Plugin rewriting, module resolution and emitted files connect only in a real compiler run; each scenario states which output it proves.
 * @evidence contracts/e2e.md#shared-execution Five former projects and launcher runs become three: one workspace copy and package link, with the two bundler inputs and the two NodeNext inputs each compiled once. A separate CommonJS run remains because the module setting changes the output extension rules.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each scenario directory owns its tsconfig, sources and output, input files carry distinct names, and close removes the copy and checks the link target survived.
 * @evidence contracts/e2e.md#preserved-coverage Every former assertion is retained in a scenario at the same strictness; merged projects add that former inputs coexist under one paths table.
 */
export async function test_e2e_paths(): Promise<void> {
  const workspace = UtilityWorkspace.open("paths");
  try {
    await Scenarios.collect("paths", [
      ["rewrites_bundler_esm_and_allow_js_targets", () => case_paths_rewrites_bundler_esm_and_allow_js_targets(workspace)],
      ["uses_nodenext_extensions_and_json_import_attributes", () => case_paths_uses_nodenext_extensions_and_json_import_attributes(workspace)],
      ["rewrites_commonjs_json_alias_to_copied_extension", () => case_paths_rewrites_commonjs_json_alias_to_copied_extension(workspace)],
    ]);
  } finally {
    UtilityWorkspace.close(workspace);
  }
}
