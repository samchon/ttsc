import fs from "node:fs";
import path from "node:path";

/** Absolute, sorted list of the project's `src/*.ts` modules. */
export function projectModules(root: string): string[] {
  const srcDir = path.join(root, "src");
  return fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => path.join(srcDir, name));
}
