import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { TtscSingleFileEmitOptions } from "../../structures/internal/TtscSingleFileEmitOptions";
import { resolveProjectConfig } from "./project/resolveProjectConfig";
import { resolveEmittedJavaScript } from "./resolveEmittedJavaScript";
import { runBuild } from "./runBuild";

/**
 * Emit one source file by building its project into a temporary directory.
 *
 * The full project is compiled with `forceListEmittedFiles` so that the emitted
 * file list is available for `resolveEmittedJavaScript`. The temp directory is
 * always cleaned up in the `finally` block, even on error.
 *
 * @returns The transformed JavaScript source text.
 * @throws When the build exits non-zero or no output is produced for the file.
 */
export function runSingleFileEmit(options: TtscSingleFileEmitOptions): string {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const sourceFile = realpathIfExists(
    path.isAbsolute(options.file)
      ? options.file
      : path.resolve(cwd, options.file),
  );
  const tsconfig = resolveProjectConfig({
    cwd,
    file: sourceFile,
    tsconfig: options.tsconfig,
  });
  const projectRoot = path.dirname(tsconfig);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-single-file-"));
  try {
    const result = runBuild({
      ...options,
      cwd,
      emit: true,
      forceListEmittedFiles: true,
      outDir,
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
    const emitted = resolveEmittedJavaScript({
      emittedFiles: result.emittedFiles,
      outDir,
      projectRoot,
      sourceFile,
    });
    if (emitted === null) {
      throw new Error(
        `ttsc single-file emit: no output produced for ${sourceFile}`,
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
