import { FixtureFiles } from "../../FixtureFiles";
import assert from "node:assert/strict";

import type { ICreateProjectProps } from "../../../../../utils/src/evidence/ICreateProjectProps";
import type { IRunResult } from "../../../../../utils/src/evidence/IRunResult";
import {
  assertExcludes,
  assertFailure,
  assertIncludes,
  assertStatus,
} from "./index";

/**
 * Keeps thirty-two authored immutable consumer variants and their original assertion
 * callbacks.
 *
 * Each entry names its original feature owner. The success consumer and error
 * batch transport these original settings, files and literal expectations to
 * disjoint physical roots; callbacks execute only after an actual compiler
 * run.
 *
 * @evidence contracts/common.md#principled-implementation Original authored source/config bytes and literal assertions remain maintained executable fixtures, with entry names recording their previous owners. Compiler outcomes are supplied only by actual batch entries.
 * @evidence contracts/common.md#clear-and-simple-design One typed table couples each scene's original inputs to its callback; assembly and compiler lifetime belong to ConsumerBatch and its selected E2E caller.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Callback assertions retain actual shared command status and genuinely emitted diagnostic text. Physical-location expectations alone move with a fixture; no product diagnostic or verdict is rewritten.
 * @evidence contracts/common.md#meaningful-documentation Records the thirty-two-variant transport, original ownership map and the distinction between maintained literal expectations and real compiler observations.
 */
