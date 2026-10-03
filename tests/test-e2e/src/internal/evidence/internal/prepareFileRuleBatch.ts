import { ConsumerBatch } from "./ConsumerBatch";
import { EvidenceConsumerCorpus } from "./EvidenceConsumerCorpus";
import { graphTypingConfigurations } from "./graphTypingConfigurations";

/**
 * Assembles the immutable file-rule and negative consumer corpus before its
 * shared Program loads.
 *
 * @evidence contracts/common.md#principled-implementation Original literal sources, typed options and diagnostic expectations remain coupled to their named cases; assembly performs no compiler operation or verdict assertion.
 * @evidence contracts/common.md#clear-and-simple-design Returns one corpus and its independent assertion inputs so the shared consumer can write all files before creating its Program.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No response or expected diagnostic is derived from the implementation; original fixture bytes and explicit controls remain inputs.
 * @evidence contracts/common.md#meaningful-documentation States preparation ownership and the need to finish source membership before host creation.
 * @evidence contracts/portability.md#os-neutral-implementation Fixture paths use the existing confined reader and assembly operations; no native executable or shell runs here.
 * @evidence contracts/performance.md#efficient-algorithms Visits each fixture file and authored case once, producing finite configuration entries and assertion metadata.
 * @evidence contracts/performance.md#reuse-equivalent-work One prepared input population can join the default positive compiler family; its caller owns current producer identity and session validity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Retains only the authored input table and named expectations; the shared outer caller owns actual process and fixture cleanup.
 */
