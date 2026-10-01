import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      type: "typescript",
      files: ["src/components/**/*.tsx"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/**/*.md"],
        symbol: ["h2", "h3"],
      },
    },
  ],
};

export default {
  plugins: {
    "evidence": evidence,
  },
  rules: {
    "evidence/graph": ["error", graph],
    "evidence/documented": "error",
    "evidence/singular": "error",
    "evidence/todo": "error",
  },
} satisfies ITtscLintConfig;