export const consumerCases: readonly IConsumerCase[] = [
  {
    /**
     * Verifies swagger outside.
     *
     * The document genuinely sits above the project; swagger-file supplies the local-path counterpart.
     *
     * 1. Sibling contracts/swagger.yaml declares POST:/members, cited by IMemberCreation.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 and no Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Sibling contracts/swagger.yaml declares POST:/members, cited by IMemberCreation. Its verify callback checks Status 0 and no Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The document genuinely sits above the project; swagger-file supplies the local-path counterpart.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The packaged Swagger normalizer must read the actual ancestor file and return its operation. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_a_swagger_document_outside_the_project",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-outside",
      lintConfig: FixtureFiles.read("evidence/swagger-outside/configuration")["lint.config.ts"]!,
      workspaceFiles: FixtureFiles.read("evidence/swagger-outside/workspace"),
      files: FixtureFiles.read("evidence/swagger-outside/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "A contract checked out beside the project must be readable by the packaged normalizer.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "The operation citation must satisfy Swagger coverage.",
        ),
      );
    },
  },
  {
    /**
     * Verifies central exclusion carriers.
     *
     * Property and file carriers cover obligations without selected model/function evidence; invalid-central-exclusion-carriers rejects malformed uses.
     *
     * 1. Five schema, controller, DTO and backend-test claims use authored central exclusion carriers.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 and no Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Five schema, controller, DTO and backend-test claims use authored central exclusion carriers. Its verify callback checks Status 0 and no Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Property and file carriers cover obligations without selected model/function evidence; invalid-central-exclusion-carriers rejects malformed uses.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Typed multi-claim options, Prisma parsing and central carrier citations cross the real contributor boundary. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_central_exclusion_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "central-exclusion-carriers",
      lintConfig: FixtureFiles.read("evidence/central-exclusion-carriers/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/central-exclusion-carriers/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "Every central carrier must cover its own claim-reference obligations.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "Valid carrier exclusions must discharge all configured obligations.",
        ),
      );
    },
  },
  {
    /**
     * Verifies invalid central exclusion carriers.
     *
     * The neighboring central-exclusion-carriers configuration proves valid carriers can pass.
     *
     * 1. Property evidence, file evidence, discarded Prisma line tags and an unresolved exclusion are placed on invalid carriers.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and the original carrier rejection, discarded citation and missing target messages.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Property evidence, file evidence, discarded Prisma line tags and an unresolved exclusion are placed on invalid carriers. Its verify callback checks Failure and the original carrier rejection, discarded citation and missing target messages.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The neighboring central-exclusion-carriers configuration proves valid carriers can pass.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Each distinct carrier finding must retain its native category through the public configuration. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_central_exclusion_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "invalid-central-exclusion-carriers",
      lintConfig: FixtureFiles.read("evidence/invalid-central-exclusion-carriers/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/invalid-central-exclusion-carriers/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "Carrier eligibility must not relax ownership or Prisma comment syntax.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Out-of-scope @evidence host",
          "TypeScript ownership evidence must remain on the selected symbol kind.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "only @evidenceExclude may be unattached at file level",
          "A Prisma file carrier must reject ownership evidence.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "'//' line comment",
          "A discarded Prisma comment must remain invalid.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Unresolved evidence target 'docs/schema.md#missing'",
          "A file carrier must retain exact target resolution.",
        ),
      );
    },
  },
  {
    /**
     * Verifies overlapping prisma claims.
     *
     * Overlapping type/property populations must discharge their own model/column obligations.
     *
     * 1. Sale type and Sale.id property cite the same Prisma model and column through separate DTO claims.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Sale type and Sale.id property cite the same Prisma model and column through separate DTO claims. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Overlapping type/property populations must discharge their own model/column obligations.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Two claim scopes and parsed Prisma members must connect to TypeScript declarations in one actual config. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_overlapping_type_and_property_claims",
    props: {
      nativeProducer: "snapshot",
      name: "overlapping-prisma-claims",
      lintConfig: FixtureFiles.read("evidence/overlapping-prisma-claims/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/overlapping-prisma-claims/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "Overlapping files must be attributed by eligible host instead of rejected by the neighboring claim.",
        ),
      );
    },
  },
  {
    /**
     * Verifies swagger file.
     *
     * Local exact-file selection complements the sibling-file and HTTP operations.
     *
     * 1. Local api/swagger.yaml declares POST:/members, cited by IMemberCreation.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 and no Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Local api/swagger.yaml declares POST:/members, cited by IMemberCreation. Its verify callback checks Status 0 and no Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Local exact-file selection complements the sibling-file and HTTP operations.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The installed normalizer must parse the authored local YAML rather than an assumed operation list. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_swagger_file_reference",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-file",
      lintConfig: FixtureFiles.read("evidence/swagger-file/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/swagger-file/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "The packaged Node normalizer must upgrade a local Swagger YAML document for the native rule.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "The operation citation must satisfy Swagger coverage.",
        ),
      );
    },
  },
  {
    /**
     * Verifies typed config.
     *
     * The selected config module retains satisfies ITtscLintConfig and the public named plugin export.
     *
     * 1. ITtscEvidenceGraphConfig selects createOrder against the explicit Create Order Markdown anchor.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 and no Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): ITtscEvidenceGraphConfig selects createOrder against the explicit Create Order Markdown anchor. Its verify callback checks Status 0 and no Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The selected config module retains satisfies ITtscLintConfig and the public named plugin export.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Public declaration types, option serialization and native function-to-heading coverage must agree. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_typed_consumer_config",
    props: {
      nativeProducer: "snapshot",
      name: "typed-config",
      lintConfig: FixtureFiles.read("evidence/typed-config/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/typed-config/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "The package's exact exported config types and plugin object must work in a consumer lint.config.ts.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "An exported arrow-function const is a selected function host.",
        ),
      );
    },
  },
  {
    /**
     * Verifies selected hosts inactive.
     *
     * Selected-hosts-active supplies the same three host kinds with actual selected units.
     *
     * 1. Matched TypeScript, Markdown and Prisma files contain no selected callable, h2 or model; their references name missing roots.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Matched TypeScript, Markdown and Prisma files contain no selected callable, h2 or model; their references name missing roots. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Selected-hosts-active supplies the same three host kinds with actual selected units.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Zero-host activation must avoid loading nonexistent reference populations through the actual contributor. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_activates_only_selected_claim_hosts",
    props: {
      nativeProducer: "snapshot",
      name: "selected-hosts-inactive",
      lintConfig: FixtureFiles.read("evidence/selected-hosts-inactive/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/selected-hosts-inactive/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "All three claims have matched files but zero selected hosts.",
        ),
      );
    },
  },
  {
    /**
     * Verifies selected hosts active.
     *
     * The inactive counterpart has matched files but no selected hosts.
     *
     * 1. Callable run, heading Claim and Prisma contract model activate three original claims.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 2, exactly two Requirement missing findings and exactly one prisma:contract missing finding.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Callable run, heading Claim and Prisma contract model activate three original claims. Its verify callback checks Status 2, exactly two Requirement missing findings and exactly one prisma:contract missing finding.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The inactive counterpart has matched files but no selected hosts.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Native claim activation and per-population diagnostic cardinality must survive actual configuration transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_activates_only_selected_claim_hosts",
    props: {
      nativeProducer: "snapshot",
      name: "selected-hosts-active",
      lintConfig: FixtureFiles.read("evidence/selected-hosts-active/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/selected-hosts-active/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          2,
          "The selected callable, heading, and model must activate coverage.",
        ),
      );
      check(() =>
        assert.equal(
          (
            result.output.match(
              /Missing acknowledgement for 'docs\/reference\.md#requirement'/gu,
            ) ?? []
          ).length,
          2,
          "The TypeScript and Prisma claims must each evaluate Markdown coverage.",
        ),
      );
      check(() =>
        assert.equal(
          (
            result.output.match(
              /Missing acknowledgement for 'prisma:contract'/gu,
            ) ?? []
          ).length,
          1,
          "The Markdown claim must evaluate Prisma coverage exactly once.",
        ),
      );
    },
  },
  {
    /**
     * Verifies prisma graph.
     *
     * Model-level citations must discharge the selected columns and relations beneath them.
     *
     * 1. Sale cites Pricing, Seller excludes Sellers and ISale cites both parsed models.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 and no Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Sale cites Pricing, Seller excludes Sellers and ISale cites both parsed models. Its verify callback checks Status 0 and no Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Model-level citations must discharge the selected columns and relations beneath them.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Parsed schema documentation and TypeScript-to-Prisma references must connect in both graph directions. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_binds_a_prisma_schema_to_requirements",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-graph",
      lintConfig: FixtureFiles.read("evidence/prisma-graph/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/prisma-graph/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "A schema that cites its requirements and is cited in turn must pass.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "A model citation discharges the columns and relations it contains.",
        ),
      );
    },
  },
  {
    /**
     * Verifies hierarchical targets.
     *
     * Selected h2/h3 and function/property descendants are covered by unselected resolvable ancestors.
     *
     * 1. Implementation namespace cites the whole specification; ILedger cites the namespace ancestor.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0, no Unresolved evidence target and no Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Implementation namespace cites the whole specification; ILedger cites the namespace ancestor. Its verify callback checks Status 0, no Unresolved evidence target and no Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Selected h2/h3 and function/property descendants are covered by unselected resolvable ancestors.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Native hierarchy expansion must receive the original Markdown and TypeScript ancestor references. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_cascades_hierarchical_targets",
    props: {
      nativeProducer: "snapshot",
      name: "hierarchical-targets",
      lintConfig: FixtureFiles.read("evidence/hierarchical-targets/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/hierarchical-targets/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "Ancestor targets must satisfy selected descendant obligations through the packaged contributor.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Unresolved evidence target",
          "Both unselected ancestors must remain resolvable citation scopes.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "Both descendant populations must be covered by their ancestors.",
        ),
      );
    },
  },
  {
    /**
     * Verifies class units.
     *
     * The deliberately uncited section prevents a silent or inactive class/property graph passing.
     *
     * 1. Sale class and public price field cite their sections while Uncited remains uncovered.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and Uncited missing finding, with Sale and Price findings absent.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Sale class and public price field cite their sections while Uncited remains uncovered. Its verify callback checks Failure and Uncited missing finding, with Sale and Price findings absent.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The deliberately uncited section prevents a silent or inactive class/property graph passing.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler declaration identities must reach native type/property claims and diagnostic transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_cites_a_class_and_its_members",
    props: {
      nativeProducer: "snapshot",
      name: "class-units",
      lintConfig: FixtureFiles.read("evidence/class-units/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/class-units/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "The uncited section must keep the build red, which is what proves the claims ran.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Missing acknowledgement for 'docs/fields.md#uncited'",
          "The section nobody cites is the one the build must name.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "docs/subject.md#sale",
          "A class must be able to answer for the section describing the subject.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "docs/fields.md#price",
          "A public field must be able to answer for the section fixing it.",
        ),
      );
    },
  },
  {
    /**
     * Verifies composed graph.
     *
     * Mixed Markdown/TypeScript references, an exclusion and TSX imports require the preserved jsx setting.
     *
     * 1. Requirements, analysis, architecture, TSX components and feature tests compose four original claims.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 and no Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Requirements, analysis, architecture, TSX components and feature tests compose four original claims. Its verify callback checks Status 0 and no Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Mixed Markdown/TypeScript references, an exclusion and TSX imports require the preserved jsx setting.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): All authored multi-claim fields and TSX source membership must cross the actual compiler/config connection. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_composes_multi_claim_graphs",
    props: {
      nativeProducer: "snapshot",
      name: "composed-graph",
      compilerOptions: {
        jsx: "preserve",
      },
      lintConfig: FixtureFiles.read("evidence/composed-graph/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/composed-graph/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "A composed graph of markdown and typescript claims, including one reference array, must pass when every claim acknowledges its evidence.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "Every claim acknowledged its own evidence, one via @evidenceExclude.",
        ),
      );
    },
  },
  {
    /**
     * Verifies prisma carrier confined.
     *
     * Prisma-carrier-misplaced changes only eligible carrier placement and retains failure.
     *
     * 1. A sibling sales model cites Stored while its declared schema exclusion carrier discharges Deferred.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0, no Missing acknowledgement and no Misplaced @evidenceExclude.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): A sibling sales model cites Stored while its declared schema exclusion carrier discharges Deferred. Its verify callback checks Status 0, no Missing acknowledgement and no Misplaced @evidenceExclude.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Prisma-carrier-misplaced changes only eligible carrier placement and retains failure.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Rooted schema files and carrier globs must resolve against the same actual ancestor base. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_confines_prisma_and_rooted_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-carrier-confined",
      lintConfig: FixtureFiles.read("evidence/prisma-carrier-confined/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/prisma-carrier-confined/project"),
      workspaceFiles: FixtureFiles.read("evidence/prisma-carrier-confined/workspace"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "A Prisma exclusion inside its declared carrier must remain eligible.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "A confined Prisma exclusion must still discharge the section it names.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Misplaced @evidenceExclude",
          "A rooted carrier holding its own exclusion must draw no placement repair.",
        ),
      );
    },
  },
  {
    /**
     * Verifies prisma carrier misplaced.
     *
     * The confined counterpart uses the same rooted Prisma/Markdown contract successfully.
     *
     * 1. The sales model takes Deferred's exclusion out of its declared sibling schema carrier.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure, Misplaced @evidenceExclude, the literal schema/exclude.schema repair and Missing acknowledgement.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The sales model takes Deferred's exclusion out of its declared sibling schema carrier. Its verify callback checks Failure, Misplaced @evidenceExclude, the literal schema/exclude.schema repair and Missing acknowledgement.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The confined counterpart uses the same rooted Prisma/Markdown contract successfully.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Rooted carrier eligibility and refusal to grant coverage must survive actual native option transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_confines_prisma_and_rooted_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-carrier-misplaced",
      lintConfig: FixtureFiles.read("evidence/prisma-carrier-misplaced/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/prisma-carrier-misplaced/project"),
      workspaceFiles: FixtureFiles.read("evidence/prisma-carrier-misplaced/workspace"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "A Prisma exclusion outside its declared carrier must fail the build.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Misplaced @evidenceExclude",
          "The finding must read as a placement error, not a resolution failure.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "'schema/exclude.schema'",
          "The repair must name the carrier as the claim's own root spells it.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Missing acknowledgement",
          "A refused Prisma exclusion must grant no coverage, leaving its target owed.",
        ),
      );
    },
  },
  {
    /**
     * Verifies markdown checklist rejected.
     *
     * Markdown-checklist-accepted answers both items separately on each host.
     *
     * 1. Partial cites one of two items while broad cites the entire checklist document.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure, 1 of 2 shortfall, aggregate target refusal and Cite each item repair.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Partial cites one of two items while broad cites the entire checklist document. Its verify callback checks Failure, 1 of 2 shortfall, aggregate target refusal and Cite each item repair.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Markdown-checklist-accepted answers both items separately on each host.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The public Markdown checklist option must govern native per-host item obligations. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_a_markdown_checklist",
    props: {
      nativeProducer: "snapshot",
      name: "markdown-checklist-rejected",
      lintConfig: FixtureFiles.read("evidence/markdown-checklist-rejected/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/markdown-checklist-rejected/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "A checklist must judge every host against every item.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "has not acknowledged 1 of 2 checklist item(s)",
          "The per-host shortfall must survive the native config boundary.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Aggregate @evidence target 'docs/rules.md'",
          "A document-wide citation must not answer the items beneath it.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Cite each item this host answers for",
          "The aggregate refusal must name its repair.",
        ),
      );
    },
  },
  {
    /**
     * Verifies markdown checklist accepted.
     *
     * The rejected counterpart uses partial and aggregate citations against the same two authored items.
     *
     * 1. First cites both checklist items; second cites one and excludes the other.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): First cites both checklist items; second cites one and excludes the other. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The rejected counterpart uses partial and aggregate citations against the same two authored items.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Typed checklist true and independent per-host tags must connect to the native graph. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_a_markdown_checklist",
    props: {
      nativeProducer: "snapshot",
      name: "markdown-checklist-accepted",
      lintConfig: FixtureFiles.read("evidence/markdown-checklist-accepted/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/markdown-checklist-accepted/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "Every host answering every item must satisfy the checklist.",
        ),
      );
    },
  },
  {
    /**
     * Verifies reference policy rejected.
     *
     * Reference-policy-accepted supplies one positive host for each unit.
     *
     * 1. An exclusion faces noEvidenceExclude, uniqueEvidence and singleEvidencePerSymbol strict options.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and the three original strict-policy/coverage refusal messages.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): An exclusion faces noEvidenceExclude, uniqueEvidence and singleEvidencePerSymbol strict options. Its verify callback checks Failure and the three original strict-policy/coverage refusal messages.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Reference-policy-accepted supplies one positive host for each unit.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The shared reference-base type and strict fields must arrive unchanged at native policy evaluation. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_reference_policy",
    props: {
      nativeProducer: "snapshot",
      name: "reference-policy-rejected",
      lintConfig: FixtureFiles.read("evidence/reference-policy-rejected/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/reference-policy-rejected/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(result, "A strict reference must reject an exclusion."),
      );
      check(() =>
        assertIncludes(
          result,
          "noEvidenceExclude requires positive @evidence",
          "The refusal must survive the native config boundary.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "singleEvidencePerSymbol requires exactly 1",
          "The selected function must be counted even though it has no positive tag.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "this reference forbids @evidenceExclude",
          "A refused exclusion must leave ordinary coverage missing.",
        ),
      );
    },
  },
  {
    /**
     * Verifies reference policy accepted.
     *
     * The rejected counterpart attempts an exclusion under the same strict options.
     *
     * 1. First answers Contract and second answers Pricing under the complete strict reference policy.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): First answers Contract and second answers Pricing under the complete strict reference policy. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The rejected counterpart attempts an exclusion under the same strict options.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Public strict reference types and native per-unit positive ownership must connect. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_reference_policy",
    props: {
      nativeProducer: "snapshot",
      name: "reference-policy-accepted",
      lintConfig: FixtureFiles.read("evidence/reference-policy-accepted/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/reference-policy-accepted/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "One host per unit must satisfy the complete strict policy.",
        ),
      );
    },
  },
  {
    /**
     * Verifies prisma members.
     *
     * The literal selective citations distinguish model hierarchy coverage from incomplete Seller coverage.
     *
     * 1. ISale cites all Sale members and only Seller.id in the authored related schema.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and Missing acknowledgement for prisma:Seller.sales.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): ISale cites all Sale members and only Seller.id in the authored related schema. Its verify callback checks Failure and Missing acknowledgement for prisma:Seller.sales.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The literal selective citations distinguish model hierarchy coverage from incomplete Seller coverage.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual Node parser's model/column/relation payload must reach native obligations. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_obligates_prisma_columns_and_relations",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-members",
      lintConfig: FixtureFiles.read("evidence/prisma-members/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/prisma-members/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "A member population must keep owing the members nobody cited.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Missing acknowledgement for 'prisma:Seller.sales'",
          "The relation back-reference is a member obligation even though it carries no attribute.",
        ),
      );
    },
  },
  {
    /**
     * Verifies swagger directory.
     *
     * Swagger-outside names that document itself and succeeds.
     *
     * 1. The Swagger reference names a sibling contracts directory containing a valid YAML file.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and the original exact-file configuration refusal.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The Swagger reference names a sibling contracts directory containing a valid YAML file. Its verify callback checks Failure and the original exact-file configuration refusal.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Swagger-outside names that document itself and succeeds.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The public Swagger file channel must reject directory discovery instead of silently choosing a document. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_refuses_a_swagger_directory_reference",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-directory",
      lintConfig: FixtureFiles.read("evidence/swagger-directory/configuration")["lint.config.ts"]!,
      workspaceFiles: FixtureFiles.read("evidence/swagger-directory/workspace"),
      files: FixtureFiles.read("evidence/swagger-directory/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          2,
          "A reference that owns one document cannot be satisfied by a directory.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "names a directory rather than a document",
          "The diagnostic must name the invalid shape rather than report the document as missing.",
        ),
      );
    },
  },
  {
    /**
     * Verifies prisma line comment.
     *
     * A parsed model exists, so failure cannot be disguised as an empty schema population.
     *
     * 1. A // Prisma line comment carries the Pricing citation above Sale.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and the discarded '//' line comment diagnostic.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): A // Prisma line comment carries the Pricing citation above Sale. Its verify callback checks Failure and the discarded '//' line comment diagnostic.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): A parsed model exists, so failure cannot be disguised as an empty schema population.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The real schema/parser connection must preserve discarded comment provenance and native diagnostics. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_reports_a_discarded_prisma_citation",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-line-comment",
      lintConfig: FixtureFiles.read("evidence/prisma-line-comment/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/prisma-line-comment/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "A citation in a comment Prisma discards must fail the build.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "'//' line comment",
          "The diagnostic must name the comment form that cannot host a citation.",
        ),
      );
    },
  },
  {
    /**
     * Verifies prisma dangling.
     *
     * The schema is healthy and nonempty; an unresolved citation is distinct from a parser failure.
     *
     * 1. ISale cites existing Sale while IDiscount cites absent prisma:Discount.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and the literal prisma:Discount target.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): ISale cites existing Sale while IDiscount cites absent prisma:Discount. Its verify callback checks Failure and the literal prisma:Discount target.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The schema is healthy and nonempty; an unresolved citation is distinct from a parser failure.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual parsed schema names must connect to native target resolution and its diagnostic category. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_reports_an_uncited_prisma_model",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-dangling",
      lintConfig: FixtureFiles.read("evidence/prisma-dangling/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/prisma-dangling/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "A citation naming a model the schema does not declare must fail the build.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "prisma:Discount",
          "The diagnostic must name the target that resolves to nothing.",
        ),
      );
    },
  },
  {
    /**
     * Verifies swagger invalid.
     *
     * A refused normalizer result must remain unhealthy rather than becoming an empty successful population.
     *
     * 1. The actual local JSON declares unsupported OpenAPI 4.0.0.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure, source filename and @typia/interface OpenApi.IDocument rejection; empty-population and Missing acknowledgement findings absent.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The actual local JSON declares unsupported OpenAPI 4.0.0. Its verify callback checks Failure, source filename and @typia/interface OpenApi.IDocument rejection; empty-population and Missing acknowledgement findings absent.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): A refused normalizer result must remain unhealthy rather than becoming an empty successful population.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The real Node normalizer rejection and contract name must survive native bridge transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_reports_swagger_source_failures",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-invalid",
      lintConfig: FixtureFiles.read("evidence/swagger-invalid/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/swagger-invalid/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "An unsupported OpenAPI document must fail the evidence graph.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "api/openapi.json",
          "The normalizer diagnostic must identify the broken source.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "@typia/interface OpenApi.IDocument",
          "The diagnostic must name the normalization contract that rejected the source.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "materialized no selected evidence units",
          "A rejected source is incomplete, not a healthy empty operation set.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Missing acknowledgement",
          "Coverage cannot be derived while the reference loader is unhealthy.",
        ),
      );
    },
  },
  {
    /**
     * Verifies link import scope.
     *
     * Link-no-import removes only the questions binding while retaining the reviews import.
     *
     * 1. Question and review views import distinct namespaces that both export get.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Question and review views import distinct namespaces that both export get. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Link-no-import removes only the questions binding while retaining the reviews import.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual compiler import identity must resolve same-named functions into the correct native references. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_link_target_requires_a_real_import",
    props: {
      nativeProducer: "snapshot",
      name: "link-import-scope",
      lintConfig: FixtureFiles.read("evidence/link-import-scope/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/link-import-scope/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "Two modules exporting the same leaf name must both resolve through their own imports.",
        ),
      );
    },
  },
  {
    /**
     * Verifies link no import.
     *
     * Link-import-scope proves both actual imported namespace bindings pass.
     *
     * 1. The questions.get citation has no questions import while the reviews namespace remains imported.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and Unimported evidence target.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The questions.get citation has no questions import while the reviews namespace remains imported. Its verify callback checks Failure and Unimported evidence target.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Link-import-scope proves both actual imported namespace bindings pass.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The contributor must receive the compiler's import scope rather than resolve citations by bare spelling. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_link_target_requires_a_real_import",
    props: {
      nativeProducer: "snapshot",
      name: "link-no-import",
      lintConfig: FixtureFiles.read("evidence/link-no-import/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/link-no-import/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "A citation with no import behind it must fail the build.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Unimported evidence target",
          "The diagnostic must say the symbol is not imported, not merely unresolved.",
        ),
      );
    },
  },
  {
    /**
     * Verifies readme cite.
     *
     * Its config is outside the Program; the direct SDK citation-usage unit owns the unbraced TS6133 counterpart.
     *
     * 1. SalePrice imports sales only for its braced IShoppingSale citation.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 under noUnusedLocals true.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): SalePrice imports sales only for its braced IShoppingSale citation. Its verify callback checks Status 0 under noUnusedLocals true.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Its config is outside the Program; the direct SDK citation-usage unit owns the unbraced TS6133 counterpart.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Published citation types, actual compiler JSDoc import usage and native interface coverage must connect. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_readme_cite_example_passes",
    props: {
      nativeProducer: "snapshot",
      name: "readme-cite",
      include: ["src"],
      compilerOptions: {
        noUnusedLocals: true,
      },
      lintConfig: FixtureFiles.read("evidence/readme-cite/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/readme-cite/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "The README's inline-link citation must resolve, and its citation-only import must survive noUnusedLocals.",
        ),
      );
    },
  },
  {
    /**
     * Verifies readme configure.
     *
     * Its include list selects src without pulling the anonymous config into file rules.
     *
     * 1. The README TSX CreateOrder example enables graph, documented, singular and todo together.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The README TSX CreateOrder example enables graph, documented, singular and todo together. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Its include list selects src without pulling the anonymous config into file rules.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The documented public example must compile and register all four actual native rules together. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_readme_configure_example_passes",
    props: {
      nativeProducer: "snapshot",
      name: "readme-configure",
      include: ["src"],
      lintConfig: FixtureFiles.read("evidence/readme-configure/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/readme-configure/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "The README's opening configuration must pass on a project that satisfies it.",
        ),
      );
    },
  },
  {
    /**
     * Verifies readme markdown citation.
     *
     * This Markdown host complements the README TypeScript host examples.
     *
     * 1. A Markdown Pricing Guide cites the sibling requirement file's Sale Price anchor.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): A Markdown Pricing Guide cites the sibling requirement file's Sale Price anchor. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): This Markdown host complements the README TypeScript host examples.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): The public Markdown-to-Markdown config and file citation must reach the actual contributor. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_readme_markdown_citation_example_passes",
    props: {
      nativeProducer: "snapshot",
      name: "readme-markdown-citation",
      include: ["src"],
      lintConfig: FixtureFiles.read("evidence/readme-markdown-citation/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/readme-markdown-citation/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "The README's Markdown-to-Markdown citation must satisfy its configured obligation.",
        ),
      );
    },
  },
  {
    /**
     * Verifies package population.
     *
     * Package-population-complete adds the missing review view against identical installed bytes.
     *
     * 1. The installed @org/api declaration namespace exposes question and review get functions; only question is cited.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure, the uncited functional.reviews.get finding and both neutral acknowledgement repair alternatives.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The installed @org/api declaration namespace exposes question and review get functions; only question is cited. Its verify callback checks Failure, the uncited functional.reviews.get finding and both neutral acknowledgement repair alternatives.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Package-population-complete adds the missing review view against identical installed bytes.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual package exports/types resolution must feed native package-reference inventories. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_reference_selects_an_installed_package",
    props: {
      nativeProducer: "snapshot",
      name: "package-population",
      include: ["src"],
      lintConfig: FixtureFiles.read("evidence/package-population/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/package-population/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "An operation the project never imports must still be an obligation.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Missing acknowledgement for 'functional.reviews.get'",
          "The uncited operation must be named by its accessor path from the entry.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "with @evidence on a selected typescript host, building that artifact first when none does, or write @evidenceExclude on an eligible carrier when nothing here owes it.",
          "The repair must preserve both neutral acknowledgement options.",
        ),
      );
    },
  },
  {
    /**
     * Verifies package population complete.
     *
     * The incomplete package counterpart omits the review citation only.
     *
     * 1. Question and review views cite both accessor paths in the same installed @org/api declarations.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): Question and review views cite both accessor paths in the same installed @org/api declarations. Its verify callback checks Status 0.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): The incomplete package counterpart omits the review citation only.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Installed package declaration discovery and both namespace accessor bindings must connect. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_reference_selects_an_installed_package",
    props: {
      nativeProducer: "snapshot",
      name: "package-population-complete",
      include: ["src"],
      lintConfig: FixtureFiles.read("evidence/package-population-complete/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/package-population-complete/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "Two operations sharing a leaf name must both resolve through their accessor paths.",
        ),
      );
    },
  },
  {
    /**
     * Verifies singular config included.
     *
     * Singular-declarations excludes its config while retaining a multi-identity declaration file.
     *
     * 1. The original include list selects src and anonymous lint.config.ts with singular enabled.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Failure and An anonymous default export has no name.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): The original include list selects src and anonymous lint.config.ts with singular enabled. Its verify callback checks Failure and An anonymous default export has no name.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Singular-declarations excludes its config while retaining a multi-identity declaration file.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual Program config membership must reach the native anonymous-default branch. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_singular_reports_included_config_file",
    props: {
      nativeProducer: "snapshot",
      name: "singular-config-included",
      include: ["src", "lint.config.ts"],
      lintConfig: FixtureFiles.read("evidence/singular-config-included/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/singular-config-included/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "An anonymous default is reported wherever it is, including in a config file the project includes.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "An anonymous default export has no name",
          "The config file must be reported by the anonymous-default branch, not by a name mismatch.",
        ),
      );
    },
  },
  {
    /**
     * Verifies singular declarations.
     *
     * Singular-config-included supplies the anonymous included-config refusal.
     *
     * 1. A multi-interface ambient.d.ts and named handler are selected while the config is excluded.
     * 2. Observe this scene through its public config and actual native check request.
     * 3. Its verify callback checks Status 0 and no evidence/singular finding.
     *
     * Behavioral verification (contracts/testing.md#behavioral-verification): A multi-interface ambient.d.ts and named handler are selected while the config is excluded. Its verify callback checks Status 0 and no evidence/singular finding.
     * Independent expectations (contracts/testing.md#independent-expectations): The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * Distinguishing cases (contracts/testing.md#distinguishing-cases): Singular-config-included supplies the anonymous included-config refusal.
     * Execution ownership (contracts/testing.md#execution-ownership): test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * Necessary boundary (contracts/e2e.md#necessary-boundary): Actual declaration-file identity and original include membership must govern native file-rule exclusion. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * Shared execution (contracts/e2e.md#shared-execution): Its caller shares one fixture and captured contributor producer across default, JSX and noUnusedLocals compiler families. Different authored options require three actual joined host lifetimes; this scene reuses its family Program when subsequent requests have identical actual producer tuples, and singleton families own their initial real response.
     * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Disjoint scene roots and one active original graph separate aliases and schemas. Original include patterns select only this compiler family before its Program starts; other families retain their source bytes outside that corpus. The prior host is joined before options or include membership change. Actual changed executable bytes/manifest/context retire the host, and the caller joins closure before cleanup.
     * Preserved coverage (contracts/e2e.md#preserved-coverage): The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_singular_skips_declaration_files",
    props: {
      nativeProducer: "snapshot",
      name: "singular-declarations",
      include: ["src"],
      lintConfig: FixtureFiles.read("evidence/singular-declarations/configuration")["lint.config.ts"]!,
      files: FixtureFiles.read("evidence/singular-declarations/project"),
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "A declaration file must not be visited by evidence/singular.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "evidence/singular",
          "No finding may come from a declaration file.",
        ),
      );
    },
  },
];

interface IConsumerCase {
  readonly entry: string;
  readonly props: ICreateProjectProps;
  readonly verify: (
    result: IRunResult,
    check: (assertion: () => void) => void,
    location: (original: string) => string,
  ) => void;
}
