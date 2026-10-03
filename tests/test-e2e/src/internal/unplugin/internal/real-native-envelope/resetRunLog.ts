import fs from "node:fs";

/** Reset the observer without introducing a file under the project root. */
export function resetRunLog(runLog: string): void {
  fs.writeFileSync(runLog, Buffer.alloc(0));
}
