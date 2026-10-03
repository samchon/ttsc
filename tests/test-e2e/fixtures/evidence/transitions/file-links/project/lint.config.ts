import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";
export default { plugins: { evidence }, rules: { "evidence/graph": ["error", { claims: [
{ type: "markdown", files: ["docs/review.md"], symbol: "h2", reference: { type: "typescript", root: "../api", files: ["*.ts"], symbol: ["function", "property"] } },
{ type: "typescript", files: ["src/review.ts"], symbol: "type", reference: { type: "typescript", root: "../api", files: ["*.ts"], symbol: ["function", "property"] } }
] }] } } satisfies ITtscLintConfig;
