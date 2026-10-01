import type { ITtscLintConfig } from "@ttsc/lint";
import {
  evidence,
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphMarkdownReference,
} from "@ttsc/evidence";

// The option is declared on the Markdown reference rather than on the shared
// base, because no other population is read one item at a time.
const reference: ITtscEvidenceGraphMarkdownReference = {
  type: "markdown",
  files: ["docs/rules.md"],
  symbol: "h2",
  checklist: true,
};

const graph: ITtscEvidenceGraphConfig = {
  claims: [{
    type: "typescript",
    files: ["src/**"],
    symbol: "function",
    reference,
  }],
};

export default {
  plugins: { evidence },
  rules: { "evidence/graph": ["error", graph] },
} satisfies ITtscLintConfig;
