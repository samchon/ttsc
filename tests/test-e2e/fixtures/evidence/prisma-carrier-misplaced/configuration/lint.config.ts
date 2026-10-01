import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "models",
      type: "prisma",
      root: "..",
      files: ["schema/**/*.prisma", "schema/exclude.schema"],
      evidenceExcludeCarriers: ["schema/exclude.schema"],
      symbol: "model",
      reference: {
        type: "markdown",
        root: "..",
        files: ["docs/spec.md"],
        symbol: "h2",
      },
    },
  ],
};

export default {
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
