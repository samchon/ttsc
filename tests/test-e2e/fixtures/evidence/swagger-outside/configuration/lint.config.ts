import type { ITtscLintConfig } from "@ttsc/lint";
import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";

const graph: ITtscEvidenceGraphConfig = {
  claims: [{
    type: "typescript",
    files: ["src/**/*.ts"],
    symbol: "type",
    reference: {
      type: "swagger",
      file: "../contracts/swagger.yaml",
    },
  }],
};

export default {
  plugins: { "evidence": evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
