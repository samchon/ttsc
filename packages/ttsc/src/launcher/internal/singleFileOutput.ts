import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";

/**
 * Resolves the only file that positional `ttsc <source>` can materialize in the
 * user's tree.
 *
 * The compiler itself emits into a private temporary directory. The launcher
 * then copies one transformed JavaScript file to this path, so project-mode
 * declaration, map, build-info, outFile, and broad outDir products are not
 * positional outputs.
 */
export function resolveSingleFileOutput(options: {
  cliOutDir?: string;
  cwd: string;
  file: string;
  tsconfig?: string;
}): string {
  const jsBasename =
    path.basename(options.file).replace(/\.[cm]?tsx?$/i, "") +
    singleFileJavaScriptExtension(options.file);

  if (options.cliOutDir) {
    const relative = path.relative(options.cwd, options.file);
    const jsRelative =
      relative.slice(0, relative.length - path.extname(relative).length) +
      singleFileJavaScriptExtension(options.file);
    return path.resolve(options.cwd, options.cliOutDir, jsRelative);
  }

  const projectOutDir = readProjectOutDir(options);
  if (projectOutDir !== null) {
    const fromRoot = path.relative(projectOutDir.rootDir, options.file);
    if (fromRoot !== "" && !isOutsideSingleFileLayout(fromRoot)) {
      const jsRelative =
        fromRoot.slice(0, fromRoot.length - path.extname(fromRoot).length) +
        singleFileJavaScriptExtension(options.file);
      return path.resolve(projectOutDir.outDir, jsRelative);
    }
    return path.resolve(projectOutDir.outDir, jsBasename);
  }

  return options.file.replace(
    /\.[cm]?tsx?$/i,
    singleFileJavaScriptExtension(options.file),
  );
}

function readProjectOutDir(options: {
  cwd: string;
  file: string;
  tsconfig?: string;
}): { outDir: string; rootDir: string } | null {
  try {
    const project = readProjectConfig({
      cwd: options.cwd,
      file: options.file,
      tsconfig: options.tsconfig,
    });
    const outDir = project.compilerOptions.outDir;
    if (typeof outDir !== "string" || outDir.length === 0) {
      return null;
    }
    const rawRoot = project.compilerOptions.rootDir;
    const rootDir =
      typeof rawRoot === "string" && rawRoot.length !== 0
        ? path.isAbsolute(rawRoot)
          ? rawRoot
          : path.resolve(project.root, rawRoot)
        : project.root;
    return { outDir, rootDir };
  } catch {
    return null;
  }
}

function isOutsideSingleFileLayout(relative: string): boolean {
  return (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}

function singleFileJavaScriptExtension(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case ".mts":
      return ".mjs";
    case ".cts":
      return ".cjs";
    default:
      return ".js";
  }
}
