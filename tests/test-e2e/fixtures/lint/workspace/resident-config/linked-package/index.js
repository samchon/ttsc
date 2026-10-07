import fs from "node:fs";
fs.appendFileSync(process.env.TTSC_RESIDENT_LINKED_EVALUATIONS, "evaluation\n");
export default { file: "docs/linked-before.md" };
