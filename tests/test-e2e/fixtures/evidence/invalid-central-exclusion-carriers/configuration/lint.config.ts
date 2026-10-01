import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence } from "@ttsc/evidence";

export default {
  plugins: { evidence },
  rules: {
    "evidence/graph": ["error", { claims: [
      {
        type: "typescript",
        files: ["src/CONTROLLER_EVIDENCE_EXCLUDE.ts"],
        symbol: "function",
        reference: {
          type: "markdown",
          files: ["docs/contract.md"],
          symbol: "h2",
        },
      },
      {
        type: "prisma",
        files: ["prisma/**/*.prisma", "prisma/exclude.schema"],
        symbol: "model",
        reference: {
          type: "markdown",
          files: ["docs/schema.md"],
          symbol: "h2",
        },
      },
    ] }],
  },
} satisfies ITtscLintConfig;
