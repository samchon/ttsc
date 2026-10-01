import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { ConsumerBatch } from "../internal/ConsumerBatch";
import { EvidenceProcessOwnership } from "../internal/EvidenceProcessOwnership";
import { graphDeclarationFixtures } from "../internal/graphDeclarationFixtures";
import { graphTypingConfigurations } from "../internal/graphTypingConfigurations";
import {
  assertExcludes,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";
import {
  type INativeCheckResult,
  startNativeCheck,
} from "../internal/startNativeCheck";

/**
 * Verifies file rules, declarations and twenty negative consumer variants in
 * one resident consumer.
 *
 * Portable file-rule owners and six declaration counterparts also run in Go
 * tests; the type-only namespace resolution scenario retains its assertions in
 * this batch. Here scoped config entries preserve each fixture's options and
 * file scope while one installed contributor and sequential native requests
 * prove registration, JSON option transport, exit status and source-anchored
 * diagnostic rendering for the whole batch.
 *
 * 1. Materialize all unchanged fixtures under isolated source subdirectories.
 * 2. Check the shared project once with each fixture's original rule setting.
 * 3. Compile both optionless typing controls and all typed config entries.
 * 4. Assert every original diagnostic and every clean fixture's silence.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual CLI baseline asserts every file-rule diagnostic, clean-prefix silence, typed option controls and seven declaration scenarios. SDK-selected native check-serve responses then select twenty original negative configurations and execute their literal callbacks. The merged identity retains its first-declaration address and discharged document; the type-only barrel retains its interface finding and absent class member.
 * @evidence contracts/testing.md#independent-expectations Literal original rule messages and explicitly authored source/citation identities supply the expected findings; the original typed expect-error configurations distinguish accepted from rejected option contracts.
 * @evidence contracts/testing.md#distinguishing-cases Documented merged, narrowed, empty and absent documentation; singular merged versus duplicate identities; review/todo findings; optionless typing controls; callable, destructured, ambient, auto-accessor and type-only namespace declaration shapes retain their separate assertions. Merged identity and type-only barrel fixtures keep their original positive/negative diagnostics.
 * @evidence contracts/testing.md#execution-ownership The test_evidence_file_rules_share_one_consumer_check export is discovered by test-evidence src/index.ts under src/features and selected as a function by tests/e2e/evidence.config.json. This E2E entry runs the real ttsc check against its linked consumer and owns the assertions in this function; helper callbacks run through this entry and are reviewed with its body rather than selected as independent cases.
 * @evidence contracts/e2e.md#necessary-boundary The published Evidence entry, lint descriptor, native contributor link, serialized options, real compiler/typechecking and source-anchored diagnostic rendering connect here; direct rule calls cannot prove those connections.
 * @evidence contracts/e2e.md#shared-execution One private consumer and authored contributor producer serve the actual CLI baseline and one native check-serve lifetime. Every phase freshly resolves the SDK registration and compares actual executable bytes, manifest and project context; PID/load assertions expose incompatible retirement. Only one original graph and its file-rule scope are active per response, so aliases and Prisma populations cannot merge. No fixture change recopies or rebuilds the authored lint package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every scene's files and selected config modules are materialized before the initial fixed Program loads. Only the existing excluded runtime root changes between graph phases; all original include patterns remain in the fixed corpus and no scope is created mid-session. Distinct local/external roots preserve selection. The async owner joins the native child before strict fixture removal, collecting body, child-close and removal failures separately.
 * @evidence contracts/e2e.md#preserved-coverage Every original file-rule includes/excludes assertion remains scoped to its scenario; clean file-rule prefixes retain compiler and rule silence. Seven declaration scenarios retain original source, imports and typed configs here. The original callable/destructured/ambient/accessor silence also runs in four semantic Go units; merged and type-only barrel semantics have direct Go units. Namespace resolution stays in this batch. Five unique uncited controls prevent vacuous success, while merged first-declaration location/discharged target and barrel interface/class distinctions keep their original literal assertions. The batch's nonzero status preserves each negative fixture's failure; assertions accumulate so one failure does not hide later checks.
 */
export async function test_evidence_file_rules_share_one_consumer_check(): Promise<void> {
  const cases = [
    {
      /**
       * Verifies documented accepts merged identities.
       *
       * The first-declaration negative case changes which merged declaration owns documentation.
       *
       * 1. Documented merged interface/namespace, class/namespace, overload and default identities accompany one undocumented type.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. The Undocumented finding is present while ISale, Something, format and evidence findings are absent.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): Documented merged interface/namespace, class/namespace, overload and default identities accompany one undocumented type. The Undocumented finding is present while ISale, Something, format and evidence findings are absent.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The first-declaration negative case changes which merged declaration owns documentation.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "documented_accepts_merged_identities",
      rule: "documented",
      files: {
        "src/ISale.ts":
          "/** A sale offered to a customer. */\nexport interface ISale {\n  /** Identifier of the sale. */\n  id: string;\n}\nexport namespace ISale {\n  /** Creation input. */\n  export interface ICreate {\n    /** Identifier of the sale. */\n    id: string;\n  }\n}\n",
        "src/Something.ts":
          '/** The exported service. */\nexport class Something {}\nexport namespace Something {\n  /** Current version. */\n  export const version = "1";\n}\n',
        "src/format.ts":
          "/** Renders a string for display. */\nexport function format(value: string): string;\n/** Renders a number for display. */\nexport function format(value: number): string;\n/** Renders either for display. */\nexport function format(value: string | number): string {\n  return String(value);\n}\n",
        "src/evidence.ts":
          '/** The exported descriptor. */\nexport const evidence = { name: "evidence" };\n/** The default export of this module. */\nexport default evidence;\n',
        "src/Undocumented.ts": "export interface Undocumented {}\n",
      },
      includes: ["Missing JSDoc on exported type 'Undocumented'"],
      excludes: ["'ISale'", "'Something'", "'format'", "'evidence'"],
      passes: false,
    },
    {
      /**
       * Verifies documented narrows to selected symbols.
       *
       * Default selection in the undocumented cases must still diagnose exported callables.
       *
       * 1. A documented ISale type has an undocumented member and sibling function, with symbol:type selected.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. Its entire source prefix and evidence/documented findings are absent.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): A documented ISale type has an undocumented member and sibling function, with symbol:type selected. Its entire source prefix and evidence/documented findings are absent.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): Default selection in the undocumented cases must still diagnose exported callables.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "documented_narrows_to_selected_symbols",
      rule: "documented",
      options: {
        symbol: "type",
      },
      files: {
        "src/ISale.ts":
          "/** A sale offered to a customer. */\nexport interface ISale {\n  price: number;\n}\n\nexport function total(sale: ISale): number {\n  return sale.price;\n}\n",
      },
      includes: [],
      excludes: ["evidence/documented"],
      passes: true,
    },
    {
      /**
       * Verifies documented reports empty block.
       *
       * The absent-block counterpart requires Missing JSDoc rather than Empty JSDoc.
       *
       * 1. Documented parse and an empty JSDoc on render share src/parse.ts.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. Empty JSDoc on exported function render and its source filename are present.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): Documented parse and an empty JSDoc on render share src/parse.ts. Empty JSDoc on exported function render and its source filename are present.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The absent-block counterpart requires Missing JSDoc rather than Empty JSDoc.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "documented_reports_empty_block",
      rule: "documented",
      files: {
        "src/parse.ts":
          "/** Normalizes a raw input value. */\nexport function parse(value: string): string {\n  return value;\n}\n\n/** */\nexport function render(value: string): string {\n  return value;\n}\n",
      },
      includes: ["Empty JSDoc on exported function 'render'", "src/parse.ts"],
      excludes: [],
      passes: false,
    },
    {
      /**
       * Verifies documented reports undocumented export.
       *
       * The empty-block counterpart has a block but no description.
       *
       * 1. Documented parse and unannotated render share src/parse.ts.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. Missing JSDoc on exported function render and the only-ever-read-from-a-JSDoc-block explanation are present.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): Documented parse and unannotated render share src/parse.ts. Missing JSDoc on exported function render and the only-ever-read-from-a-JSDoc-block explanation are present.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The empty-block counterpart has a block but no description.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "documented_reports_undocumented_export",
      rule: "documented",
      files: {
        "src/parse.ts":
          "/** Normalizes a raw input value. */\nexport function parse(value: string): string {\n  return value;\n}\n\nexport function render(value: string): string {\n  return value;\n}\n",
      },
      includes: [
        "Missing JSDoc on exported function 'render'",
        "only ever read from a JSDoc block",
      ],
      excludes: [],
      passes: false,
    },
    {
      /**
       * Verifies documented reports undocumented first declaration.
       *
       * The merged-positive fixture documents the identity's original declaration.
       *
       * 1. Undocumented first interface/class/property declarations are followed by documented merged or default declarations.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. ISale, Something and evidence each retain the literal Missing JSDoc finding.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): Undocumented first interface/class/property declarations are followed by documented merged or default declarations. ISale, Something and evidence each retain the literal Missing JSDoc finding.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The merged-positive fixture documents the identity's original declaration.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "documented_reports_undocumented_first_declaration",
      rule: "documented",
      files: {
        "src/ISale.ts":
          "export interface ISale {\n  /** Identifier of the sale. */\n  id: string;\n}\n/** A sale offered to a customer. */\nexport namespace ISale {\n  /** Creation input. */\n  export interface ICreate {\n    /** Identifier of the sale. */\n    id: string;\n  }\n}\n",
        "src/Something.ts":
          'export class Something {}\n/** The exported service. */\nexport namespace Something {\n  /** Current version. */\n  export const version = "1";\n}\n',
        "src/evidence.ts":
          'export const evidence = { name: "evidence" };\n/** The exported plugin descriptor. */\nexport default evidence;\n',
      },
      includes: [
        "Missing JSDoc on exported type 'ISale'",
        "Missing JSDoc on exported type 'Something'",
        "Missing JSDoc on exported property 'evidence'",
      ],
      excludes: [],
      passes: false,
    },
    {
      /**
       * Verifies singular accepts merged declarations.
       *
       * The second-identity counterpart exports alpha and beta separately.
       *
       * 1. Interface/namespace and class/namespace merges, a named default and a barrel retain one public identity per source.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. The entire source prefix and evidence/singular findings are absent.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): Interface/namespace and class/namespace merges, a named default and a barrel retain one public identity per source. The entire source prefix and evidence/singular findings are absent.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The second-identity counterpart exports alpha and beta separately.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "singular_accepts_merged_declarations",
      rule: "singular",
      files: {
        "src/ISomething.ts":
          "export interface ISomething {\n  id: string;\n}\nexport namespace ISomething {\n  export interface ICreate {\n    id: string;\n  }\n}\n",
        "src/Something.ts":
          'export class Something {}\nexport namespace Something {\n  export const version: string = "1";\n}\n',
        "src/handler.ts":
          "export const handler = (): void => {};\nexport default handler;\n",
        "src/index.ts":
          'export * from "./ISomething.js";\nexport * from "./Something.js";\nexport * from "./handler.js";\n',
      },
      includes: [],
      excludes: ["evidence/singular"],
      passes: true,
    },
    {
      /**
       * Verifies singular reports second identity.
       *
       * The merged counterpart distinguishes merged declarations from independent identities.
       *
       * 1. pair.ts exports alpha and beta while utils.ts exports only parseInput.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. The exactly-one-public-identity finding and Rename the file to parseInput.ts repair are present.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): pair.ts exports alpha and beta while utils.ts exports only parseInput. The exactly-one-public-identity finding and Rename the file to parseInput.ts repair are present.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The merged counterpart distinguishes merged declarations from independent identities.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "singular_reports_second_identity",
      rule: "singular",
      files: {
        "src/pair.ts": "export const alpha = 1;\nexport const beta = 2;\n",
        "src/utils.ts":
          "export function parseInput(value: string): string {\n  return value;\n}\n",
      },
      includes: [
        "declares exactly one public identity",
        "Rename the file to 'parseInput.ts'",
      ],
      excludes: [],
      passes: false,
    },
    {
      /**
       * Verifies review reports unreviewed citation.
       *
       * Accepted reviews and missing or mismatched reviews coexist in the same authored input.
       *
       * 1. Pricing and tax have matching review tags; refunds has none, orders uses the wrong tag and audit reviews an exclusion as evidence.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. Refunds/orders unreviewed findings, the refunds repair and audit mismatch are present; reviewed pricing/tax findings are absent.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): Pricing and tax have matching review tags; refunds has none, orders uses the wrong tag and audit reviews an exclusion as evidence. Refunds/orders unreviewed findings, the refunds repair and audit mismatch are present; reviewed pricing/tax findings are absent.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): Accepted reviews and missing or mismatched reviews coexist in the same authored input.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "review_reports_unreviewed_citation",
      rule: "review",
      files: {
        "src/ISale.ts":
          "/**\n * @evidence docs/spec.md#pricing Derives the sale price from this section.\n * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.\n * @evidence docs/spec.md#refunds Applies the refund window this section sets.\n */\nexport interface ISale {\n  price: number;\n}\n",
        "src/IOrder.ts":
          "/**\n * @evidence docs/spec.md#orders Places the order this section describes.\n * @evidenceReviewed docs/spec.md#orders Not this rule's tag.\n */\nexport interface IOrder {\n  id: string;\n}\n",
        "src/ITax.ts":
          "/**\n * @evidenceExclude docs/spec.md#tax The tax engine owns this, not this type.\n * @evidenceExcludeReview docs/spec.md#tax Read the section: every rule in it names a tax authority.\n * @evidenceExclude docs/spec.md#audit The audit log owns this.\n * @evidenceReview docs/spec.md#audit Filed under the wrong question.\n */\nexport interface ITax {\n  rate: number;\n}\n",
      },
      includes: [
        "Unreviewed @evidence for 'docs/spec.md#refunds'",
        "Unreviewed @evidence for 'docs/spec.md#orders'",
        "Add '@evidenceReview docs/spec.md#refunds",
        "Mismatched @evidenceReview for 'docs/spec.md#audit'",
      ],
      excludes: [
        "Unreviewed @evidence for 'docs/spec.md#pricing'",
        "Unreviewed @evidenceExclude for 'docs/spec.md#tax'",
      ],
      passes: false,
    },
    {
      /**
       * Verifies todo reports unrealized contract.
       *
       * The neighboring plural tag must remain ordinary prose.
       *
       * 1. parse has @todos while persist has the singular @todo wire the persistence layer.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. The exact todo content and Realize-the-declaration repair are present; tracked elsewhere is absent.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): parse has @todos while persist has the singular @todo wire the persistence layer. The exact todo content and Realize-the-declaration repair are present; tracked elsewhere is absent.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The neighboring plural tag must remain ordinary prose.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "todo_reports_unrealized_contract",
      rule: "todo",
      files: {
        "src/parse.ts":
          "/** @todos are tracked elsewhere */\nexport function parse(value: string): string {\n  return value;\n}\n\n/** @todo wire the persistence layer */\nexport function persist(value: string): string {\n  return value;\n}\n",
      },
      includes: [
        "Unrealized '@todo': 'wire the persistence layer'",
        "Realize the declaration and remove the tag",
      ],
      excludes: ["tracked elsewhere"],
      passes: false,
    },
    {
      /**
       * Verifies singular typing rejects options.
       *
       * The scalar severity and forbidden options tuple distinguish this optionless public contract.
       *
       * 1. A typed singular config accepts error and declares an options tuple as an expected type error.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. The accepted handler prefix and typed config diagnostics are absent; unused expect-error would be a compiler diagnostic.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): A typed singular config accepts error and declares an options tuple as an expected type error. The accepted handler prefix and typed config diagnostics are absent; unused expect-error would be a compiler diagnostic.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): The scalar severity and forbidden options tuple distinguish this optionless public contract.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "singular_typing_rejects_options",
      rule: "singular",
      files: {
        "src/handler.ts": "export const handler = (): void => {};\n",
      },
      includes: [],
      excludes: [],
      passes: true,
      typingConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nconst accepted = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: { "evidence/singular": "error" },\n} satisfies ITtscLintConfig;\n\nconst rejected = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: {\n    // @ts-expect-error an optionless rule must not accept an options slot\n    "evidence/singular": ["error", { anything: true }],\n  },\n} satisfies ITtscLintConfig;\n\nvoid rejected;\n\nexport default accepted;\n',
    },
    {
      /**
       * Verifies review typing rejects options.
       *
       * This separately owns the review declaration rather than assuming singular's type shape applies.
       *
       * 1. A typed review config accepts error and declares an options tuple as an expected type error.
       * 2. Run the canonical consumer CLI with this isolated source population.
       * 3. The accepted handler prefix and typed config diagnostics are absent; unused expect-error would be a compiler diagnostic.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification): A typed review config accepts error and declares an options tuple as an expected type error. The accepted handler prefix and typed config diagnostics are absent; unused expect-error would be a compiler diagnostic.
       * Independent expectations (contracts/testing.md#independent-expectations): The authored declaration identities, tags and literal includes/excludes below prescribe the findings independently of compiler output.
       * Distinguishing cases (contracts/testing.md#distinguishing-cases): This separately owns the review declaration rather than assuming singular's type shape applies.
       * Execution ownership (contracts/testing.md#execution-ownership): This dynamically registered E2E case runs through test_evidence_file_rules_share_one_consumer_check and its actual CLI baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual installed Evidence descriptor, typed config where supplied, scoped lint options and source-anchored CLI diagnostics connect here; direct Go rule assertions cannot certify that transport.
       * Shared execution (contracts/e2e.md#shared-execution): Eleven file-rule cases and seven declaration scenes share one consumer and baseline CLI host; this item starts no separate install, native link or process. The twenty later config phases reuse the same captured contributor producer.
       * State isolation and reuse validity (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint source prefix and scoped rule settings prevent neighboring declarations deciding this case. All bytes/configs are written before checking; the async outer caller joins its native sidecar and removes the exact fixture after success or failure.
       * Preserved coverage (contracts/e2e.md#preserved-coverage): The baseline loop checks every literal includes/excludes assertion below and requires source silence for clean cases or an actual source-anchored error for failures. Both optionless typed controls remain in the Program; earlier failures accumulate without suppressing later cases.
       */
      name: "review_typing_rejects_options",
      rule: "review",
      files: {
        "src/handler.ts": "export const handler = (): void => {};\n",
      },
      includes: [],
      excludes: [],
      passes: true,
      typingConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence } from "@ttsc/evidence";\n\nconst accepted = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: { "evidence/review": "error" },\n} satisfies ITtscLintConfig;\n\nconst rejected = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: {\n    // @ts-expect-error an optionless rule must not accept an options slot\n    "evidence/review": ["error", { anything: true }],\n  },\n} satisfies ITtscLintConfig;\n\nvoid rejected;\n\nexport default accepted;\n',
    },
  ];
  const files: Record<string, string> = {};
  const typedConfigurations: string[] = [];
  for (const [index, configuration] of graphTypingConfigurations.entries()) {
    const config = `graph-typing-${index}.ts`;
    files[config] = configuration.source;
    typedConfigurations.push(config);
  }
  const declarationClaims = graphDeclarationFixtures.flatMap((scenario) => {
    const root = "src/graph_" + scenario.name;
    for (const [relative, content] of Object.entries(scenario.files))
      files[root + "/" + relative] =
        content +
        (relative === scenario.control?.file ? scenario.control.source : "");
    const config = "graph-typing-" + scenario.name + ".ts";
    files[config] = scenario.typingConfig;
    typedConfigurations.push(config);
    return scenario.options.claims.map((claim) => ({
      ...claim,
      root,
      reference:
        claim.reference.type === "typescript"
          ? {
              ...claim.reference,
              files: claim.reference.files.map((file) => root + "/" + file),
            }
          : { ...claim.reference, root },
    }));
  });
  let previous: string | undefined;
  for (const [index, scenario] of cases.entries()) {
    for (const [relative, content] of Object.entries(scenario.files))
      files["src/" + scenario.name + "/" + relative] = content;
    const entry = {
      ...(previous === undefined ? {} : { extends: "./" + previous }),
      files: ["src/" + scenario.name + "/**"],
      rules: {
        ["evidence/" + scenario.rule]:
          scenario.options === undefined
            ? "error"
            : ["error", scenario.options],
      },
    };
    const config =
      "batch-" +
      index +
      (scenario.options === undefined && scenario.typingConfig === undefined
        ? ".json"
        : ".ts");
    files[config] =
      scenario.typingConfig !== undefined
        ? scenario.typingConfig.replace(
            "export default accepted;",
            "export default { ...accepted, " +
              JSON.stringify(entry).slice(1, -1) +
              " } satisfies ITtscLintConfig;",
          )
        : scenario.options === undefined
          ? JSON.stringify(entry)
          : [
              'import type { ITtscLintConfig } from "@ttsc/lint";',
              'import type { ITtscEvidenceDocumentedConfig } from "@ttsc/evidence";',
              "const documented = " +
                JSON.stringify(scenario.options) +
                " satisfies ITtscEvidenceDocumentedConfig;",
              "export default " +
                JSON.stringify(entry).replace(
                  JSON.stringify(scenario.options),
                  "documented",
                ) +
                " satisfies ITtscLintConfig;",
            ].join("\n");
    if (config.endsWith(".ts")) typedConfigurations.push(config);
    previous = config;
  }
  files["file-rules-types.ts"] = [
    'import type { ITtscLintConfig } from "@ttsc/lint";',
    'import { evidence } from "@ttsc/evidence";',
    'export default { plugins: { evidence }, rules: { "evidence/graph": ["error", ' +
      JSON.stringify({ claims: declarationClaims }) +
      "] }, extends: " +
      JSON.stringify("./" + previous) +
      " } satisfies ITtscLintConfig;",
  ].join("\n");
  typedConfigurations.push("file-rules-types.ts");
  const batch = ConsumerBatch.assemble(false, {
    files,
    include: ["src", "file-rules-types.ts", "batch-*.ts", "graph-typing-*.ts"],
    claims: declarationClaims,
    previous,
  });
  const project = createProject({
    ...batch,
    nativeProducer: "snapshot",
    name: "consumer-errors-batch",
    compilerOptions: { pretty: false },
  });
  const failures: unknown[] = [];
  const visited = new Set<string>();
  let session: ReturnType<typeof startNativeCheck> | undefined;
  try {
    const cliStarted = performance.now();
    const result = runCheck(project.directory);
    console.log(
      "Negative CLI baseline timing " +
        JSON.stringify({ milliseconds: performance.now() - cliStarted }),
    );
    const verify = (assertion: () => void): void => {
      try {
        assertion();
      } catch (error) {
        failures.push(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    };
    verify(() =>
      assertStatus(
        result,
        2,
        "The batch's negative fixtures must fail the consumer check.",
      ),
    );
    for (const config of typedConfigurations)
      verify(() =>
        assertExcludes(
          result,
          config,
          "Every typed configuration must compile without diagnostics, including both expect-error controls.",
        ),
      );
    const output = result.output
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replaceAll("\\", "/");
    const diagnostics = output.split(
      /(?=^(?:[^\r\n]*(?:\(\d+,\d+\):|:\d+:\d+\s+-)\s*)?(?:error|warning)\s+TS\d+:)/m,
    );
    for (const scenario of graphDeclarationFixtures) {
      const prefix = "src/graph_" + scenario.name + "/";
      const sourceDiagnostics = diagnostics.filter((diagnostic) => {
        const header = diagnostic.split(/\r?\n/, 1)[0]!;
        return (
          /(?:\(\d+,\d+\):|:\d+:\d+\s+-)/.test(header) &&
          header.includes(prefix)
        );
      });
      verify(() => {
        if (sourceDiagnostics.length !== 0)
          throw new Error(
            "Original declaration sources must remain free of source-anchored compiler and file-rule diagnostics.\n" +
              sourceDiagnostics.join("\n"),
          );
      });
      if (scenario.control !== null)
        verify(() => {
          const occurrences = output.split(scenario.control.finding).length - 1;
          if (occurrences !== 1)
            throw new Error(
              scenario.name +
                " must report its unique uncited control exactly once, got " +
                occurrences +
                "\n" +
                output,
            );
          const scopedFindings = diagnostics.filter(
            (diagnostic) =>
              diagnostic.includes("[evidence/graph]") &&
              diagnostic.includes(" at " + prefix),
          );
          if (scopedFindings.length !== 1)
            throw new Error(
              scenario.name +
                " must report only its uncited control; original cited targets must remain covered.\n" +
                scopedFindings.join("\n"),
            );
        });
      for (const expected of scenario.expectedIncludes ?? [])
        verify(() =>
          assertIncludes(
            result,
            expected.replace(" at src/", " at " + prefix + "src/"),
            scenario.name + " retains its original diagnostic.",
          ),
        );
      for (const unexpected of scenario.expectedExcludes ?? [])
        verify(() =>
          assertExcludes(
            result,
            unexpected,
            scenario.name + " retains its original negative assertion.",
          ),
        );
    }
    for (const scenario of cases) {
      const prefix = "src/" + scenario.name + "/";
      const selected = diagnostics.filter((diagnostic) =>
        diagnostic.split(/\r?\n/, 1)[0]!.includes(prefix),
      );
      const scoped = { ...result, output: selected.join("\n") };
      if (scenario.passes)
        verify(() =>
          assertExcludes(
            result,
            prefix,
            "A clean fixture must remain free of compiler and rule diagnostics.",
          ),
        );
      else if (selected.length === 0)
        failures.push(
          new Error(
            "No source-anchored diagnostic for " +
              scenario.name +
              "\n" +
              output,
          ),
        );
      if (
        !scenario.passes &&
        selected.length !== 0 &&
        !selected.some((diagnostic) =>
          /(?:\):\s*|\s+-\s+)error\s+/i.test(diagnostic.split(/\r?\n/, 1)[0]!),
        )
      )
        failures.push(
          new Error(
            "The negative fixture must contribute an error of its own: " +
              scenario.name +
              "\n" +
              scoped.output,
          ),
        );
      for (const expected of scenario.includes)
        verify(() =>
          assertIncludes(
            scoped,
            expected,
            "The original fixture's consumer diagnostic must survive batching.",
          ),
        );
      for (const unexpected of scenario.excludes)
        verify(() =>
          assertExcludes(
            scoped,
            unexpected,
            "The original fixture's negative assertion must survive batching.",
          ),
        );
    }
    session = startNativeCheck(project.directory);
    console.log(
      "Negative batch actual producer " +
        JSON.stringify({
          provenance: session.provenance,
          timing: session.preparationTiming,
        }),
    );
    let initial: INativeCheckResult | undefined;
    try {
      initial = await session.observe();
    } catch (error) {
      failures.push(new Error("Negative canonical initial observation failed.", {
        cause: error,
      }));
    }
    if (initial !== undefined) {
      const baseline = initial;
      console.log(
        "Negative canonical baseline actual observation " +
          JSON.stringify({
            status: baseline.status,
            telemetry: baseline.telemetry,
            registration: baseline.registration,
            timing: baseline.timing,
          }),
      );
      verify(() =>
        assertStatus(
          baseline,
          2,
          "The actual SDK-selected native contributor must preserve the canonical failure verdict.",
        ),
      );
      verify(() =>
        assert.equal(
          baseline.telemetry.programLoads,
          1,
          "The canonical baseline must load one actual native Program.",
        ),
      );
    }
    for (const phase of batch.phases) {
      const label = "Negative phase " + phase.scene.scenario.props.name;
      const phaseVerify = (assertion: () => void): void => {
        try {
          assertion();
        } catch (error) {
          failures.push(
            new Error(label + " assertion failed.", { cause: error }),
          );
        }
      };
      visited.add(phase.scene.scenario.props.name);
      try {
        EvidenceProcessOwnership.assertAvailable(project.directory);
        fs.writeFileSync(
          path.join(project.directory, "lint.config.ts"),
          phase.lintConfig,
          "utf8",
        );
        const config = path.join(project.directory, "lint.config.ts");
        const observed = await session.observe([config], [config]);
        if (initial === undefined) {
          initial = observed;
          phaseVerify(() => assert.equal(
            observed.telemetry.programLoads,
            1,
            label + " must load one real Program after joined retirement.",
          ));
        } else {
          const baseline = initial;
          phaseVerify(() =>
            assert.deepEqual(
              {
                pid: observed.telemetry.pid,
                programLoads: observed.telemetry.programLoads,
              },
              {
                pid: baseline.telemetry.pid,
                programLoads: baseline.telemetry.programLoads,
              },
              label +
                " must retain its actual native PID and Program load count.",
            ),
          );
          phaseVerify(() =>
            assert.deepEqual(
              {
                binary: observed.registration.binary,
                binaryDigest: observed.registration.binaryDigest,
                manifest: observed.registration.manifest,
                projectContext: observed.registration.projectContext,
              },
              {
                binary: baseline.registration.binary,
                binaryDigest: baseline.registration.binaryDigest,
                manifest: baseline.registration.manifest,
                projectContext: baseline.registration.projectContext,
              },
              label + " must retain its freshly resolved actual producer tuple.",
            ),
          );
        }
        console.log(
          label +
            " actual observation " +
            JSON.stringify({
              status: observed.status,
              telemetry: observed.telemetry,
              registration: observed.registration,
              timing: observed.timing,
            }),
        );
        phaseVerify(() =>
          assertStatus(
            observed,
            2,
            "The authored negative scene must retain its actual compiler verdict.",
          ),
        );
        ConsumerBatch.verify(observed, [phase.scene], phaseVerify);
      } catch (error) {
        failures.push(
          new Error(label + " could not be observed.", { cause: error }),
        );
      }
    }
  } catch (error) {
    failures.push(error);
    for (const phase of batch.phases)
      if (!visited.has(phase.scene.scenario.props.name))
        failures.push(new Error(
          "Negative phase " + phase.scene.scenario.props.name +
            " is blocked by batch initialization failure.",
          { cause: error },
        ));
  } finally {
    try {
      await session?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      project.cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Batched consumer observations and release failed.",
    );
}
