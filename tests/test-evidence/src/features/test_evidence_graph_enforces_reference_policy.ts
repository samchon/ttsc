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
  "  type ITtscEvidenceGraphReferenceBase,",
  '} from "@ttsc/evidence";',
  "",
  "const reference: ITtscEvidenceGraphMarkdownReference = {",
  '  type: "markdown",',
  '  files: ["docs/spec.md"],',
  '  symbol: "h2",',
  "  noEvidenceExclude: true,",
  "  uniqueEvidence: true,",
  "  singleEvidencePerSymbol: true,",
  "  noAggregateEvidence: true,",
  '  role: "implements",',
  "};",
  "",
  "// Every reference kind extends the same base, so the strict options are",
  "// declared once and a concrete population still satisfies the shared shape.",
  'const base: ITtscEvidenceGraphReferenceBase<"markdown"> = reference;',
  "void base;",
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

/**
 * Verifies the reference policy options through the published real binary.
 *
 * Native tests pin each evaluator branch against raw JSON, so nothing there
 * would notice a published property whose spelling and decode key disagree.
 * This consumer proves the option shape is exported and flat on the reference,
 * that every one of its JSON names survives config loading, that the shipped Go
 * contributor emits the actionable diagnostics, and that a fully satisfied twin
 * passes.
 *
 * 1. Run a typed strict reference against one exclusion on a silent host.
 * 2. Assert the refusal, the per-symbol count, and the missing-coverage repair all
 *    reach `ttsc`.
 * 3. Pair two hosts with two sections one-to-one and assert the same policy
 *    passes.
 */
export const test_evidence_graph_enforces_reference_policy = (): void => {
  const rejected: ITtscEvidenceProject = createProject({
    name: "reference-policy-rejected",
    lintConfig,
    files: {
      "docs/spec.md": "## Contract {#contract}\n",
      "src/rejected.ts": [
        "/** @evidenceExclude docs/spec.md#contract No implementation. */",
        "export function rejected(): void {}",
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runCheck(rejected.directory);
    assertFailure(result, "A strict reference must reject an exclusion.");
    assertIncludes(
      result,
      "noEvidenceExclude requires positive @evidence",
      "The refusal must survive the native config boundary.",
    );
    assertIncludes(
      result,
      "singleEvidencePerSymbol requires exactly 1",
      "The selected function must be counted even though it has no positive tag.",
    );
    assertIncludes(
      result,
      "this reference forbids @evidenceExclude",
      "A refused exclusion must leave ordinary coverage missing.",
    );
    assertIncludes(
      result,
      "naming the 'implements' relation",
      "A declared relation must survive the native config boundary too.",
    );
    assertIncludes(
      result,
      "noAggregateEvidence is set here",
      "Every declared option must reach the repair the author reads.",
    );
  } finally {
    rejected.cleanup();
  }

  const accepted: ITtscEvidenceProject = createProject({
    name: "reference-policy-accepted",
    lintConfig,
    files: {
      "docs/spec.md": "## Contract {#contract}\n\n## Pricing {#pricing}\n",
      "src/first.ts": [
        "/** @evidence(implements) docs/spec.md#contract Implements the contract. */",
        "export function first(): void {}",
        "",
      ].join("\n"),
      "src/second.ts": [
        "/** @evidence(implements) docs/spec.md#pricing Implements the pricing rule. */",
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
      "One host per unit must satisfy the complete strict policy.",
    );
  } finally {
    accepted.cleanup();
  }
};
