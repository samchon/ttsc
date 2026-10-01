import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [{
    type: "typescript",
    files: ["src/**/*.ts"],
    symbol: "type",
    reference: {
      type: "prisma",
      files: ["prisma/**/*.prisma"],
      symbol: ["model", "column", "relation"],
    },
  }],
};

export default {
  plugins: { "evidence": evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
