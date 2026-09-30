import assert from "node:assert/strict";

import type { ICreateProjectProps } from "./ICreateProjectProps";
import type { IRunResult } from "./IRunResult";
import {
  assertExcludes,
  assertFailure,
  assertIncludes,
  assertStatus,
} from "./index";

/**
 * Keeps forty authored immutable consumer variants and their original assertion
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
 * @evidence contracts/common.md#meaningful-documentation Records the forty-variant transport, original ownership map and the distinction between maintained literal expectations and real compiler observations.
 */
export const consumerCases: readonly IConsumerCase[] = [
  {
    /**
     * Documented-config-owner.
     *
     * @evidence contracts/testing.md#behavioral-verification Misspelled documented option symbols alongside a valid Contract graph. Its verify callback checks Failure, exactly one Invalid evidence/documented configuration and no graph configuration error.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The include list excludes its config; valid JSDoc exports distinguish option rejection from missing documentation.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The documented option and rule identity cross the public config/native diagnostic boundary. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_documented_configuration_names_its_own_rule",
    props: {
      nativeProducer: "snapshot",
      name: "documented-config-owner",
      include: ["src"],
      lintConfig:
        'import { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", { claims: [{\n      type: "typescript",\n      files: ["src/claim.ts"],\n      symbol: "type",\n      reference: { type: "markdown", files: ["docs/spec.md"], symbol: "h2" },\n    }] }],\n    "evidence/documented": ["error", { symbols: "type" }],\n  },\n};\n',
      files: {
        "docs/spec.md": "## Contract\n",
        "src/claim.ts":
          "/**\n * Claim.\n * @evidence docs/spec.md#contract Implements this contract.\n */\nexport interface Claim {}\n",
        "src/alpha.ts": "/** Alpha. */\nexport const alpha = 1;\n",
        "src/beta.ts": "/** Beta. */\nexport const beta = 2;\n",
      },
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "A misspelled option key must fail the build rather than fall back to a default selection.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Invalid evidence/documented configuration",
          "The diagnostic must name the rule whose setting is actually wrong.",
        ),
      );
      const occurrences: number =
        result.output.split("Invalid evidence/documented configuration")
          .length - 1;
      check(() => {
        if (occurrences !== 1)
          throw new Error(
            `The configuration failure must appear once per Program cycle, got ${occurrences}.\n\nActual output:\n${result.output}`,
          );
      });
      check(() =>
        assertExcludes(
          result,
          "Invalid evidence/graph configuration",
          "A documented misconfiguration must never send the reader to the graph's settings.",
        ),
      );
    },
  },
  {
    /**
     * Swagger-outside.
     *
     * @evidence contracts/testing.md#behavioral-verification Sibling contracts/swagger.yaml declares POST:/members, cited by IMemberCreation. Its verify callback checks Status 0 and no Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The document genuinely sits above the project; swagger-file supplies the local-path counterpart.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The packaged Swagger normalizer must read the actual ancestor file and return its operation. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_a_swagger_document_outside_the_project",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-outside",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**/*.ts"],\n    symbol: "type",\n    reference: {\n      type: "swagger",\n      file: "../contracts/swagger.yaml",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      workspaceFiles: {
        "contracts/swagger.yaml":
          'swagger: "2.0"\ninfo:\n  title: Members\n  version: "1.0.0"\npaths:\n  /members:\n    post:\n      operationId: members.create\n      responses:\n        "201":\n          description: Created\n',
      },
      files: {
        "src/members.ts":
          "/** @evidence POST:/members Creates members through the shared API contract. */\nexport interface IMemberCreation {}\n",
      },
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
     * Central-exclusion-carriers.
     *
     * @evidence contracts/testing.md#behavioral-verification Five schema, controller, DTO and backend-test claims use authored central exclusion carriers. Its verify callback checks Status 0 and no Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Property and file carriers cover obligations without selected model/function evidence; invalid-central-exclusion-carriers rejects malformed uses.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Typed multi-claim options, Prisma parsing and central carrier citations cross the real contributor boundary. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_central_exclusion_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "central-exclusion-carriers",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: "schema-models",\n      type: "prisma",\n      files: ["prisma/**/*.prisma", "prisma/exclude.schema"],\n      symbol: "model",\n      reference: {\n        type: "markdown",\n        files: ["docs/schema.md"],\n        symbol: "h2",\n      },\n    },\n    {\n      name: "api-operations",\n      type: "typescript",\n      files: ["src/controllers/**/*.ts"],\n      symbol: "function",\n      reference: [\n        {\n          type: "markdown",\n          files: ["docs/controller.md"],\n          symbol: "h2",\n        },\n        {\n          type: "prisma",\n          files: ["prisma/**/*.prisma"],\n          symbol: "model",\n        },\n      ],\n    },\n    {\n      name: "dto-types",\n      type: "typescript",\n      files: ["src/structures/**/*.ts"],\n      symbol: "type",\n      reference: {\n        type: "markdown",\n        files: ["docs/dto.md"],\n        symbol: "h2",\n      },\n    },\n    {\n      name: "dto-properties",\n      type: "typescript",\n      files: ["src/structures/**/*.ts"],\n      symbol: "property",\n      reference: {\n        type: "prisma",\n        files: ["prisma/**/*.prisma"],\n        symbol: "column",\n      },\n    },\n    {\n      name: "backend-tests",\n      type: "typescript",\n      files: ["src/tests/**/*.ts"],\n      symbol: "function",\n      reference: [\n        {\n          type: "markdown",\n          files: ["docs/test.md"],\n          symbol: "h2",\n        },\n        {\n          type: "typescript",\n          files: ["src/contracts.ts"],\n          symbol: "function",\n        },\n        {\n          type: "typescript",\n          files: ["src/contracts.ts"],\n          symbol: "type",\n        },\n      ],\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/schema.md": "## Persistence {#persistence}\n",
        "docs/controller.md": "## Operation {#operation}\n",
        "docs/dto.md": "## Contract {#contract}\n",
        "docs/test.md": "## Scenario {#scenario}\n",
        "prisma/schema.prisma":
          'datasource db {\n  provider = "sqlite"\n}\n\nmodel Sale {\n  id String @id\n}\n',
        "prisma/exclude.schema":
          "/// Lint-only schema exclusions.\n///\n/// @evidenceExclude docs/schema.md#persistence This fixture intentionally stores no requirement-owned model.\n",
        "src/controllers/CONTROLLER_EVIDENCE_EXCLUDE.ts":
          "/**\n * Central controller exclusions.\n *\n * @evidenceExclude docs/controller.md#operation This fixture intentionally exposes no operation.\n * @evidenceExclude prisma:Sale This fixture intentionally exposes no sale operation.\n */\nexport const CONTROLLER_EVIDENCE_EXCLUDE = true;\nexport function selectedController(): void {}\n",
        "src/structures/DTO_EVIDENCE_EXCLUDE.ts":
          "/**\n * Central DTO exclusions.\n *\n * @evidenceExclude docs/dto.md#contract This fixture intentionally publishes no DTO.\n * @evidenceExclude prisma:Sale.id This fixture intentionally transports no sale id.\n */\nexport const DTO_EVIDENCE_EXCLUDE = true;\nexport interface SelectedDto {\n  id: string;\n}\n",
        "src/contracts.ts":
          "/** Public operation contract. */\nexport function publicOperation(): void {}\n\n/** Public data contract. */\nexport interface IContract {}\n",
        "src/tests/TEST_EVIDENCE_EXCLUDE.ts":
          'import type { IContract, publicOperation } from "../contracts.js";\n\n/**\n * Central backend-test exclusions.\n *\n * @evidenceExclude docs/test.md#scenario This fixture intentionally runs no scenario.\n * @evidenceExclude {@link publicOperation} This fixture intentionally calls no operation.\n * @evidenceExclude {@link IContract} This fixture intentionally validates no response type.\n */\nexport const TEST_EVIDENCE_EXCLUDE = true;\nexport function selectedTest(): void {}\n',
      },
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
     * Invalid-central-exclusion-carriers.
     *
     * @evidence contracts/testing.md#behavioral-verification Property evidence, file evidence, discarded Prisma line tags and an unresolved exclusion are placed on invalid carriers. Its verify callback checks Failure and the original carrier rejection, discarded citation and missing target messages.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The neighboring central-exclusion-carriers configuration proves valid carriers can pass.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Each distinct carrier finding must retain its native category through the public configuration. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_central_exclusion_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "invalid-central-exclusion-carriers",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { evidence },\n  rules: {\n    "evidence/graph": ["error", { claims: [\n      {\n        type: "typescript",\n        files: ["src/CONTROLLER_EVIDENCE_EXCLUDE.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/contract.md"],\n          symbol: "h2",\n        },\n      },\n      {\n        type: "prisma",\n        files: ["prisma/**/*.prisma", "prisma/exclude.schema"],\n        symbol: "model",\n        reference: {\n          type: "markdown",\n          files: ["docs/schema.md"],\n          symbol: "h2",\n        },\n      },\n    ] }],\n  },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/contract.md": "## Contract {#contract}\n",
        "docs/schema.md": "## Schema {#schema}\n",
        "src/CONTROLLER_EVIDENCE_EXCLUDE.ts":
          "/** @evidence docs/contract.md#contract A property cannot own a function claim. */\nexport const CONTROLLER_EVIDENCE_EXCLUDE = true;\nexport function selectedController(): void {}\n",
        "prisma/schema.prisma":
          'datasource db {\n  provider = "sqlite"\n}\n\nmodel Sale {\n  id String @id\n}\n',
        "prisma/exclude.schema":
          "/// @evidence docs/schema.md#schema A file cannot own model evidence.\n\n// @evidenceExclude docs/schema.md#schema Prisma discards this line.\n\n/// @evidenceExclude docs/schema.md#missing This target is not configured.\n",
      },
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
     * Overlapping-prisma-claims.
     *
     * @evidence contracts/testing.md#behavioral-verification Sale type and Sale.id property cite the same Prisma model and column through separate DTO claims. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Overlapping type/property populations must discharge their own model/column obligations.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Two claim scopes and parsed Prisma members must connect to TypeScript declarations in one actual config. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_overlapping_type_and_property_claims",
    props: {
      nativeProducer: "snapshot",
      name: "overlapping-prisma-claims",
      lintConfig:
        'import { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", { claims: [\n      {\n        name: "DTO models",\n        type: "typescript",\n        files: ["src/structures/**/*.ts"],\n        symbol: "type",\n        reference: { type: "prisma", files: ["prisma/**/*.prisma"], symbol: "model" },\n      },\n      {\n        name: "DTO columns",\n        type: "typescript",\n        files: ["src/structures/**/*.ts"],\n        symbol: "property",\n        reference: { type: "prisma", files: ["prisma/**/*.prisma"], symbol: "column" },\n      },\n    ] }],\n  },\n};\n',
      files: {
        "prisma/schema.prisma":
          'datasource db {\n  provider = "postgresql"\n}\n\nmodel Sale {\n  id String @id @db.Uuid\n}\n',
        "src/structures/Sale.ts":
          "/** @evidence prisma:Sale This contract materializes the Sale model. */\nexport interface Sale {\n  /** @evidence prisma:Sale.id This field materializes the id column. */\n  id: string;\n}\n",
      },
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
     * Swagger-file.
     *
     * @evidence contracts/testing.md#behavioral-verification Local api/swagger.yaml declares POST:/members, cited by IMemberCreation. Its verify callback checks Status 0 and no Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Local exact-file selection complements the sibling-file and HTTP operations.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The installed normalizer must parse the authored local YAML rather than an assumed operation list. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_swagger_file_reference",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-file",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**/*.ts"],\n    symbol: "type",\n    reference: {\n      type: "swagger",\n      file: "api/swagger.yaml",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "api/swagger.yaml":
          'swagger: "2.0"\ninfo:\n  title: Members\n  version: "1.0.0"\npaths:\n  /members:\n    post:\n      operationId: members.create\n      responses:\n        "201":\n          description: Created\n',
        "src/members.ts":
          "/** @evidence POST:/members Creates members through the declared API operation. */\nexport interface IMemberCreation {}\n",
      },
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
     * Typed-config.
     *
     * @evidence contracts/testing.md#behavioral-verification ITtscEvidenceGraphConfig selects createOrder against the explicit Create Order Markdown anchor. Its verify callback checks Status 0 and no Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The selected config module retains satisfies ITtscLintConfig and the public named plugin export.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Public declaration types, option serialization and native function-to-heading coverage must agree. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_accepts_typed_consumer_config",
    props: {
      nativeProducer: "snapshot",
      name: "typed-config",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    name: "Order contract",\n    files: ["src/**/*.ts"],\n    symbol: "function",\n    reference: {\n      type: "markdown",\n      files: ["docs/**/*.md"],\n      symbol: "h2",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/orders.md": "## Create Order {#create-order}\n",
        "src/orders.ts":
          "/**\n * @evidence docs/orders.md#create-order This operation implements the documented creation flow.\n */\nexport const createOrder = (): void => {};\n",
      },
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
     * Selected-hosts-inactive.
     *
     * @evidence contracts/testing.md#behavioral-verification Matched TypeScript, Markdown and Prisma files contain no selected callable, h2 or model; their references name missing roots. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Selected-hosts-active supplies the same three host kinds with actual selected units.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Zero-host activation must avoid loading nonexistent reference populations through the actual contributor. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_activates_only_selected_claim_hosts",
    props: {
      nativeProducer: "snapshot",
      name: "selected-hosts-inactive",
      lintConfig:
        'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          files: ["src/**/*.ts"],\n          symbol: "function",\n          reference: {\n            type: "markdown",\n            root: "missing-typescript-docs",\n            files: ["**/*.md"],\n            symbol: "h2",\n          },\n        },\n        {\n          type: "markdown",\n          files: ["docs/claim.md"],\n          symbol: "h2",\n          reference: {\n            type: "prisma",\n            root: "missing-markdown-prisma",\n            files: ["**/*.prisma"],\n            symbol: "model",\n          },\n        },\n        {\n          type: "prisma",\n          files: ["prisma/schema/main.prisma"],\n          symbol: "model",\n          reference: {\n            type: "markdown",\n            root: "missing-prisma-docs",\n            files: ["**/*.md"],\n            symbol: "h2",\n          },\n        },\n      ],\n    }],\n  },\n};\n',
      files: {
        "src/claim.ts": "export const value = 1;\n",
        "docs/claim.md": "# Claim\n",
        "prisma/schema/main.prisma":
          'generator client {\n  provider = "prisma-client"\n  output = "../../src/prisma"\n}\n\ndatasource db {\n  provider = "sqlite"\n}\n',
      },
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
     * Selected-hosts-active.
     *
     * @evidence contracts/testing.md#behavioral-verification Callable run, heading Claim and Prisma contract model activate three original claims. Its verify callback checks Status 2, exactly two Requirement missing findings and exactly one prisma:contract missing finding.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The inactive counterpart has matched files but no selected hosts.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Native claim activation and per-population diagnostic cardinality must survive actual configuration transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_activates_only_selected_claim_hosts",
    props: {
      nativeProducer: "snapshot",
      name: "selected-hosts-active",
      lintConfig:
        'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          files: ["src/**/*.ts"],\n          symbol: "function",\n          reference: {\n            type: "markdown",\n            files: ["docs/reference.md"],\n            symbol: "h2",\n          },\n        },\n        {\n          type: "markdown",\n          files: ["docs/claim.md"],\n          symbol: "h2",\n          reference: {\n            type: "prisma",\n            files: ["prisma/schema/main.prisma"],\n            symbol: "model",\n          },\n        },\n        {\n          type: "prisma",\n          files: ["prisma/schema/main.prisma"],\n          symbol: "model",\n          reference: {\n            type: "markdown",\n            files: ["docs/reference.md"],\n            symbol: "h2",\n          },\n        },\n      ],\n    }],\n  },\n};\n',
      files: {
        "src/claim.ts": "export const run = (): void => {};\n",
        "docs/claim.md": "## Claim\n",
        "docs/reference.md": "## Requirement\n",
        "prisma/schema/main.prisma": "model contract {\n  id String @id\n}\n",
      },
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
     * Prisma-graph.
     *
     * @evidence contracts/testing.md#behavioral-verification Sale cites Pricing, Seller excludes Sellers and ISale cites both parsed models. Its verify callback checks Status 0 and no Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Model-level citations must discharge the selected columns and relations beneath them.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Parsed schema documentation and TypeScript-to-Prisma references must connect in both graph directions. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_binds_a_prisma_schema_to_requirements",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-graph",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      type: "prisma",\n      name: "Every model justifies itself",\n      files: ["prisma/**/*.prisma"],\n      symbol: "model",\n      reference: {\n        type: "markdown",\n        files: ["docs/requirements.md"],\n        symbol: "h2",\n      },\n    },\n    {\n      type: "typescript",\n      files: ["src/**/*.ts"],\n      symbol: "type",\n      reference: {\n        type: "prisma",\n        files: ["prisma/**/*.prisma"],\n        symbol: ["model", "column", "relation"],\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "prisma/schema.prisma":
          'datasource db {\n  provider = "postgresql"\n}\n\n/// A sale.\n/// @evidence docs/requirements.md#pricing The sale exists to price an offer.\nmodel Sale {\n  id        String @id @db.Uuid\n  price     Int\n  seller_id String @db.Uuid\n  seller    Seller @relation(fields: [seller_id], references: [id])\n}\n\n/// @evidenceExclude docs/requirements.md#sellers Seller identity is owned by the auth service.\nmodel Seller {\n  id    String @id @db.Uuid\n  sales Sale[]\n}\n',
        "docs/requirements.md":
          "# Requirements\n\n## Pricing {#pricing}\n\nAn offer is priced when it is sold.\n\n## Sellers {#sellers}\n\nA seller owns the sales they create.\n",
        "src/sale.ts":
          "/**\n * @evidence prisma:Sale This contract materializes the sale row.\n * @evidence prisma:Seller This contract materializes the seller row.\n */\nexport interface ISale {}\n",
      },
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
     * Hierarchical-targets.
     *
     * @evidence contracts/testing.md#behavioral-verification Implementation namespace cites the whole specification; ILedger cites the namespace ancestor. Its verify callback checks Status 0, no Unresolved evidence target and no Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Selected h2/h3 and function/property descendants are covered by unselected resolvable ancestors.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Native hierarchy expansion must receive the original Markdown and TypeScript ancestor references. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_cascades_hierarchical_targets",
    props: {
      nativeProducer: "snapshot",
      name: "hierarchical-targets",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          files: ["src/implementation.ts"],\n          symbol: "type",\n          reference: { type: "markdown", files: ["docs/spec.md"], symbol: ["h2", "h3"] },\n        },\n        {\n          type: "typescript",\n          files: ["src/ledger.ts"],\n          symbol: "type",\n          reference: { type: "typescript", files: ["src/implementation.ts"], symbol: ["function", "property"] },\n        },\n      ],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/spec.md": "## Orders\n\n### Retry\n",
        "src/implementation.ts":
          '/** @evidence docs/spec.md The namespace implements the complete order specification. */\nexport namespace Implementation {\n  export const state = "ready";\n  export function run(): void {}\n}\n',
        "src/ledger.ts":
          'import type { Implementation } from "./implementation.js";\n\n/** @evidence {@link Implementation} The ledger documents the complete implementation namespace. */\nexport interface ILedger {}\n',
      },
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
     * Class-units.
     *
     * @evidence contracts/testing.md#behavioral-verification Sale class and public price field cite their sections while Uncited remains uncovered. Its verify callback checks Failure and Uncited missing finding, with Sale and Price findings absent.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The deliberately uncited section prevents a silent or inactive class/property graph passing.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Actual compiler declaration identities must reach native type/property claims and diagnostic transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_cites_a_class_and_its_members",
    props: {
      nativeProducer: "snapshot",
      name: "class-units",
      lintConfig:
        'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        type: "typescript",\n        files: ["src/Sale.ts"],\n        symbol: "type",\n        reference: {\n          type: "markdown",\n          files: ["docs/subject.md"],\n          symbol: "h2",\n        },\n      }, {\n        type: "typescript",\n        files: ["src/Sale.ts"],\n        symbol: "property",\n        reference: {\n          type: "markdown",\n          files: ["docs/fields.md"],\n          symbol: "h2",\n        },\n      }],\n    }],\n  },\n};\n',
      files: {
        "docs/subject.md": "## Sale {#sale}\n\nA sale offered to a customer.\n",
        "docs/fields.md":
          "## Price {#price}\n\nThe amount the customer pays.\n\n## Uncited {#uncited}\n\nNothing answers for this section.\n",
        "src/Sale.ts":
          "/** @evidence docs/subject.md#sale The sale this section specifies. */\nexport class Sale {\n  /** @evidence docs/fields.md#price The price this section fixes. */\n  public readonly price: number = 0;\n  private ledger: number = 0;\n  public charge(): void {}\n}\n",
      },
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
     * Root-markdown.
     *
     * @evidence contracts/testing.md#behavioral-verification ISale cites a Discount Policy section in sibling docs/requirements/pricing.md. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The sibling root differs from ordinary project-local Markdown selection.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The native rooted population must open the real ancestor document and resolve its relative citation. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_cites_documents_above_the_project",
    props: {
      nativeProducer: "snapshot",
      name: "root-markdown",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**/*.ts"],\n    symbol: "type",\n    reference: {\n      type: "markdown",\n      root: "../docs",\n      files: ["requirements/**"],\n      symbol: "h2",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      workspaceFiles: {
        "docs/requirements/pricing.md": "## Discount Policy {#discounts}\n",
      },
      files: {
        "src/sale.ts":
          "/** @evidence requirements/pricing.md#discounts Discount stacking follows this section. */\nexport interface ISale {}\n",
      },
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "A document set beside the project must be citable through a declared root.",
        ),
      );
    },
  },
  {
    /**
     * Composed-graph.
     *
     * @evidence contracts/testing.md#behavioral-verification Requirements, analysis, architecture, TSX components and feature tests compose four original claims. Its verify callback checks Status 0 and no Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Mixed Markdown/TypeScript references, an exclusion and TSX imports require the preserved jsx setting.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary All authored multi-claim fields and TSX source membership must cross the actual compiler/config connection. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_composes_multi_claim_graphs",
    props: {
      nativeProducer: "snapshot",
      name: "composed-graph",
      compilerOptions: {
        jsx: "preserve",
      },
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      type: "markdown",\n      files: ["docs/analysis.md"],\n      symbol: "h2",\n      reference: { type: "markdown", files: ["docs/requirements.md"], symbol: "h2" },\n    },\n    {\n      type: "markdown",\n      files: ["docs/architecture.md"],\n      symbol: "h2",\n      reference: { type: "markdown", files: ["docs/requirements.md"], symbol: "h2" },\n    },\n    {\n      type: "typescript",\n      files: ["src/components/**/*.tsx"],\n      symbol: "function",\n      reference: { type: "markdown", files: ["docs/features.md"], symbol: "h2" },\n    },\n    {\n      type: "typescript",\n      files: ["src/features/**/*.ts"],\n      symbol: "function",\n      reference: [\n        { type: "markdown", files: ["docs/features.md"], symbol: "h2" },\n        { type: "typescript", files: ["src/components/**/*.tsx"], symbol: "function" },\n      ],\n    },\n  ],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/requirements.md": "## Checkout {#checkout}\n",
        "docs/analysis.md":
          "## Checkout Analysis\n\n<!-- @evidence docs/requirements.md#checkout The analysis refines the checkout requirement. -->\n",
        "docs/architecture.md":
          "## Checkout Architecture\n\n<!-- @evidenceExclude docs/requirements.md#checkout Architecture defers checkout to the payment provider. -->\n",
        "docs/features.md": "## Cart Badge {#cart-badge}\n",
        "src/components/CartBadge.tsx":
          '/**\n * @evidence docs/features.md#cart-badge Renders the badge the feature rule defines.\n */\nexport function CartBadge(): string {\n  return "badge";\n}\n',
        "src/features/cart_badge.ts":
          'import type { CartBadge } from "../components/CartBadge.js";\n\n/**\n * @evidence docs/features.md#cart-badge Verifies the badge follows the feature rule.\n * @evidence {@link CartBadge} Claims the exported component contract.\n */\nexport function test_cart_badge(): void {}\n',
      },
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
     * Prisma-carrier-confined.
     *
     * @evidence contracts/testing.md#behavioral-verification A sibling sales model cites Stored while its declared schema exclusion carrier discharges Deferred. Its verify callback checks Status 0, no Missing acknowledgement and no Misplaced @evidenceExclude.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Prisma-carrier-misplaced changes only eligible carrier placement and retains failure.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Rooted schema files and carrier globs must resolve against the same actual ancestor base. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_confines_prisma_and_rooted_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-carrier-confined",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: "models",\n      type: "prisma",\n      root: "..",\n      files: ["schema/**/*.prisma", "schema/exclude.schema"],\n      evidenceExcludeCarriers: ["schema/exclude.schema"],\n      symbol: "model",\n      reference: {\n        type: "markdown",\n        root: "..",\n        files: ["docs/spec.md"],\n        symbol: "h2",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "src/placeholder.ts": "export const placeholder = true;\n",
      },
      workspaceFiles: {
        "docs/spec.md": "## Stored {#stored}\n\n## Deferred {#deferred}\n",
        "schema/main.prisma":
          "/// A persisted sale.\n///\n/// @evidence docs/spec.md#stored Stores the required sale.\nmodel sales {\n  id String @id\n}\n",
        "schema/exclude.schema":
          "/// Lint-only carrier for schema exclusions.\n///\n/// @evidenceExclude docs/spec.md#deferred The frontend owns this presentation-only section; reject this exclusion if it gains persisted state.\n",
      },
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
     * Prisma-carrier-misplaced.
     *
     * @evidence contracts/testing.md#behavioral-verification The sales model takes Deferred's exclusion out of its declared sibling schema carrier. Its verify callback checks Failure, Misplaced @evidenceExclude, the literal schema/exclude.schema repair and Missing acknowledgement.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The confined counterpart uses the same rooted Prisma/Markdown contract successfully.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Rooted carrier eligibility and refusal to grant coverage must survive actual native option transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_confines_prisma_and_rooted_carriers",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-carrier-misplaced",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      name: "models",\n      type: "prisma",\n      root: "..",\n      files: ["schema/**/*.prisma", "schema/exclude.schema"],\n      evidenceExcludeCarriers: ["schema/exclude.schema"],\n      symbol: "model",\n      reference: {\n        type: "markdown",\n        root: "..",\n        files: ["docs/spec.md"],\n        symbol: "h2",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "src/placeholder.ts": "export const placeholder = true;\n",
      },
      workspaceFiles: {
        "docs/spec.md": "## Stored {#stored}\n\n## Deferred {#deferred}\n",
        "schema/main.prisma":
          "/// A persisted sale.\n///\n/// @evidence docs/spec.md#stored Stores the required sale.\n/// @evidenceExclude docs/spec.md#deferred The frontend owns this presentation-only section; reject this exclusion if it gains persisted state.\nmodel sales {\n  id String @id\n}\n",
        "schema/exclude.schema":
          "/// Lint-only carrier for schema exclusions.\n",
      },
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
     * Repeated-positive-evidence.
     *
     * @evidence contracts/testing.md#behavioral-verification Independent success/refusal hosts both cite Contract and refusal also cites Validation. Its verify callback checks Status 0 and no Duplicate finding.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Same-host repetition and duplicate exclusions below distinguish positive overlap from duplicate ownership.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The native contributor must preserve authored host identity when reporting overlapping positive edges. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry:
      "test_evidence_graph_distinguishes_repeated_evidence_from_exclusions",
    props: {
      nativeProducer: "snapshot",
      name: "repeated-positive-evidence",
      files: {
        "docs/spec.md":
          "## Contract {#contract}\n### Validation {#validation}\n",
        "src/success.ts":
          "/** @evidence docs/spec.md#contract Proves the success behavior. */\nexport function success(): void {}\n",
        "src/refusal.ts":
          "/** @evidence docs/spec.md#contract Proves the refusal behavior. */\n/** @evidence docs/spec.md#validation Proves validation. */\nexport function refusal(): void {}\n",
      },
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        name: "tests",\n        type: "typescript",\n        files: ["src/*.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/spec.md"],\n          symbol: ["h2", "h3"],\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          0,
          "Independent positive evidence must remain valid.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Duplicate",
          "Overlapping positive evidence must not become a duplicate.",
        ),
      );
    },
  },
  {
    /**
     * Same-host-duplicate-evidence.
     *
     * @evidence contracts/testing.md#behavioral-verification One claim function carries two positive tags for Contract with different reasons. Its verify callback checks Failure and Duplicate @evidence for Contract on the same host.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Independent positive hosts are accepted by repeated-positive-evidence.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Duplicate tag category, exact target and host boundary must reach actual native diagnostics. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry:
      "test_evidence_graph_distinguishes_repeated_evidence_from_exclusions",
    props: {
      nativeProducer: "snapshot",
      name: "same-host-duplicate-evidence",
      files: {
        "docs/spec.md": "## Contract {#contract}\n",
        "src/claim.ts":
          "/**\n * @evidence docs/spec.md#contract First reason.\n * @evidence docs/spec.md#contract Second reason.\n */\nexport function claim(): void {}\n",
      },
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        name: "tests",\n        type: "typescript",\n        files: ["src/*.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/spec.md"],\n          symbol: ["h2", "h3"],\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(result, "One host must not repeat one positive edge."),
      );
      check(() =>
        assertIncludes(
          result,
          "Duplicate @evidence for 'docs/spec.md#contract' on the same host",
          "The duplicate must name its tag, target, and host boundary.",
        ),
      );
    },
  },
  {
    /**
     * Duplicate-exclusions.
     *
     * @evidence contracts/testing.md#behavioral-verification First and second functions both exclude the same Contract obligation. Its verify callback checks Failure and Duplicate @evidenceExclude for Contract.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Distinct hosts do not legalize two exclusion decisions, unlike independent positive evidence.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Native scope ownership must preserve the exclusion category across serialized claim settings. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry:
      "test_evidence_graph_distinguishes_repeated_evidence_from_exclusions",
    props: {
      nativeProducer: "snapshot",
      name: "duplicate-exclusions",
      files: {
        "docs/spec.md": "## Contract {#contract}\n",
        "src/first.ts":
          "/** @evidenceExclude docs/spec.md#contract First exclusion. */\nexport function first(): void {}\n",
        "src/second.ts":
          "/** @evidenceExclude docs/spec.md#contract Second exclusion. */\nexport function second(): void {}\n",
      },
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        name: "tests",\n        type: "typescript",\n        files: ["src/*.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/spec.md"],\n          symbol: ["h2", "h3"],\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(
          result,
          "One claim-reference scope must own one exclusion decision.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Duplicate @evidenceExclude for 'docs/spec.md#contract'",
          "The duplicate exclusion must reach the real consumer.",
        ),
      );
    },
  },
  {
    /**
     * Evidence-exclusion-conflict.
     *
     * @evidence contracts/testing.md#behavioral-verification An implementation cites Contract while an exclusion targets its Validation descendant. Its verify callback checks Failure and Conflicting acknowledgements for Validation.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Ancestor coverage creates the overlap even though the authored tag targets differ.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Native hierarchy and intent fields must produce the exact overlapping-unit finding. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry:
      "test_evidence_graph_distinguishes_repeated_evidence_from_exclusions",
    props: {
      nativeProducer: "snapshot",
      name: "evidence-exclusion-conflict",
      files: {
        "docs/spec.md":
          "## Contract {#contract}\n### Validation {#validation}\n",
        "src/implementation.ts":
          "/** @evidence docs/spec.md#contract Implements the contract. */\nexport function implementation(): void {}\n",
        "src/exclusion.ts":
          "/** @evidenceExclude docs/spec.md#validation Excludes validation. */\nexport function exclusion(): void {}\n",
      },
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        name: "tests",\n        type: "typescript",\n        files: ["src/*.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/spec.md"],\n          symbol: ["h2", "h3"],\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(result, "Opposite intents must not cover one unit."),
      );
      check(() =>
        assertIncludes(
          result,
          "Conflicting acknowledgements for 'docs/spec.md#validation'",
          "The result must name the exact overlapping unit.",
        ),
      );
    },
  },
  {
    /**
     * Missing-acknowledgement-repair.
     *
     * @evidence contracts/testing.md#behavioral-verification A selected claim function has no tag for the authored Contract heading. Its verify callback checks Failure and the original two repair alternatives, with the replaced Add '@evidence text absent.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The callback checks meaningful repair prose rather than mere nonzero status.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The packaged native missing-obligation diagnostic must retain its actionable wording. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry:
      "test_evidence_graph_distinguishes_repeated_evidence_from_exclusions",
    props: {
      nativeProducer: "snapshot",
      name: "missing-acknowledgement-repair",
      files: {
        "docs/spec.md": "## Contract {#contract}\n",
        "src/claim.ts": "export function claim(): void {}\n",
      },
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        name: "tests",\n        type: "typescript",\n        files: ["src/*.ts"],\n        symbol: "function",\n        reference: {\n          type: "markdown",\n          files: ["docs/spec.md"],\n          symbol: ["h2", "h3"],\n        },\n      }],\n    }],\n  },\n} satisfies ITtscLintConfig;\n',
    },
    verify(result, check, location): void {
      check(() =>
        assertFailure(result, "Missing evidence must fail the consumer build."),
      );
      check(() =>
        assertIncludes(
          result,
          "with @evidence on a selected typescript host, building that artifact first when none does, or write @evidenceExclude on an eligible carrier when nothing here owes it.",
          "The result diagnostic must retain both repairs without prescribing filler.",
        ),
      );
      check(() =>
        assertExcludes(
          result,
          "Add '@evidence",
          "The replaced verbose repair must not survive packaging.",
        ),
      );
    },
  },
  {
    /**
     * Markdown-checklist-rejected.
     *
     * @evidence contracts/testing.md#behavioral-verification Partial cites one of two items while broad cites the entire checklist document. Its verify callback checks Failure, 1 of 2 shortfall, aggregate target refusal and Cite each item repair.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Markdown-checklist-accepted answers both items separately on each host.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The public Markdown checklist option must govern native per-host item obligations. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_a_markdown_checklist",
    props: {
      nativeProducer: "snapshot",
      name: "markdown-checklist-rejected",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport {\n  evidence,\n  type ITtscEvidenceGraphConfig,\n  type ITtscEvidenceGraphMarkdownReference,\n} from "@ttsc/evidence";\n\n// The option is declared on the Markdown reference rather than on the shared\n// base, because no other population is read one item at a time.\nconst reference: ITtscEvidenceGraphMarkdownReference = {\n  type: "markdown",\n  files: ["docs/rules.md"],\n  symbol: "h2",\n  checklist: true,\n};\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**"],\n    symbol: "function",\n    reference,\n  }],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/rules.md":
          "## No hardcoding {#no-hardcoding}\n\nFix the general logic instead of special-casing a fixture.\n\n## No whack-a-mole {#no-whack-a-mole}\n\nSeal the class of failure rather than the witness.\n",
        "src/partial.ts":
          "/** @evidence docs/rules.md#no-hardcoding The general logic decides. */\nexport function partial(): void {}\n",
        "src/broad.ts":
          "/** @evidence docs/rules.md Everything in here is honored. */\nexport function broad(): void {}\n",
      },
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
     * Markdown-checklist-accepted.
     *
     * @evidence contracts/testing.md#behavioral-verification First cites both checklist items; second cites one and excludes the other. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The rejected counterpart uses partial and aggregate citations against the same two authored items.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Typed checklist true and independent per-host tags must connect to the native graph. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_a_markdown_checklist",
    props: {
      nativeProducer: "snapshot",
      name: "markdown-checklist-accepted",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport {\n  evidence,\n  type ITtscEvidenceGraphConfig,\n  type ITtscEvidenceGraphMarkdownReference,\n} from "@ttsc/evidence";\n\n// The option is declared on the Markdown reference rather than on the shared\n// base, because no other population is read one item at a time.\nconst reference: ITtscEvidenceGraphMarkdownReference = {\n  type: "markdown",\n  files: ["docs/rules.md"],\n  symbol: "h2",\n  checklist: true,\n};\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**"],\n    symbol: "function",\n    reference,\n  }],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/rules.md":
          "## No hardcoding {#no-hardcoding}\n\nFix the general logic instead of special-casing a fixture.\n\n## No whack-a-mole {#no-whack-a-mole}\n\nSeal the class of failure rather than the witness.\n",
        "src/first.ts":
          "/**\n * @evidence docs/rules.md#no-hardcoding The general logic decides.\n * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.\n */\nexport function first(): void {}\n",
        "src/second.ts":
          "/**\n * @evidence docs/rules.md#no-hardcoding The general logic decides here too.\n * @evidenceExclude docs/rules.md#no-whack-a-mole This helper has one case.\n */\nexport function second(): void {}\n",
      },
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
     * Reference-policy-rejected.
     *
     * @evidence contracts/testing.md#behavioral-verification An exclusion faces noEvidenceExclude, uniqueEvidence and singleEvidencePerSymbol strict options. Its verify callback checks Failure and the three original strict-policy/coverage refusal messages.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Reference-policy-accepted supplies one positive host for each unit.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The shared reference-base type and strict fields must arrive unchanged at native policy evaluation. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_reference_policy",
    props: {
      nativeProducer: "snapshot",
      name: "reference-policy-rejected",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport {\n  evidence,\n  type ITtscEvidenceGraphConfig,\n  type ITtscEvidenceGraphMarkdownReference,\n  type ITtscEvidenceGraphReferenceBase,\n} from "@ttsc/evidence";\n\nconst reference: ITtscEvidenceGraphMarkdownReference = {\n  type: "markdown",\n  files: ["docs/spec.md"],\n  symbol: "h2",\n  noEvidenceExclude: true,\n  uniqueEvidence: true,\n  singleEvidencePerSymbol: true,\n};\n\n// Every reference kind extends the same base, so the strict options are\n// declared once and a concrete population still satisfies the shared shape.\nconst base: ITtscEvidenceGraphReferenceBase<"markdown"> = reference;\nvoid base;\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**"],\n    symbol: "function",\n    reference,\n  }],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/spec.md": "## Contract {#contract}\n",
        "src/rejected.ts":
          "/** @evidenceExclude docs/spec.md#contract No implementation. */\nexport function rejected(): void {}\n",
      },
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
     * Reference-policy-accepted.
     *
     * @evidence contracts/testing.md#behavioral-verification First answers Contract and second answers Pricing under the complete strict reference policy. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The rejected counterpart attempts an exclusion under the same strict options.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Public strict reference types and native per-unit positive ownership must connect. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_enforces_reference_policy",
    props: {
      nativeProducer: "snapshot",
      name: "reference-policy-accepted",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport {\n  evidence,\n  type ITtscEvidenceGraphConfig,\n  type ITtscEvidenceGraphMarkdownReference,\n  type ITtscEvidenceGraphReferenceBase,\n} from "@ttsc/evidence";\n\nconst reference: ITtscEvidenceGraphMarkdownReference = {\n  type: "markdown",\n  files: ["docs/spec.md"],\n  symbol: "h2",\n  noEvidenceExclude: true,\n  uniqueEvidence: true,\n  singleEvidencePerSymbol: true,\n};\n\n// Every reference kind extends the same base, so the strict options are\n// declared once and a concrete population still satisfies the shared shape.\nconst base: ITtscEvidenceGraphReferenceBase<"markdown"> = reference;\nvoid base;\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**"],\n    symbol: "function",\n    reference,\n  }],\n};\n\nexport default {\n  plugins: { evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/spec.md": "## Contract {#contract}\n\n## Pricing {#pricing}\n",
        "src/first.ts":
          "/** @evidence docs/spec.md#contract Implements the contract. */\nexport function first(): void {}\n",
        "src/second.ts":
          "/** @evidence docs/spec.md#pricing Implements the pricing rule. */\nexport function second(): void {}\n",
      },
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
     * Prisma-members.
     *
     * @evidence contracts/testing.md#behavioral-verification ISale cites all Sale members and only Seller.id in the authored related schema. Its verify callback checks Failure and Missing acknowledgement for prisma:Seller.sales.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The literal selective citations distinguish model hierarchy coverage from incomplete Seller coverage.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The actual Node parser's model/column/relation payload must reach native obligations. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_obligates_prisma_columns_and_relations",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-members",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**/*.ts"],\n    symbol: "type",\n    reference: {\n      type: "prisma",\n      files: ["prisma/**/*.prisma"],\n      symbol: ["model", "column", "relation"],\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "prisma/schema.prisma":
          'datasource db {\n  provider = "postgresql"\n}\n\nmodel Sale {\n  id        String @id @db.Uuid\n  price     Int\n  seller_id String @db.Uuid\n  seller    Seller @relation(fields: [seller_id], references: [id])\n}\n\nmodel Seller {\n  id    String @id @db.Uuid\n  sales Sale[]\n}\n',
        "src/sale.ts":
          "/**\n * @evidence prisma:Sale The sale row and every member of it is exposed here.\n * @evidence prisma:Seller.id The seller identity is exposed here.\n */\nexport interface ISale {}\n",
      },
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
     * Swagger-directory.
     *
     * @evidence contracts/testing.md#behavioral-verification The Swagger reference names a sibling contracts directory containing a valid YAML file. Its verify callback checks Failure and the original exact-file configuration refusal.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Swagger-outside names that document itself and succeeds.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The public Swagger file channel must reject directory discovery instead of silently choosing a document. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_refuses_a_swagger_directory_reference",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-directory",
      lintConfig:
        'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [\n        {\n          type: "typescript",\n          files: ["src/**/*.ts"],\n          symbol: "type",\n          reference: { type: "swagger", file: "../contracts/" },\n        },\n      ],\n    }],\n  },\n};\n',
      workspaceFiles: {
        "contracts/swagger.yaml":
          'swagger: "2.0"\ninfo:\n  title: Members\n  version: "1.0.0"\npaths:\n  /members:\n    post:\n      operationId: members.create\n      responses:\n        "201":\n          description: Created\n',
      },
      files: {
        "src/members.ts":
          "/** @evidence POST:/members Creates members through the shared API contract. */\nexport interface IMemberCreation {}\n",
      },
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
     * Prisma-line-comment.
     *
     * @evidence contracts/testing.md#behavioral-verification A // Prisma line comment carries the Pricing citation above Sale. Its verify callback checks Failure and the discarded '//' line comment diagnostic.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases A parsed model exists, so failure cannot be disguised as an empty schema population.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The real schema/parser connection must preserve discarded comment provenance and native diagnostics. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_reports_a_discarded_prisma_citation",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-line-comment",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "prisma",\n    files: ["prisma/**/*.prisma"],\n    symbol: "model",\n    reference: {\n      type: "markdown",\n      files: ["docs/requirements.md"],\n      symbol: "h2",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "prisma/schema.prisma":
          'datasource db {\n  provider = "postgresql"\n}\n\n// @evidence docs/requirements.md#pricing The sale exists to price an offer.\nmodel Sale {\n  id    String @id @db.Uuid\n  price Int\n}\n',
        "docs/requirements.md":
          "# Requirements\n\n## Pricing {#pricing}\n\nAn offer is priced when it is sold.\n",
      },
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
     * Root-markdown-uncited.
     *
     * @evidence contracts/testing.md#behavioral-verification ISale cites Discounts in a sibling document whose Refunds section remains uncited. Its verify callback checks Status 2, Refunds missing finding and the original at ../docs/requirements/pricing.md:3 location.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Root-markdown supplies the complete sibling-population counterpart.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Native rooted selection must retain the uncited section's actual physical diagnostic location. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_reports_an_uncited_document_above_the_project",
    props: {
      nativeProducer: "snapshot",
      name: "root-markdown-uncited",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**/*.ts"],\n    symbol: "type",\n    reference: {\n      type: "markdown",\n      root: "../docs",\n      files: ["requirements/**"],\n      symbol: "h2",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      workspaceFiles: {
        "docs/requirements/pricing.md":
          "## Discount Policy {#discounts}\n\n## Refund Policy {#refunds}\n",
      },
      files: {
        "src/sale.ts":
          "/** @evidence requirements/pricing.md#discounts Discount stacking follows this section. */\nexport interface ISale {}\n",
      },
    },
    verify(result, check, location): void {
      check(() =>
        assertStatus(
          result,
          2,
          "An uncited section of a shared document set must still fail the build.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          "Missing acknowledgement for 'requirements/pricing.md#refunds'",
          "The target must stay relative to the declared root.",
        ),
      );
      check(() =>
        assertIncludes(
          result,
          location("at ../docs/requirements/pricing.md:3"),
          "The location must ascend out of the project.",
        ),
      );
    },
  },
  {
    /**
     * Prisma-dangling.
     *
     * @evidence contracts/testing.md#behavioral-verification ISale cites existing Sale while IDiscount cites absent prisma:Discount. Its verify callback checks Failure and the literal prisma:Discount target.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The schema is healthy and nonempty; an unresolved citation is distinct from a parser failure.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Actual parsed schema names must connect to native target resolution and its diagnostic category. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_reports_an_uncited_prisma_model",
    props: {
      nativeProducer: "snapshot",
      name: "prisma-dangling",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**/*.ts"],\n    symbol: "type",\n    reference: {\n      type: "prisma",\n      files: ["prisma/**/*.prisma"],\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "prisma/schema.prisma":
          'datasource db {\n  provider = "postgresql"\n}\n\nmodel Sale {\n  id    String @id @db.Uuid\n  price Int\n}\n',
        "src/sale.ts":
          "/** @evidence prisma:Sale This contract materializes the sale row. */\nexport interface ISale {}\n",
        "src/discount.ts":
          "/** @evidence prisma:Discount This contract materializes the discount row. */\nexport interface IDiscount {}\n",
      },
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
     * Swagger-invalid.
     *
     * @evidence contracts/testing.md#behavioral-verification The actual local JSON declares unsupported OpenAPI 4.0.0. Its verify callback checks Failure, source filename and @typia/interface OpenApi.IDocument rejection; empty-population and Missing acknowledgement findings absent.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases A refused normalizer result must remain unhealthy rather than becoming an empty successful population.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The real Node normalizer rejection and contract name must survive native bridge transport. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_graph_reports_swagger_source_failures",
    props: {
      nativeProducer: "snapshot",
      name: "swagger-invalid",
      lintConfig:
        'import evidence from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", {\n      claims: [{\n        type: "typescript",\n        files: ["src/**/*.ts"],\n        reference: { type: "swagger", file: "api/openapi.json" },\n      }],\n    }],\n  },\n};\n',
      files: {
        "api/openapi.json":
          '{"openapi":"4.0.0","info":{"title":"Invalid","version":"1.0.0"},"paths":{}}',
        "src/ref.ts": "export interface Ref {}\n",
      },
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
     * Link-import-scope.
     *
     * @evidence contracts/testing.md#behavioral-verification Question and review views import distinct namespaces that both export get. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Link-no-import removes only the questions binding while retaining the reviews import.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Actual compiler import identity must resolve same-named functions into the correct native references. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_link_target_requires_a_real_import",
    props: {
      nativeProducer: "snapshot",
      name: "link-import-scope",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/views/**"],\n    symbol: "function",\n    reference: {\n      type: "typescript",\n      files: ["src/api/**"],\n      symbol: "function",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "src/api/questions.ts": "export function get(): void {}\n",
        "src/api/reviews.ts": "export function get(): void {}\n",
        "src/views/question.ts":
          'import type * as questions from "../api/questions.js";\n\n/**\n * @evidence {@link questions.get} Renders the question operation.\n */\nexport function question(): void {}\n',
        "src/views/review.ts":
          'import type * as reviews from "../api/reviews.js";\n\n/**\n * @evidence {@link reviews.get} Renders the review operation.\n */\nexport function review(): void {}\n',
      },
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
     * Link-no-import.
     *
     * @evidence contracts/testing.md#behavioral-verification The questions.get citation has no questions import while the reviews namespace remains imported. Its verify callback checks Failure and Unimported evidence target.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Link-import-scope proves both actual imported namespace bindings pass.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The contributor must receive the compiler's import scope rather than resolve citations by bare spelling. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_link_target_requires_a_real_import",
    props: {
      nativeProducer: "snapshot",
      name: "link-no-import",
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/views/**"],\n    symbol: "function",\n    reference: {\n      type: "typescript",\n      files: ["src/api/**"],\n      symbol: "function",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "src/api/questions.ts": "export function get(): void {}\n",
        "src/api/reviews.ts": "export function get(): void {}\n",
        "src/views/question.ts":
          "/**\n * @evidence {@link questions.get} Renders the question operation.\n */\nexport function question(): void {}\n",
        "src/views/review.ts":
          'import type * as reviews from "../api/reviews.js";\n\n/**\n * @evidence {@link reviews.get} Renders the review operation.\n */\nexport function review(): void {}\n',
      },
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
     * Readme-cite.
     *
     * @evidence contracts/testing.md#behavioral-verification SalePrice imports sales only for its braced IShoppingSale citation. Its verify callback checks Status 0 under noUnusedLocals true.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Its config is outside the Program; the direct SDK citation-usage unit owns the unbraced TS6133 counterpart.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Published citation types, actual compiler JSDoc import usage and native interface coverage must connect. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_readme_cite_example_passes",
    props: {
      nativeProducer: "snapshot",
      name: "readme-cite",
      include: ["src"],
      compilerOptions: {
        noUnusedLocals: true,
      },
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      type: "typescript",\n      files: ["src/*.ts"],\n      symbol: "function",\n      reference: {\n        type: "typescript",\n        files: ["src/contracts/**"],\n        symbol: "type",\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: {\n    "evidence": evidence,\n  },\n  rules: {\n    "evidence/graph": ["error", graph],\n  },\n} satisfies ITtscLintConfig;\n',
      files: {
        "src/contracts/IShoppingSale.ts":
          "export interface IShoppingSale {\n  price: number;\n}\n",
        "src/SalePrice.ts":
          'import type * as sales from "./contracts/IShoppingSale.js";\n\n/**\n * @evidence {@link sales.IShoppingSale} Renders the price exactly as the contract declares it.\n */\nexport function SalePrice(): null {\n  return null;\n}\n',
      },
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
     * Readme-configure.
     *
     * @evidence contracts/testing.md#behavioral-verification The README TSX CreateOrder example enables graph, documented, singular and todo together. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Its include list selects src without pulling the anonymous config into file rules.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The documented public example must compile and register all four actual native rules together. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_readme_configure_example_passes",
    props: {
      nativeProducer: "snapshot",
      name: "readme-configure",
      include: ["src"],
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [\n    {\n      type: "typescript",\n      files: ["src/components/**/*.tsx"],\n      symbol: "function",\n      reference: {\n        type: "markdown",\n        files: ["docs/**/*.md"],\n        symbol: ["h2", "h3"],\n      },\n    },\n  ],\n};\n\nexport default {\n  plugins: {\n    "evidence": evidence,\n  },\n  rules: {\n    "evidence/graph": ["error", graph],\n    "evidence/documented": "error",\n    "evidence/singular": "error",\n    "evidence/todo": "error",\n  },\n} satisfies ITtscLintConfig;\n',
      files: {
        "docs/orders.md": "## Create Order {#create-order}\n",
        "src/components/CreateOrder.tsx":
          "/**\n * @evidence docs/orders.md#create-order Renders the documented creation flow.\n */\nexport function CreateOrder(): null {\n  return null;\n}\n",
      },
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
     * Readme-markdown-citation.
     *
     * @evidence contracts/testing.md#behavioral-verification A Markdown Pricing Guide cites the sibling requirement file's Sale Price anchor. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases This Markdown host complements the README TypeScript host examples.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary The public Markdown-to-Markdown config and file citation must reach the actual contributor. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_readme_markdown_citation_example_passes",
    props: {
      nativeProducer: "snapshot",
      name: "readme-markdown-citation",
      include: ["src"],
      lintConfig:
        'import { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/graph": ["error", { claims: [{\n      type: "markdown",\n      files: ["docs/guides/pricing.md"],\n      symbol: "h1",\n      reference: { type: "markdown", files: ["docs/requirements/pricing.md"], symbol: "h2" },\n    }] }],\n  },\n};\n',
      files: {
        "docs/guides/pricing.md":
          "# Pricing Guide\n\n<!-- @evidence docs/requirements/pricing.md#sale-price Uses the approved sale-price definition. -->\n",
        "docs/requirements/pricing.md": "## Sale Price {#sale-price}\n",
        "src/index.ts": "export {};\n",
      },
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
     * Package-population.
     *
     * @evidence contracts/testing.md#behavioral-verification The installed @org/api declaration namespace exposes question and review get functions; only question is cited. Its verify callback checks Failure, the uncited functional.reviews.get finding and both neutral acknowledgement repair alternatives.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Package-population-complete adds the missing review view against identical installed bytes.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Actual package exports/types resolution must feed native package-reference inventories. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_reference_selects_an_installed_package",
    props: {
      nativeProducer: "snapshot",
      name: "package-population",
      include: ["src"],
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**"],\n    symbol: "function",\n    reference: {\n      type: "typescript",\n      package: "@org/api",\n      symbol: "function",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "node_modules/@org/api/package.json":
          '{\n  "name": "@org/api",\n  "version": "1.0.0",\n  "main": "./lib/index.js",\n  "exports": {\n    ".": {\n      "types": "./lib/index.d.ts",\n      "default": "./lib/index.js"\n    }\n  }\n}',
        "node_modules/@org/api/lib/index.js":
          "export * from './functional.js';\n",
        "node_modules/@org/api/lib/index.d.ts":
          'export * as functional from "./functional.js";\n',
        "node_modules/@org/api/lib/functional.d.ts":
          'export * as questions from "./questions.js";\nexport * as reviews from "./reviews.js";\n',
        "node_modules/@org/api/lib/questions.d.ts":
          "export declare function get(): void;\n",
        "node_modules/@org/api/lib/reviews.d.ts":
          "export declare function get(): void;\n",
        "src/question.ts":
          'import type * as api from "@org/api";\n\n/**\n * @evidence {@link api.functional.questions.get} Renders the question operation.\n */\nexport function question(): void {}\n',
      },
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
     * Package-population-complete.
     *
     * @evidence contracts/testing.md#behavioral-verification Question and review views cite both accessor paths in the same installed @org/api declarations. Its verify callback checks Status 0.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases The incomplete package counterpart omits the review citation only.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Installed package declaration discovery and both namespace accessor bindings must connect. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_reference_selects_an_installed_package",
    props: {
      nativeProducer: "snapshot",
      name: "package-population-complete",
      include: ["src"],
      lintConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";\n\nconst graph: ITtscEvidenceGraphConfig = {\n  claims: [{\n    type: "typescript",\n    files: ["src/**"],\n    symbol: "function",\n    reference: {\n      type: "typescript",\n      package: "@org/api",\n      symbol: "function",\n    },\n  }],\n};\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: { "evidence/graph": ["error", graph] },\n} satisfies ITtscLintConfig;\n',
      files: {
        "node_modules/@org/api/package.json":
          '{\n  "name": "@org/api",\n  "version": "1.0.0",\n  "main": "./lib/index.js",\n  "exports": {\n    ".": {\n      "types": "./lib/index.d.ts",\n      "default": "./lib/index.js"\n    }\n  }\n}',
        "node_modules/@org/api/lib/index.js":
          "export * from './functional.js';\n",
        "node_modules/@org/api/lib/index.d.ts":
          'export * as functional from "./functional.js";\n',
        "node_modules/@org/api/lib/functional.d.ts":
          'export * as questions from "./questions.js";\nexport * as reviews from "./reviews.js";\n',
        "node_modules/@org/api/lib/questions.d.ts":
          "export declare function get(): void;\n",
        "node_modules/@org/api/lib/reviews.d.ts":
          "export declare function get(): void;\n",
        "src/question.ts":
          'import type * as api from "@org/api";\n\n/**\n * @evidence {@link api.functional.questions.get} Renders the question operation.\n */\nexport function question(): void {}\n',
        "src/review.ts":
          'import type * as api from "@org/api";\n\n/**\n * @evidence {@link api.functional.reviews.get} Renders the review operation.\n */\nexport function review(): void {}\n',
      },
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
     * Singular-config-included.
     *
     * @evidence contracts/testing.md#behavioral-verification The original include list selects src and anonymous lint.config.ts with singular enabled. Its verify callback checks Failure and An anonymous default export has no name.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Singular-declarations excludes its config while retaining a multi-identity declaration file.
     * @evidence contracts/testing.md#execution-ownership test_evidence_file_rules_share_one_consumer_check selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Actual Program config membership must reach the native anonymous-default branch. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_file_rules_share_one_consumer_check; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_singular_reports_included_config_file",
    props: {
      nativeProducer: "snapshot",
      name: "singular-config-included",
      include: ["src", "lint.config.ts"],
      lintConfig:
        'import { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/singular": "error",\n  },\n};\n',
      files: {
        "src/handler.ts": "export const handler = (): void => {};\n",
      },
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
     * Singular-declarations.
     *
     * @evidence contracts/testing.md#behavioral-verification A multi-interface ambient.d.ts and named handler are selected while the config is excluded. Its verify callback checks Status 0 and no evidence/singular finding.
     * @evidence contracts/testing.md#independent-expectations The authored contract and literal target/diagnostic expectations above determine this verdict; no observed output supplies an expected value.
     * @evidence contracts/testing.md#distinguishing-cases Singular-config-included supplies the anonymous included-config refusal.
     * @evidence contracts/testing.md#execution-ownership test_evidence_consumer_batch_accepts_complete_graphs selects this E2E scene and invokes its callback through ConsumerBatch.verify. The entry field records its original owner; this table item is not independently selectable.
     * @evidence contracts/e2e.md#necessary-boundary Actual declaration-file identity and original include membership must govern native file-rule exclusion. Direct rule calls cannot certify this configuration/compiler/parser connection.
     * @evidence contracts/e2e.md#shared-execution Its caller owns one initial CLI check and one actual SDK-selected native protocol session for twenty scenes; this scene adds a rule reload and fresh SDK registration lookup, not another installation or Program load when the actual tuple matches.
     * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint scene roots and one active original graph separate aliases and schemas; original include membership is materialized before the fixed Program starts. Changed executable bytes/manifest/context retire the joined host. The caller joins process closure and invokes the prepared project's cleanup on success or failure.
     * @evidence contracts/e2e.md#preserved-coverage The callback below retains this scene's original status and text assertions in test_evidence_consumer_batch_accepts_complete_graphs; no unverified unit counterpart replaces them. Physical location expectations alone follow relocated fixtures, and the scene name identifies collected failures.
     */
    entry: "test_evidence_singular_skips_declaration_files",
    props: {
      nativeProducer: "snapshot",
      name: "singular-declarations",
      include: ["src"],
      lintConfig:
        'import { evidence } from "@ttsc/evidence";\n\nexport default {\n  plugins: { "evidence": evidence },\n  rules: {\n    "evidence/singular": "error",\n  },\n};\n',
      files: {
        "src/ambient.d.ts":
          "export interface IAlpha {\n  id: string;\n}\nexport interface IBeta {\n  id: string;\n}\n",
        "src/handler.ts": "export const handler = (): void => {};\n",
      },
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
