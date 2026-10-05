import fs from "node:fs";
import path from "node:path";

import { test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes } from "../features/ttsc/native-plugins/server/test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes";
import { test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes } from "../features/ttsc/native-plugins/server/test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Preserve terminal plugin-selection transitions on one upfront island.
 *
 * @evidence contracts/testing.md#behavioral-verification Original bodies require actual selection notifications and native sentinel exit1 for adding/removing configured plugins, adding an automatically discovered dependency and changing copied Go source/descriptor. The intermediate configured server must publish real no-var, and the next source-edit server must publish the exact edited native rule message.
 * @evidence contracts/testing.md#independent-expectations Authored var source, configured no-var rule and original literal diagnostic/sentinel establish selection before and after each mutation, not a fingerprint or synthetic event.
 * @evidence contracts/testing.md#distinguishing-cases Initially plugin-free addition, configured removal, manifest dependency discovery, real edited Go diagnostic and descriptor-only mutation have separate actual starting selections and terminal outcomes.
 * @evidence contracts/testing.md#execution-ownership Selected LSP joins this independent corpus beside its ordinary editor body. This body owns five additional actual launcher/native sessions, with no per-transition fixture or install.
 * @evidence contracts/e2e.md#necessary-boundary Native editor watched notifications, plugin selection and intentional process termination must agree; pure source selection units cannot establish the close connection.
 * @evidence contracts/e2e.md#shared-execution All terminal lifetimes use the same upfront tools/lsp-selection root, one copied owning lint producer and cache. A session that intentionally exits cannot also witness its next initially distinct selection, so these five lifetimes are irreducible for their outcomes. Go objects and immutable copy population are prepared once, not per session.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The original body joins each native selection close before the next mutation. Original config/manifest bytes restore only after its supported close callback; an unresolved close retains inputs and cache. Body errors remain failures even after successful cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Connects all five original terminal config/dependency/source/descriptor cases, intervening positive lint publication and real recompiled edited-rule message. Native preparation and descendant totals are unmeasured; source edits change only the owning package copy and restore after close.
 */
export async function lspSelectionCorpus(workspace: BatchWorkspace.Workspace): Promise<void> {
  const root = path.join(workspace.root, "tools/lsp-selection");
  const copy = path.join(workspace.root, "tools/mutable-lint-producer");
  const originals = new Map([path.join(root, "tsconfig.json"), path.join(root, "package.json"), path.join(copy, "linthost/rules_var.go"), path.join(copy, "lib/index.js")].map((file) => [file, fs.readFileSync(file)]));
  const failures: unknown[] = [];
  for (const run of [test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes, test_ttscserver_ends_the_session_when_a_plugin_source_or_descriptor_changes]) {
  let closed = false;
  try {
    await run({ root, copy, cache: workspace.cache, retain: BatchWorkspace.retain,
      closed: () => { closed = true; }, });
  } catch (error) { failures.push(error); }
  if (closed) {
    let restorationFailed = false;
    for (const [file, bytes] of originals)
      try { fs.writeFileSync(file, bytes); }
      catch (error) { failures.push(error); restorationFailed = true; BatchWorkspace.retain("LSP selector restoration failed after close"); }
    if (restorationFailed) break;
  } else {
    BatchWorkspace.retain("LSP selector native close unresolved; inputs retained");
    failures.push(new Error("LSP selection close remained unresolved"));
    break;
  }
  }
  if (failures.length) throw new AggregateError(failures, "LSP terminal selection corpus");
}
