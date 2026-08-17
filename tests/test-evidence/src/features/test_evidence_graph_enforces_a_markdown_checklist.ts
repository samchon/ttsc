import {
  type ITtscEvidenceProject,
  assertFailure,
  assertIncludes,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";

const lintConfig: string = [
  'import type { ITtscLintConfig } from "@ttsc/lint";',
  "import {",
  "  evidence,",
  "  type ITtscEvidenceGraphConfig,",
  "  type ITtscEvidenceGraphMarkdownReference,",
  '} from "@ttsc/evidence";',
  "",
  "// The option is declared on the Markdown reference rather than on the shared",
  "// base, because no other population is read one item at a time.",
  "const reference: ITtscEvidenceGraphMarkdownReference = {",
  '  type: "markdown",',
  '  files: ["docs/rules.md"],',
  '  symbol: "h2",',
  "  checklist: true,",
  "};",
  "",
  "const graph: ITtscEvidenceGraphConfig = {",
  "  claims: [{",
  '    type: "typescript",',
  '    files: ["src/**"],',
  '    symbol: "function",',
  "    reference,",
  "  }],",
  "};",
  "",
  "export default {",
  "  plugins: { evidence },",
  '  rules: { "evidence/graph": ["error", graph] },',
  "} satisfies ITtscLintConfig;",
  "",
].join("\n");

const rules: string = [
  "## No hardcoding {#no-hardcoding}",
  "",
  "Fix the general logic instead of special-casing a fixture.",
  "",
  "## No whack-a-mole {#no-whack-a-mole}",
  "",
  "Seal the class of failure rather than the witness.",
  "",
].join("\n");

/**
 * Verifies the Markdown checklist obligation through the published real binary.
 *
 * Native tests pin each evaluator branch; this consumer proves the option is
 * exported on the Markdown reference type, that the `checklist` JSON name
 * survives config loading, and that the shipped Go contributor emits both
 * checklist diagnostics — the per-host shortfall and the aggregate refusal that
 * stops one document-wide citation from ticking every box.
 *
 * 1. Run a checklist against a host that answered one item and a host that cited
 *    the whole document.
 * 2. Assert the per-host shortfall and the aggregate refusal both reach `ttsc`.
 * 3. Answer every item on every host, one by citation and one by exclusion, and
 *    assert the same configuration passes.
 */
export const test_evidence_graph_enforces_a_markdown_checklist = (): void => {
  const rejected: ITtscEvidenceProject = createProject({
    name: "markdown-checklist-rejected",
    lintConfig,
    files: {
      "docs/rules.md": rules,
      "src/partial.ts": [
        "/** @evidence docs/rules.md#no-hardcoding The general logic decides. */",
        "export function partial(): void {}",
        "",
      ].join("\n"),
      "src/broad.ts": [
        "/** @evidence docs/rules.md Everything in here is honored. */",
        "export function broad(): void {}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(rejected.directory);
    assertFailure(
      result,
      "A checklist must judge every host against every item.",
    );
    assertIncludes(
      result,
      "has not acknowledged 1 of 2 checklist item(s)",
      "The per-host shortfall must survive the native config boundary.",
    );
    assertIncludes(
      result,
      "Aggregate @evidence target 'docs/rules.md'",
      "A document-wide citation must not answer the items beneath it.",
    );
    assertIncludes(
      result,
      "Cite each item this host answers for",
      "The aggregate refusal must name its repair.",
    );
  } finally {
    rejected.cleanup();
  }

  const accepted: ITtscEvidenceProject = createProject({
    name: "markdown-checklist-accepted",
    lintConfig,
    files: {
      "docs/rules.md": rules,
      "src/first.ts": [
        "/**",
        " * @evidence docs/rules.md#no-hardcoding The general logic decides.",
        " * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.",
        " */",
        "export function first(): void {}",
        "",
      ].join("\n"),
      "src/second.ts": [
        "/**",
        " * @evidence docs/rules.md#no-hardcoding The general logic decides here too.",
        " * @evidenceExclude docs/rules.md#no-whack-a-mole This helper has one case.",
        " */",
        "export function second(): void {}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(accepted.directory);
    assertStatus(
      result,
      0,
      "Every host answering every item must satisfy the checklist.",
    );
  } finally {
    accepted.cleanup();
  }
};
