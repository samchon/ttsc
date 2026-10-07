import fs from "node:fs";

/** Count linked ApplyProgram calls from the one-byte append protocol. */
export function programRuns(runLog: string): number {
  return fs.existsSync(runLog) ? fs.statSync(runLog).size : 0;
}
