import {
  type ITtscEvidenceProject,
  assertStatus,
  createProject,
  runCheck,
} from "../internal/index";

/**
 * Verifies the optionless typing of `evidence/review` in a real consumer
 * config.
 *
 * A contributor rule that augments neither typing map falls back to an open
 * index signature whose options slot is `unknown`, so a consumer passing
 * options to an optionless rule gets no warning at all. The Go side declares
 * `AcceptsTtscLintOptions() false`, and a Go unit case pins that declaration,
 * but nothing there proves the TypeScript augmentation exists: the rule keeps
 * working either way, which is exactly why the contract is pinned from a
 * consumer.
 *
 * 1. Accept the bare severity form under `satisfies ITtscLintConfig`.
 * 2. Guard an options tuple with `@ts-expect-error`, which the compiler reports as
 *    an unused directive if the type does not in fact reject it.
 * 3. Assert `ttsc check` exits clean, meaning the rejection happened.
 */
export const test_evidence_review_typing_rejects_options = (): void => {
  const project: ITtscEvidenceProject = createProject({
    name: "review-typing",
    lintConfig: [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      'import { evidence } from "@ttsc/evidence";',
      "",
      "const accepted = {",
      '  plugins: { "evidence": evidence },',
      '  files: ["src/**"],',
      '  rules: { "evidence/review": "error" },',
      "} satisfies ITtscLintConfig;",
      "",
      "const rejected = {",
      '  plugins: { "evidence": evidence },',
      '  files: ["src/**"],',
      "  rules: {",
      "    // @ts-expect-error an optionless rule must not accept an options slot",
      '    "evidence/review": ["error", { anything: true }],',
      "  },",
      "} satisfies ITtscLintConfig;",
      "",
      "void rejected;",
      "",
      "export default accepted;",
      "",
    ].join("\n"),
    files: {
      "src/handler.ts": ["export const handler = (): void => {};", ""].join(
        "\n",
      ),
    },
  });
  try {
    const result = runCheck(project.directory);
    assertStatus(
      result,
      0,
      "The optionless augmentation must reject an options slot, and the bare severity form must stay valid.",
    );
  } finally {
    project.cleanup();
  }
};
