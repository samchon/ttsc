import type { ITtscLintConfig } from "@ttsc/lint";
import {
  evidence,
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphMarkdownReference,
  type ITtscEvidenceGraphReferenceBase,
} from "@ttsc/evidence";

const reference: ITtscEvidenceGraphMarkdownReference = {
  type: "markdown",
  files: ["docs/spec.md"],
  symbol: "h2",
  noEvidenceExclude: true,
  uniqueEvidence: true,
  singleEvidencePerSymbol: true,
};

// Every reference kind extends the same base, so the strict options are
// declared once and a concrete population still satisfies the shared shape.
const base: ITtscEvidenceGraphReferenceBase<"markdown"> = reference;
void base;

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
