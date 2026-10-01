import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../../utils/src/TestProject";

import { LOADER } from "./LOADER";

/**
 * The package specifier and regular CommonJS/ESM fixture files whose manifests
 * establish loader ownership. No compiled loader is needed for this predicate.
 */
export const LOADER_IDENTITIES = [LOADER, ...loaderFixtures()];

function loaderFixtures(): string[] {
  const root = TestProject.tmpdir("ttsc-next-loader-owner-");
  fs.mkdirSync(path.join(root, "lib"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "@ttsc/unplugin" }),
  );
  return ["js", "mjs"].map((extension) => {
    const file = path.join(root, "lib", `turbopack.${extension}`);
    fs.writeFileSync(file, "");
    return file;
  });
}
