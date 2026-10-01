import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [{
    type: "typescript",
    files: ["src/views/**"],
    symbol: "function",
    reference: {
      type: "typescript",
      files: ["src/api/**"],
      symbol: "function",
    },
  }],
};

export default {
  plugins: { "evidence": evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
