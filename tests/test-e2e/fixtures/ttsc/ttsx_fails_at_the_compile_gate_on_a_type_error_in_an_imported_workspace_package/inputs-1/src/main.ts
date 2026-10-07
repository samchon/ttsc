import { hello } from "ws-dep";
import { writeFileSync } from "node:fs";
writeFileSync(process.env.TTSX_MARKER, "executed");
const message: string = 123;
console.log("should-not-run", message, hello());
