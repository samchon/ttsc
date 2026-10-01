import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [{
    type: "typescript",
    name: "Order contract",
    files: ["src/**/*.ts"],
    symbol: "function",
    reference: {
      type: "markdown",
      files: ["docs/**/*.md"],
      symbol: "h2",
    },
  }],
};

export default {
  plugins: { "evidence": evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
