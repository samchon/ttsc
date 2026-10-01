import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/**
 * Symlinks `packages/<name>` into `<root>/node_modules/@ttsc/<name>` so the
 * real utility plugin package is resolvable from the temporary project without
 * a full install. Mirrors the seeding the per-plugin suites use.
 */
export function seedUtilityPlugin(
  root: string,
  name: "banner" | "paths" | "strip",
): void {
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  const target = path.join(TestProject.WORKSPACE_ROOT, "packages", name);
  const link = path.join(linkDir, name);
  try {
    fs.symlinkSync(target, link, "junction");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}
