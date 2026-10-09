import fs from "node:fs";
import path from "node:path";

import { test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes } from "../features/ttsc/native-plugins/server/test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes";
import { test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes } from "../features/ttsc/native-plugins/server/test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes";
import { test_ttscserver_launcher_uses_native_flag_authority } from "../features/ttsc/ttscserver/test_ttscserver_launcher_uses_native_flag_authority";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Preserve native launch authority and terminal plugin-selection transitions
 * on upfront islands in the shared consumer.
 *
 * @evidence contracts/testing.md#behavioral-verification The launch-authority body requires actual B plugin/upstream contexts, B diagnostics, logical alias URI, project-relative runtime and native refusal controls. Original terminal bodies still require selection notifications and native sentinel exit1 for adding/removing configured plugins, adding an automatically discovered dependency and changing copied Go source/descriptor; the intermediate configured server must publish real no-var and the source-edit server the exact edited native rule message.
 * @evidence contracts/testing.md#independent-expectations Authored A/B rule contrasts and literal final arguments establish launch selection; authored var source, configured no-var and original literal diagnostic/sentinel establish terminal selection before and after each mutation. The owning bodies assert actual protocol/process observations rather than inferring success from fingerprints or synthetic events.
 * @evidence contracts/testing.md#distinguishing-cases Existing versus missing superseded launch values and native logical alias spelling precede the unchanged initially plugin-free addition, configured removal, manifest dependency discovery, real edited Go diagnostic and descriptor-only mutation cases. Their owning bodies retain individual failure identities and oracles.
 * @evidence contracts/testing.md#execution-ownership Selected LSP joins this independent corpus beside its ordinary editor body. This body owns two initialized launch-authority, one initialized empty-project and five terminal-selection actual launcher/native sessions, with no per-transition install; query/refusal controls create no LSP lifetimes.
 * @evidence contracts/e2e.md#necessary-boundary Native editor watched notifications, plugin selection and intentional process termination must agree; pure source selection units cannot establish the close connection.
 * @evidence contracts/e2e.md#shared-execution The two initialized launch-authority sessions use upfront tools/lsp-launch-authority A/B files and the installed immutable lint producer/cache. The initialized empty-project lifetime needs an isolated config-free root outside the shared ancestor config and no plugin build. All five terminal lifetimes use tools/lsp-selection and one copied owning lint producer/cache; intentional exits cannot witness their next initially distinct selection. Go objects and immutable copy population are prepared once, not per session.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The original body joins each native selection close before the next mutation. Original config/manifest bytes restore only after its supported close callback; an unresolved close retains inputs and cache. Body errors remain failures even after successful cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Adds the actual native argument-authority assembly without removing any of the five original terminal config/dependency/source/descriptor cases, intervening positive lint publication or real recompiled edited-rule message. Native preparation and descendant totals are unmeasured; source edits change only the owning package copy and restore after close.
 */
export async function lspSelectionCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/lsp-selection");
  const copy = path.join(workspace.root, "tools/mutable-lint-producer");
  const originals = new Map(
    [
      path.join(root, "tsconfig.json"),
      path.join(root, "package.json"),
      path.join(copy, "linthost/rules_var.go"),
      path.join(copy, "lib/index.js"),
    ].map((file) => [file, fs.readFileSync(file)]),
  );
  const failures: unknown[] = [];
  try {
    await test_ttscserver_launcher_uses_native_flag_authority({
      root: path.join(workspace.root, "tools/lsp-launch-authority"),
      cache: workspace.cache,
      retain: BatchWorkspace.retain,
    });
  } catch (error) {
    failures.push(error);
  }
  for (const run of [
    test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes,
    test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes,
  ]) {
    let closed = false;
    try {
      await run({
        root,
        copy,
        cache: workspace.cache,
        retain: BatchWorkspace.retain,
        closed: () => {
          closed = true;
        },
      });
    } catch (error) {
      failures.push(error);
    }
    if (closed) {
      let restorationFailed = false;
      for (const [file, bytes] of originals)
        try {
          fs.writeFileSync(file, bytes);
        } catch (error) {
          failures.push(error);
          restorationFailed = true;
          BatchWorkspace.retain("LSP selector restoration failed after close");
        }
      if (restorationFailed) break;
    } else {
      BatchWorkspace.retain(
        "LSP selector native close unresolved; inputs retained",
      );
      failures.push(new Error("LSP selection close remained unresolved"));
      break;
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "LSP terminal selection corpus");
}
