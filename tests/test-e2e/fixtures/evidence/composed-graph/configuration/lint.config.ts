import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      type: "markdown",
      files: ["docs/analysis.md"],
      symbol: "h2",
      reference: { type: "markdown", files: ["docs/requirements.md"], symbol: "h2" },
    },
    {
      type: "markdown",
      files: ["docs/architecture.md"],
      symbol: "h2",
      reference: { type: "markdown", files: ["docs/requirements.md"], symbol: "h2" },
    },
    {
      type: "typescript",
      files: ["src/components/**/*.tsx"],
      symbol: "function",
      reference: { type: "markdown", files: ["docs/features.md"], symbol: "h2" },
    },
    {
      type: "typescript",
      files: ["src/features/**/*.ts"],
      symbol: "function",
      reference: [
        { type: "markdown", files: ["docs/features.md"], symbol: "h2" },
        { type: "typescript", files: ["src/components/**/*.tsx"], symbol: "function" },
      ],
    },
  ],
};

export default {
  plugins: { "evidence": evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
