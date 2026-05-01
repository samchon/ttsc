import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { TtscSingleFileEmitOptions } from "../../structures/internal/TtscSingleFileEmitOptions";
import { resolveProjectConfig } from "./project/resolveProjectConfig";
import { resolveEmittedJavaScript } from "./resolveEmittedJavaScript";
import { runBuild } from "./runBuild";

/** Emit one source file by building its project into a temporary directory. */
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

function realpathIfExists(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}
