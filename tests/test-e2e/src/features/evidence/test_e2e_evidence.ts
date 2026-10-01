import { GoBoundary } from "../../internal/GoBoundary";
import { Scenarios } from "../../internal/Scenarios";
import { withEvidenceProject } from "../../../../utils/src/evidence/withEvidenceProject";
import { TransitionProject } from "../../internal/evidence/internal/TransitionProject";
import { case_evidence_consumer_batch_accepts_complete_graphs } from "./scenes/case_evidence_consumer_batch_accepts_complete_graphs";
import { case_evidence_file_links_resolve_from_markdown_and_typescript } from "./scenes/case_evidence_file_links_resolve_from_markdown_and_typescript";
import { case_evidence_file_rules_share_one_consumer_check } from "./scenes/case_evidence_file_rules_share_one_consumer_check";
import { case_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session } from "./scenes/case_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session";
import { case_evidence_graph_refreshes_changed_sources } from "./scenes/case_evidence_graph_refreshes_changed_sources";
import { case_evidence_graph_severity_controls_exit_status } from "./scenes/case_evidence_graph_severity_controls_exit_status";
import { case_evidence_positive_watch_consumers_share_one_watcher } from "./scenes/case_evidence_positive_watch_consumers_share_one_watcher";

/**
 * Verifies the @ttsc/evidence package through its real consumer boundaries.
 *
 * Four scenarios rewrite sources, documents and lint configuration between real
 * `ttsc check` runs or one resident graph session. They share one linked
 * consumer: each enters it by replacing only its own authored inputs, then
 * observes its own transitions. Three larger scenarios keep their own consumers
 * because they hold a fixed authored source population that must not be
 * disturbed by transitions (the positive batch, the file-rule batch and the
 * watcher batch). Every scenario reaches its own verdict.
 *
 * 1. Open the shared consumer and run the severity, source-refresh, file-link and
 *    resident-document scenarios against it, then release it.
 * 2. Run the positive consumer batch, the file-rule batch and the watcher batch.
 * 3. Report every failed scenario by name.
 *
 * @evidence contracts/testing.md#behavioral-verification Each scenario runs the real ttsc check, resident graph session or native watcher and asserts exit status, diagnostics or graph content; this entry only orders them and aggregates failures.
 * @evidence contracts/testing.md#independent-expectations Expectations come from authored severities, headings, member names and consumer sources stated in each scenario, not from the Evidence implementation.
 * @evidence contracts/testing.md#distinguishing-cases Severity inheritance, inventory refresh after renames, file-qualified links, resident document edits, complete-graph acceptance, file rules and watched transitions are distinct decisions; each scenario carries its own negative controls.
 * @evidence contracts/testing.md#execution-ownership Exact named package-owned Go connections additionally execute through GoBoundary with the e2e tag; missing execution fails and capability skips establish no coverage. test_e2e_evidence is the discoverable entry of the single test-e2e module; its scenarios are exported case functions selected by the same Evidence claim.
 * @evidence contracts/e2e.md#necessary-boundary The packaged contributor, the lint sidecar, the launcher and the resident native producer meet only in real runs; each scenario states which connection it proves.
 * @evidence contracts/e2e.md#shared-execution The selected Go connection cases share one actual count=1 Go test process. The severity, source-refresh, file-link and resident-document scenarios formerly linked four consumers and now link one, with the same twelve real checks and one resident session, since each transition must be seen by a fresh compiler invocation. The three larger batches already shared one consumer each and keep them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared consumer is released through withEvidenceProject after the four scenarios, which refuse removal while any native child may still hold it; each scenario's entry resets src, docs and the sibling api directory before installing its inputs. Larger batches own and release their own consumers.
 * @evidence contracts/e2e.md#preserved-coverage Every assertion of the seven former entries is retained in its scenario with unchanged inputs and messages.
 */
export async function test_e2e_evidence(): Promise<void> {
  await Scenarios.collect("evidence", [
      ["native_parser_bridges", () => GoBoundary.run("evidence", "./native", [
      "TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel",
      "TestAnExclusionInASharedFileIsPlacedByEveryNameThatReadsIt",
      "TestADiagnosticForASharedSchemaNamesTheSetsSpelling",
      "TestAPrismaDigestFollowsTheDeclaration",
      "TestASchemaHardLinkedInsideOnePopulationIsCitedOnce",
      "TestASwaggerOperationDigestFollowsTheSchemasItNames",
      "TestFirstSelectedPrismaModelActivatesCoverage",
      "TestOneSchemaHardLinkedIntoTwoRootsIsParsedOnce",
      "TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce",
      "TestPrismaBridgeCarriesDocComments",
      "TestPrismaBridgeClassifiesColumnsAndRelations",
      "TestPrismaBridgeRejectsAnInvalidSchemaWithItsLocation",
      "TestPrismaBridgeReportsNoDigestForAnUnreadableSet",
      "TestPrismaBridgeReportsTheNativeDigest",
      "TestPrismaBridgeReturnsAViewAsAModel",
      "TestPrismaClaimHostsParticipateInReferencePolicyCounts",
      "TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive",
      "TestPrismaClassifiesEveryRelationSpelling",
      "TestPrismaDuplicateModelAcrossTheSetIsRejected",
      "TestPrismaEnumMaterializesNoUnit",
      "TestPrismaHiddenModelsLeaveTheGraphPopulation",
      "TestPrismaImplicitManyToManyMaterializesRelationsOnly",
      "TestPrismaLoaderMaterializesALocatedPopulation",
      "TestPrismaLoaderReportsAnUnparseableSchema",
      "TestRequireReviewMatchesAPrismaFileLevelExclusion",
      "TestSwaggerBridgeAnswersEverySourceInOneRequest",
      "TestSwaggerBridgeReportsADigestForARejectedDocument",
      "TestSwaggerBridgeReportsNoDigestForAnUnreadableDocument",
      "TestSwaggerBridgeReportsTheNativeDigest",
      "TestTwoClaimsOverOneSharedSchemaEachOweTheirOwnReference",
      "TestTwoRootsDifferingOnlyInCaseReachOneSchema",
      "TestTwoRootsNamingTwoSchemasKeepBothInTheSet",
    ])],
    ["transitions", async () => {
      const project = TransitionProject.open();
      const failures: Error[] = [];
      try {
        await Scenarios.collect("evidence transitions", [
          ["graph_severity_controls_exit_status", () => case_evidence_graph_severity_controls_exit_status(project)],
          ["graph_refreshes_changed_sources", () => case_evidence_graph_refreshes_changed_sources(project)],
          ["file_links_resolve_from_markdown_and_typescript", () => case_evidence_file_links_resolve_from_markdown_and_typescript(project)],
          ["graph_refreshes_a_document_edit_in_a_resident_graph_session", () => case_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session(project)],
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
      if (failures.length > 1) throw new AggregateError(failures, "Evidence transitions and cleanup failed.");
    }],
    ["consumer_batch_accepts_complete_graphs", case_evidence_consumer_batch_accepts_complete_graphs],
    ["file_rules_share_one_consumer_check", case_evidence_file_rules_share_one_consumer_check],
    ["positive_watch_consumers_share_one_watcher", case_evidence_positive_watch_consumers_share_one_watcher],
  ]);
}
