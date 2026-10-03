import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** Public preload specifier exercised by the register end-to-end tests. */
export const TTSX_REGISTER = "ttsc/register";

/** Mocha's JavaScript entry, resolved from the test package that owns it. */
export const MOCHA_BIN = createRequire(import.meta.url).resolve(
  "mocha/bin/mocha.js",
);

/** Link the built workspace ttsc package into an isolated consumer project. */
export function linkTtscPackage(root: string): void {
  const modules = path.join(root, "node_modules");
  const link = path.join(modules, "ttsc");
  fs.mkdirSync(modules, { recursive: true });
  fs.symlinkSync(
    path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc"),
    link,
    "junction",
  );
}
