import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import type { TtscSingleFileEmitOptions } from "../../structures/internal/TtscSingleFileEmitOptions";
import { readProjectConfig } from "./project/readProjectConfig";
import { EmitOwnershipIndex } from "./EmitOwnershipIndex";
import { runBuild } from "./build/runBuild";

/**
 * Emit one source file by building its project into a temporary directory.
 *
 * The full project is compiled with its `rootDir` pinned, and the output is
 * taken only when it was provably emitted from the requested file: the
 * ownership index mirrors that file below the pinned root and, for another
 * spelling of it, compares filesystem identities. A file outside the
 * project's file set has no output of its own, and it is refused by name
 * rather than answered with another file's JavaScript that shares its name
 * (samchon/ttsc#1382). The temp directory is always cleaned up in the
 * `finally` block, even on error.
 *
 * @returns The transformed JavaScript source text.
 * @throws When the build exits non-zero or the project does not compile the
 *   file.
 */
export function runSingleFileEmit(options: TtscSingleFileEmitOptions): string {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const sourceFile = realpathIfExists(
    path.isAbsolute(options.file)
      ? options.file
      : path.resolve(cwd, options.file),
  );
  const project = readProjectConfig({
    cwd,
    file: options.file,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  const tsconfig = project.path;
  // The root `pinInferredRootDir` hands tsgo below: the declared one, which
  // `readProjectConfig` already absolutized, or the project's own directory.
  const rootDir =
    typeof project.compilerOptions.rootDir === "string"
      ? project.compilerOptions.rootDir
      : project.root;
  const outDir = createCanonicalTempDirectory("ttsc-single-file-");
  try {
    const result = runBuild({
      ...options,
      cwd,
      emit: true,
      isolateOutputsTo: outDir,
      outDir,
      // The private temp directory above is an `outDir` this lane injected, not
      // one the project declared, and tsgo answers an inferred common source
      // directory with TS5011 as soon as any `outDir` is in play. Pinning the
      // root tsgo would infer keeps `ttsc <file.ts>` working on a project that
      // declares no output at all, and it is the same root the ownership
      // lookup below mirrors against (issue #1172).
      pinInferredRootDir: true,
      resolvedProject: project,
      tsconfig,
    });
    if (result.status !== 0) {
      throw new Error(
        "ttsc single-file emit exited " +
          result.status +
          "\n" +
          (result.stderr || result.stdout),
      );
    }
    const emitted = new EmitOwnershipIndex({
      emitDir: outDir,
      rootDir,
    }).find(sourceFile);
    if (emitted === null) {
      throw new Error(
        `ttsc single-file emit: ${sourceFile} is not part of the program of ${tsconfig}; add it to that project's "include" or "files", or pass a tsconfig that compiles it`,
      );
    }
    const transformed = fs.readFileSync(emitted, "utf8");
    if (options.out) {
      const target = path.isAbsolute(options.out)
        ? options.out
        : path.resolve(cwd, options.out);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, transformed, "utf8");
    }
    return transformed;
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

/**
 * Resolve symlinks on `file` when it exists; return the original path when the
 * file is not yet on disk (e.g. a synthetic path used in tests).
 */
function realpathIfExists(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}
