import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isInside } from "./paths";

/**
 * Synthesize the tsconfig under which a single source is emitted when no real
 * project owns it: a raw `.ts` dependency shipped under `node_modules`, or an
 * entry-project source the entry tsconfig does not `include` (a runtime-generated
 * file, or one reached through a computed `import()` outside the static graph).
 *
 * The synthesized config names exactly that file (`files: [source]`,
 * `include: []`) so an unrelated sibling with a type error cannot derail it, and
 * the persistent emit host loads it like any other tsconfig. The source is still
 * served under its own URL, so `__dirname` / `import.meta.url` keep source
 * identity; only the compile scope is synthetic.
 *
 * - A dependency outside the entry project is emitted standalone under
 *   `module: nodenext`, so each file takes the Node format its own package
 *   dictates (its `type`, `.mts`/`.cts` extension) rather than the consumer's.
 * - An entry-project source extends the entry tsconfig, keeping its compiler
 *   options and transform plugins (so typia and friends still run).
 */
const cache = new Map<string, string>();

export function looseTsconfigFor(options: {
  file: string;
  entryTsconfig: string;
  entryRoot: string;
}): string {
  const cached = cache.get(options.file);
  if (cached !== undefined) {
    return cached;
  }
  const dir = looseDir(options.file);
  fs.mkdirSync(dir, { recursive: true });
  const outDir = path.join(dir, "out");
  const config = isDependencySource(options.file, options.entryRoot)
    ? dependencyConfig(options.file, outDir)
    : entryConfig(options.file, outDir, options.entryTsconfig);
  const configFile = path.join(dir, "tsconfig.json");
  fs.writeFileSync(configFile, JSON.stringify(config), "utf8");
  cache.set(options.file, configFile);
  return configFile;
}

/**
 * A source is a dependency when it lives under a `node_modules` directory or
 * outside the entry project root. Both reach raw `.ts` packages the entry
 * project does not own, so they compile standalone rather than under the entry
 * tsconfig.
 */
function isDependencySource(file: string, entryRoot: string): boolean {
  return (
    file.split(path.sep).includes("node_modules") || !isInside(entryRoot, file)
  );
}

function dependencyConfig(file: string, outDir: string): unknown {
  return {
    compilerOptions: {
      module: "nodenext",
      moduleResolution: "nodenext",
      target: "esnext",
      rootDir: path.dirname(file),
      outDir,
      noEmit: false,
      declaration: false,
      sourceMap: false,
      skipLibCheck: true,
      allowJs: true,
    },
    files: [file],
    include: [],
  };
}

function entryConfig(
  file: string,
  outDir: string,
  entryTsconfig: string,
): unknown {
  return {
    extends: entryTsconfig,
    compilerOptions: {
      rootDir: path.dirname(file),
      outDir,
      noEmit: false,
      declaration: false,
    },
    files: [file],
    include: [],
  };
}

/** A stable per-source scratch directory, keyed by the source's real path. */
function looseDir(file: string): string {
  const key = crypto.createHash("sha256").update(file).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), "ttsx-loose", key);
}
