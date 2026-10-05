import fs from "node:fs";
import path from "node:path";

import { test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes } from "../features/ttsc/native-plugins/server/test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Preserve terminal plugin-selection transitions on one upfront island.
 *
 * @evidence contracts/testing.md#behavioral-verification The original body requires actual selection notifications and native sentinel exit1 for adding/removing configured plugins and adding an automatically discovered dependency; the intermediate server must publish its real no-var diagnostic.
 * @evidence contracts/testing.md#independent-expectations Authored var source, configured no-var rule and original literal diagnostic/sentinel establish selection before and after each mutation, not a fingerprint or synthetic event.
 * @evidence contracts/testing.md#distinguishing-cases Initially plugin-free addition, configured removal and manifest dependency discovery have separate actual starting selections and terminal outcomes.
 * @evidence contracts/testing.md#execution-ownership Selected LSP joins this independent corpus beside its ordinary editor body. This body owns three additional actual launcher/native sessions, with no per-transition fixture or install.
 * @evidence contracts/e2e.md#necessary-boundary Native editor watched notifications, plugin selection and intentional process termination must agree; pure source selection units cannot establish the close connection.
 * @evidence contracts/e2e.md#shared-execution All terminal lifetimes use the same upfront tools/lsp-selection root, source, lint producer and cache. A session that intentionally exits cannot also witness its next initially distinct selection, so these three lifetimes are irreducible for their outcomes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The original body joins each native selection close before the next mutation. Original config/manifest bytes restore only after its supported close callback; an unresolved close retains inputs and cache. Body errors remain failures even after successful cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Connects all original valid three terminal selection cases and intervening positive lint publication. Plugin Go-source and descriptor edit terminal cases remain separate unproved coverage. Native preparation and descendant totals are unmeasured.
 */
export async function lspSelectionCorpus(workspace: BatchWorkspace.Workspace): Promise<void> {
  const root = path.join(workspace.root, "tools/lsp-selection");
  const originals = new Map(["tsconfig.json", "package.json"].map((name) => [path.join(root, name), fs.readFileSync(path.join(root, name))]));
  const failures: unknown[] = [];
  let closed = false;
  try {
    await test_ttscserver_ends_the_session_when_what_selects_its_plugins_changes({
      root, cache: workspace.cache, retain: BatchWorkspace.retain,
      closed: () => { closed = true; },
    });
  } catch (error) { failures.push(error); }
  if (closed) {
    for (const [file, bytes] of originals)
      try { fs.writeFileSync(file, bytes); }
      catch (error) { failures.push(error); BatchWorkspace.retain("LSP selector restoration failed after close"); }
  } else {
    BatchWorkspace.retain("LSP selector native close unresolved; inputs retained");
    failures.push(new Error("LSP selection close remained unresolved"));
  }
  if (failures.length) throw new AggregateError(failures, "LSP terminal selection corpus");
}
