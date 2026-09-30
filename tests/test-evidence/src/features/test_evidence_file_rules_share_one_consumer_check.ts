import { graphTypingConfigurations } from "../internal/graphTypingConfigurations";
import {
  assertExcludes,
  assertFailure,
  assertIncludes,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies packaged evidence file rules in one consumer and one compiler run.
 *
 * The nine semantic fixtures also run directly against their Go rules. Here
 * scoped config entries preserve each fixture's options and file scope while
 * one installed contributor proves registration, JSON option transport, exit
 * status and source-anchored diagnostic rendering for the whole batch.
 *
 * 1. Materialize all unchanged fixtures under isolated source subdirectories.
 * 2. Check the shared project once with each fixture's original rule setting.
 * 3. Compile both optionless typing controls and all typed config entries.
 * 4. Assert every original diagnostic and every clean fixture's silence.
 */
export const test_evidence_file_rules_share_one_consumer_check = (): void => {
  const cases = [
    {
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
  const project = createProject({
    name: "file-rules-batch",
    include: ["src", "lint.config.ts", "batch-*.ts", "graph-typing-*.ts"],
    compilerOptions: { pretty: false },
    lintConfig: [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      'import { evidence } from "@ttsc/evidence";',
      "export default { plugins: { evidence }, extends: " +
        JSON.stringify("./" + previous) +
        " } satisfies ITtscLintConfig;",
    ].join("\n"),
    files,
  });
  try {
    const result = runCheck(project.directory);
    const failures: Error[] = [];
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
      assertFailure(
        result,
        "The batch's negative fixtures must fail the consumer check.",
      ),
    );
    for (const config of ["lint.config.ts", ...typedConfigurations])
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
      /(?=^[^\r\n]+(?:\(\d+,\d+\):|:\d+:\d+\s+-))/m,
    );
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
    if (failures.length)
      throw new AggregateError(
        failures,
        "Batched evidence consumer assertions failed",
      );
  } finally {
    project.cleanup();
  }
};