export function prepareEvidenceFileRuleBatch(): {
  batch: ReturnType<typeof ConsumerBatch.assemble>;
  cases: readonly {
    name: string;
    rule: string;
    files: Record<string, string>;
    includes: readonly string[];
    excludes: readonly string[];
    passes: boolean;
    options?: unknown;
    typingConfig?: string;
  }[];
  typedConfigurations: string[];
} {
  const cases = [
    {
      /**
       * Verifies documented narrows to selected symbols.
       *
       * Default selection in the undocumented cases must still diagnose
       * exported callables.
       *
       * 1. A documented ISale type has an undocumented member and sibling
       *    function, with symbol:type selected.
       * 2. Inspect this source prefix in the shared consumer CLI baseline.
       * 3. Its entire source prefix and evidence/documented findings are absent.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification):
       * A documented ISale type has an undocumented member and sibling
       * function, with symbol:type selected. Its entire source prefix and
       * evidence/documented findings are absent. Independent expectations
       * (contracts/testing.md#independent-expectations): The authored
       * declaration identities, tags and literal includes/excludes below
       * prescribe the findings independently of compiler output. Distinguishing
       * cases (contracts/testing.md#distinguishing-cases): Default selection in
       * the undocumented cases must still diagnose exported callables.
       * Execution ownership (contracts/testing.md#execution-ownership): This
       * dynamically registered E2E case runs through test_e2e_evidence and
       * case_evidence_file_rules_share_one_consumer_check and its actual CLI
       * baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual
       * installed Evidence descriptor, typed config where supplied, scoped lint
       * options and source-anchored CLI diagnostics connect here; direct Go
       * rule assertions cannot certify that transport. Shared execution
       * (contracts/e2e.md#shared-execution): Four file-rule cases share one
       * consumer and baseline CLI host; this item starts no separate install,
       * native link or process. Later graph-config phases reuse the same
       * captured contributor producer. State isolation and reuse validity
       * (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint
       * source prefix and scoped rule settings prevent neighboring declarations
       * deciding this case. All bytes/configs are written before checking; the
       * async outer caller joins its native sidecar and removes the exact
       * fixture after success or failure. Preserved coverage
       * (contracts/e2e.md#preserved-coverage): The baseline loop checks every
       * literal includes/excludes assertion below and requires source silence
       * for clean cases or an actual source-anchored error for failures. Both
       * optionless typed controls remain in the Program; earlier failures
       * accumulate without suppressing later cases.
       */
      name: "documented_narrows_to_selected_symbols",
      rule: "documented",
      options: {
        symbol: "type",
      },
      files: EvidenceConsumerCorpus.read(
        "evidence/evidence_file_rules_share_one_consumer_check/inputs-2",
      ),
      includes: [],
      excludes: ["evidence/documented"],
      passes: true,
    },
    {
      /**
       * Verifies documented reports empty block.
       *
       * The absent-block counterpart requires Missing JSDoc rather than Empty
       * JSDoc.
       *
       * 1. Documented parse and an empty JSDoc on render share src/parse.ts.
       * 2. Inspect this source prefix in the shared consumer CLI baseline.
       * 3. Empty JSDoc on exported function render and its source filename are
       *    present.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification):
       * Documented parse and an empty JSDoc on render share src/parse.ts. Empty
       * JSDoc on exported function render and its source filename are present.
       * Independent expectations
       * (contracts/testing.md#independent-expectations): The authored
       * declaration identities, tags and literal includes/excludes below
       * prescribe the findings independently of compiler output. Distinguishing
       * cases (contracts/testing.md#distinguishing-cases): The absent-block
       * counterpart requires Missing JSDoc rather than Empty JSDoc. Execution
       * ownership (contracts/testing.md#execution-ownership): This dynamically
       * registered E2E case runs through test_e2e_evidence and
       * case_evidence_file_rules_share_one_consumer_check and its actual CLI
       * baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual
       * installed Evidence descriptor, typed config where supplied, scoped lint
       * options and source-anchored CLI diagnostics connect here; direct Go
       * rule assertions cannot certify that transport. Shared execution
       * (contracts/e2e.md#shared-execution): Four file-rule cases share one
       * consumer and baseline CLI host; this item starts no separate install,
       * native link or process. Later graph-config phases reuse the same
       * captured contributor producer. State isolation and reuse validity
       * (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint
       * source prefix and scoped rule settings prevent neighboring declarations
       * deciding this case. All bytes/configs are written before checking; the
       * async outer caller joins its native sidecar and removes the exact
       * fixture after success or failure. Preserved coverage
       * (contracts/e2e.md#preserved-coverage): The baseline loop checks every
       * literal includes/excludes assertion below and requires source silence
       * for clean cases or an actual source-anchored error for failures. Both
       * optionless typed controls remain in the Program; earlier failures
       * accumulate without suppressing later cases.
       */
      name: "documented_reports_empty_block",
      rule: "documented",
      files: EvidenceConsumerCorpus.read(
        "evidence/evidence_file_rules_share_one_consumer_check/inputs-3",
      ),
      includes: ["Empty JSDoc on exported function 'render'", "src/parse.ts"],
      excludes: [],
      passes: false,
    },
    {
      /**
       * Verifies singular typing rejects options.
       *
       * The scalar severity and forbidden options tuple distinguish this
       * optionless public contract.
       *
       * 1. A typed singular config accepts error and declares an options tuple as
       *    an expected type error.
       * 2. Inspect this source prefix in the shared consumer CLI baseline.
       * 3. The accepted handler prefix and typed config diagnostics are absent;
       *    unused expect-error would be a compiler diagnostic.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification):
       * A typed singular config accepts error and declares an options tuple as
       * an expected type error. The accepted handler prefix and typed config
       * diagnostics are absent; unused expect-error would be a compiler
       * diagnostic. Independent expectations
       * (contracts/testing.md#independent-expectations): The authored
       * declaration identities, tags and literal includes/excludes below
       * prescribe the findings independently of compiler output. Distinguishing
       * cases (contracts/testing.md#distinguishing-cases): The scalar severity
       * and forbidden options tuple distinguish this optionless public
       * contract. Execution ownership
       * (contracts/testing.md#execution-ownership): This dynamically registered
       * E2E case runs through test_e2e_evidence and
       * case_evidence_file_rules_share_one_consumer_check and its actual CLI
       * baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual
       * installed Evidence descriptor, typed config where supplied, scoped lint
       * options and source-anchored CLI diagnostics connect here; direct Go
       * rule assertions cannot certify that transport. Shared execution
       * (contracts/e2e.md#shared-execution): Four file-rule cases share one
       * consumer and baseline CLI host; this item starts no separate install,
       * native link or process. Later graph-config phases reuse the same
       * captured contributor producer. State isolation and reuse validity
       * (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint
       * source prefix and scoped rule settings prevent neighboring declarations
       * deciding this case. All bytes/configs are written before checking; the
       * async outer caller joins its native sidecar and removes the exact
       * fixture after success or failure. Preserved coverage
       * (contracts/e2e.md#preserved-coverage): The baseline loop checks every
       * literal includes/excludes assertion below and requires source silence
       * for clean cases or an actual source-anchored error for failures. Both
       * optionless typed controls remain in the Program; earlier failures
       * accumulate without suppressing later cases.
       */
      name: "singular_typing_rejects_options",
      rule: "singular",
      files: EvidenceConsumerCorpus.read(
        "evidence/evidence_file_rules_share_one_consumer_check/inputs-10",
      ),
      includes: [],
      excludes: [],
      passes: true,
      typingConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceRules } from "@ttsc/evidence";\n\nconst accepted = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: { "evidence/singular": "error" },\n} satisfies ITtscLintConfig<ITtscEvidenceRules>;\n\nconst rejected = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: {\n    // @ts-expect-error an optionless rule must not accept an options slot\n    "evidence/singular": ["error", { anything: true }],\n  },\n} satisfies ITtscLintConfig<ITtscEvidenceRules>;\n\nvoid rejected;\n\nexport default accepted;\n',
    },
    {
      /**
       * Verifies review typing rejects options.
       *
       * This separately owns the review declaration rather than assuming
       * singular's type shape applies.
       *
       * 1. A typed review config accepts error and declares an options tuple as an
       *    expected type error.
       * 2. Inspect this source prefix in the shared consumer CLI baseline.
       * 3. The accepted handler prefix and typed config diagnostics are absent;
       *    unused expect-error would be a compiler diagnostic.
       *
       * Behavioral verification (contracts/testing.md#behavioral-verification):
       * A typed review config accepts error and declares an options tuple as an
       * expected type error. The accepted handler prefix and typed config
       * diagnostics are absent; unused expect-error would be a compiler
       * diagnostic. Independent expectations
       * (contracts/testing.md#independent-expectations): The authored
       * declaration identities, tags and literal includes/excludes below
       * prescribe the findings independently of compiler output. Distinguishing
       * cases (contracts/testing.md#distinguishing-cases): This separately owns
       * the review declaration rather than assuming singular's type shape
       * applies. Execution ownership
       * (contracts/testing.md#execution-ownership): This dynamically registered
       * E2E case runs through test_e2e_evidence and
       * case_evidence_file_rules_share_one_consumer_check and its actual CLI
       * baseline. The object is not an independently selected test export.
       * Necessary boundary (contracts/e2e.md#necessary-boundary): The actual
       * installed Evidence descriptor, typed config where supplied, scoped lint
       * options and source-anchored CLI diagnostics connect here; direct Go
       * rule assertions cannot certify that transport. Shared execution
       * (contracts/e2e.md#shared-execution): Four file-rule cases share one
       * consumer and baseline CLI host; this item starts no separate install,
       * native link or process. Later graph-config phases reuse the same
       * captured contributor producer. State isolation and reuse validity
       * (contracts/e2e.md#state-isolation-and-reuse-validity): Its disjoint
       * source prefix and scoped rule settings prevent neighboring declarations
       * deciding this case. All bytes/configs are written before checking; the
       * async outer caller joins its native sidecar and removes the exact
       * fixture after success or failure. Preserved coverage
       * (contracts/e2e.md#preserved-coverage): The baseline loop checks every
       * literal includes/excludes assertion below and requires source silence
       * for clean cases or an actual source-anchored error for failures. Both
       * optionless typed controls remain in the Program; earlier failures
       * accumulate without suppressing later cases.
       */
      name: "review_typing_rejects_options",
      rule: "review",
      files: EvidenceConsumerCorpus.read(
        "evidence/evidence_file_rules_share_one_consumer_check/inputs-11",
      ),
      includes: [],
      excludes: [],
      passes: true,
      typingConfig:
        'import type { ITtscLintConfig } from "@ttsc/lint";\nimport { evidence, type ITtscEvidenceRules } from "@ttsc/evidence";\n\nconst accepted = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: { "evidence/review": "error" },\n} satisfies ITtscLintConfig<ITtscEvidenceRules>;\n\nconst rejected = {\n  plugins: { "evidence": evidence },\n  files: ["src/**"],\n  rules: {\n    // @ts-expect-error an optionless rule must not accept an options slot\n    "evidence/review": ["error", { anything: true }],\n  },\n} satisfies ITtscLintConfig<ITtscEvidenceRules>;\n\nvoid rejected;\n\nexport default accepted;\n',
    },
  ];
  const files: Record<string, string> = {};
  const typedConfigurations: string[] = [];
  for (const [index, configuration] of graphTypingConfigurations.entries()) {
    const config = `graph-typing-${index}.ts`;
    files[config] = configuration.source;
    typedConfigurations.push(config);
  }
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
              " } satisfies ITtscLintConfig<ITtscEvidenceRules>;",
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
  const batch = ConsumerBatch.assemble(false, {
    files,
    include: ["src", "batch-*.ts", "graph-typing-*.ts"],
    previous,
  });
  return { batch, cases, typedConfigurations };
}
