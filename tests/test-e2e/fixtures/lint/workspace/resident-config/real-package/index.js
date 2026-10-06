import fs from "node:fs";
fs.appendFileSync(process.env.TTSC_RESIDENT_REAL_EVALUATIONS, "evaluation\n");
export default { file: "docs/real-before.md" };
