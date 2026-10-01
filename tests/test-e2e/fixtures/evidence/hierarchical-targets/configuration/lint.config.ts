import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence } from "@ttsc/evidence";

export default {
  plugins: { "evidence": evidence },
  rules: {
    "evidence/graph": ["error", {
      claims: [
        {
          type: "typescript",
          files: ["src/implementation.ts"],
          symbol: "type",
          reference: { type: "markdown", files: ["docs/spec.md"], symbol: ["h2", "h3"] },
        },
        {
          type: "typescript",
          files: ["src/ledger.ts"],
          symbol: "type",
          reference: { type: "typescript", files: ["src/implementation.ts"], symbol: ["function", "property"] },
        },
      ],
    }],
  },
} satisfies ITtscLintConfig;
