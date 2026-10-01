import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [{
    type: "prisma",
    files: ["prisma/**/*.prisma"],
    symbol: "model",
    reference: {
      type: "markdown",
      files: ["docs/requirements.md"],
      symbol: "h2",
    },
  }],
};

export default {
  plugins: { "evidence": evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
