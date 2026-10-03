import { withEvidenceProject } from "../../../utils/src/evidence/withEvidenceProject";
import { Scenarios } from "../internal/Scenarios";
import { TransitionProject } from "../internal/evidence/internal/TransitionProject";
import { case_evidence_consumer_batch_accepts_complete_graphs } from "./evidence/scenes/case_evidence_consumer_batch_accepts_complete_graphs";
import { case_evidence_file_links_resolve_from_markdown_and_typescript } from "./evidence/scenes/case_evidence_file_links_resolve_from_markdown_and_typescript";
import { case_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session } from "./evidence/scenes/case_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session";
import { case_evidence_graph_refreshes_changed_sources } from "./evidence/scenes/case_evidence_graph_refreshes_changed_sources";
import { case_evidence_graph_severity_controls_exit_status } from "./evidence/scenes/case_evidence_graph_severity_controls_exit_status";
import { case_evidence_positive_watch_consumers_share_one_watcher } from "./evidence/scenes/case_evidence_positive_watch_consumers_share_one_watcher";

/**
 * Verifies the @ttsc/evidence package through its real consumer boundaries.
 *
 * Four scenarios rewrite sources, documents and lint configuration between real
 * `ttsc check` runs or one resident graph session. They share one linked
 * consumer: each enters it by replacing only its own authored inputs, then
 * observes its own transitions. The combined positive/file-rule/negative corpus
 * owns one fixed consumer, while the watcher batch owns its
 * transition-sensitive consumer. Every scenario reaches its own verdict.
 *
 * 1. Open the shared consumer and run the severity, source-refresh, file-link and
 *    resident-document scenarios against it, then release it.
 * 2. Run the combined positive/file-rule/negative consumer and the watcher batch.
 * 3. Report every failed scenario by name.
 *
 * @evidence contracts/testing.md#behavioral-verification Each scenario runs the real ttsc check, resident graph session or native watcher and asserts exit status, diagnostics or graph content; this entry only orders them and aggregates failures.
 * @evidence contracts/testing.md#independent-expectations Expectations come from authored severities, headings, member names and consumer sources stated in each scenario, not from the Evidence implementation.
 * @evidence contracts/testing.md#distinguishing-cases Severity inheritance, inventory refresh after renames, file-qualified links, resident document edits, complete-graph acceptance, file rules and watched transitions are distinct decisions; each scenario carries its own negative controls.
 * @evidence contracts/testing.md#execution-ownership This named entry invokes four transition scenes and the separate combined consumer and watcher entries through Scenarios.collect; it owns ordering and primary/cleanup failure aggregation, not their individual oracles. Existing Go bridge donors can still start Node loaders, so their location does not establish in-process-only execution or completed transfer.
 * @evidence contracts/e2e.md#necessary-boundary Linked contributor, lint sidecar, launcher and resident native producers remain the actual scene connections; the wrapper adds no independent installed-artifact proof. Each scene records its own boundary and source-unit complements.
 * @evidence contracts/e2e.md#shared-execution Four transition scenes share one linked consumer; the combined corpus retains its own authored project/options. A prepared immutable consumer borrows the same module tree for both and leaves the destructive live producer watcher to the explicit Watch family; default legacy calls still run all three groups. Sharing a root, PID or cold-load telemetry does not establish one Program object, internal child totals or cache hits. Actual generation/construction observations remain separate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TransitionProject.enter checks recorded unresolved-reader admission before resetting src/docs/api and configuration. withEvidenceProject calls cleanup after collection, retaining both primary and cleanup errors; cleanup refuses recorded unknown ownership. This is not omniscient proof that every possible descendant closed. Other entries own their separate cleanup and reuse gates.
 * @evidence contracts/e2e.md#preserved-coverage All six scene bodies and their individual assertions remain. Default calls preserve their order; the prepared common consumer runs transitions and the combined corpus, while the explicit Watch entry runs the positive watcher. Existing loader donors and exact direct counterparts remain recorded separately with authored versus executed ownership distinguished; no unchanged-body relocation or runtime survival is certified by this wrapper. Meaningful duplicate removal still requires actual survivor execution.
 */
export async function test_e2e_evidence(preparation: { preparedModules?: string; workspaceParent?: string; includeWatch?: boolean } = {}): Promise<void> {
  await Scenarios.collect("evidence", [
    [
      "transitions",
      async () => {
        const project = TransitionProject.open(preparation);
        const failures: Error[] = [];
        try {
          await Scenarios.collect("evidence transitions", [
            [
              "graph_severity_controls_exit_status",
              () => case_evidence_graph_severity_controls_exit_status(project),
            ],
            [
              "graph_refreshes_changed_sources",
              () => case_evidence_graph_refreshes_changed_sources(project),
            ],
            [
              "file_links_resolve_from_markdown_and_typescript",
              () =>
                case_evidence_file_links_resolve_from_markdown_and_typescript(
                  project,
                ),
            ],
            [
              "graph_refreshes_a_document_edit_in_a_resident_graph_session",
              () =>
                case_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session(
                  project,
                ),
            ],
          ]);
        } catch (error) {
          failures.push(error as Error);
        }
        try {
          withEvidenceProject(project, () => undefined);
        } catch (error) {
          failures.push(error as Error);
        }
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1)
          throw new AggregateError(
            failures,
            "Evidence transitions and cleanup failed.",
          );
      },
    ],
    [
      "consumer_batch_accepts_complete_graphs",
      () => case_evidence_consumer_batch_accepts_complete_graphs(preparation),
    ],
    ...(preparation.includeWatch === false ? [] : [[
      "positive_watch_consumers_share_one_watcher",
      case_evidence_positive_watch_consumers_share_one_watcher,
    ] as const]),
  ]);
}
