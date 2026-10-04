import fs from "node:fs";
import path from "node:path";

import { getNativeLintProducer } from "../NativeLintProducer";
import { linkDirectory } from "./linkDirectory";
import { resolveDependency } from "./resolveDependency";
import { suiteRoot } from "./suiteRoot";

/**
 * Materializes one real Evidence dependency tree for compatible consumers.
 * The caller owns the fresh modules directory and retains it until every
 * borrowing project has released its readers. Published entrypoints, declared
 * runtime dependencies and the selected lint producer are unchanged from the
 * original project preparation; only their allocation is shared. An installed
 * compiler consumer can retain its already installed ttsc/TypeScript owners
 * instead of replacing them with workspace dependency links.
 *
 * @evidence contracts/common.md#principled-implementation The actual published manifest and lib/native links plus declared dependency links reproduce the existing preparation without substituting loader results or native replies.
 * @evidence contracts/common.md#clear-and-simple-design One dependency owner is separate from each authored project and ancestor workspace; callers choose live versus immutable snapshot producer explicitly.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Sharing does not hide source mutation or cold preparation: only compatible callers borrow this tree, and live and snapshot lint roots remain different actual selections.
 * @evidence contracts/common.md#meaningful-documentation Records caller-owned modules lifetime and actual published-entrypoint materialization, not an npm installation or loaded-image certificate.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joins and existing directory-link operations preserve their junction/symlink behavior; package names retain manifest spelling.
 * @evidence contracts/performance.md#efficient-algorithms Writes one manifest and visits each declared runtime dependency once, excluding the delegated snapshot preparation and filesystem costs.
 * @evidence contracts/performance.md#reuse-equivalent-work Compatible consumers borrow this one explicit dependency tree; their configurations, source populations and actual Programs remain independent.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous filesystem operations return before use. The common caller owns removal after borrowers join; this function allocates no process or global cache.
 */
export function prepareEvidenceDependencies(
  modules: string,
  nativeProducer: "snapshot" | "workspace" = "workspace",
  compilerDependencies: "installed" | "workspace" = "workspace",
): void {
  fs.mkdirSync(path.join(modules, "@ttsc"), { recursive: true });
  const source = path.resolve(suiteRoot, "..", "..", "packages", "evidence");
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8")) as Record<string, unknown>;
  const publishConfig = manifest.publishConfig;
  if (typeof publishConfig !== "object" || publishConfig === null || Array.isArray(publishConfig))
    throw new Error("@ttsc/evidence must declare publishConfig before its consumer fixture can reproduce the published entry points.");
  const destination = path.join(modules, "@ttsc", "evidence");
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, "package.json"), JSON.stringify({ ...manifest, ...publishConfig }, null, 2), "utf8");
  for (const directory of ["lib", "native"]) {
    const target = path.join(source, directory);
    if (!fs.existsSync(target))
      throw new Error(`@ttsc/evidence ${directory} is missing; run the workspace build before the feature suite.`);
    linkDirectory(target, path.join(destination, directory));
  }
  const dependencies = manifest.dependencies as Record<string, string> | undefined;
  for (const name of Object.keys(dependencies ?? {})) {
    if (name.startsWith("@"))
      fs.mkdirSync(path.join(modules, name.slice(0, name.indexOf("/"))), { recursive: true });
    linkDirectory(resolveDependency(name), path.join(modules, ...name.split("/")));
  }
  linkDirectory(nativeProducer === "snapshot" ? getNativeLintProducer().packageRoot : resolveDependency("@ttsc/lint"), path.join(modules, "@ttsc", "lint"));
  if (compilerDependencies === "workspace") {
    linkDirectory(resolveDependency("typescript"), path.join(modules, "typescript"));
    linkDirectory(resolveDependency("ttsc"), path.join(modules, "ttsc"));
  }
}


