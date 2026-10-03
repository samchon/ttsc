import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "sale-types",
      type: "typescript",
      files: ["src/Sale.ts"],
      symbol: "type",
      reference: {
        type: "markdown",
        files: ["docs/subject.md"],
        symbol: "h2",
      },
    },
  ],
};

export default {
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
