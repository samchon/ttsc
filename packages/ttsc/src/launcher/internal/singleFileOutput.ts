import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveFlagSpec } from "../../flags/schema";

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
  passthrough?: readonly string[];
  tsconfig?: string;
}): string {
  const project = readProjectSettings(options);
  const extension = singleFileJavaScriptExtension(
    options.file,
    passthroughStringOption(options.passthrough, "--jsx") ?? project?.jsx,
  );
  const jsBasename =
    path.basename(options.file).replace(/\.(?:[cm]?tsx?|jsx)$/i, "") +
    extension;

  if (options.cliOutDir) {
    const relative = path.relative(options.cwd, options.file);
    const jsRelative =
      relative.slice(0, relative.length - path.extname(relative).length) +
      extension;
    return path.resolve(options.cwd, options.cliOutDir, jsRelative);
  }

  if (project?.outDir !== undefined) {
    const fromRoot = path.relative(project.rootDir, options.file);
    if (fromRoot !== "" && !isOutsideSingleFileLayout(fromRoot)) {
      const jsRelative =
        fromRoot.slice(0, fromRoot.length - path.extname(fromRoot).length) +
        extension;
      return path.resolve(project.outDir, jsRelative);
    }
    return path.resolve(project.outDir, jsBasename);
  }

  return options.file.replace(/\.(?:[cm]?tsx?|jsx)$/i, extension);
}

function readProjectSettings(options: {
  cwd: string;
  file: string;
  tsconfig?: string;
}): { jsx?: string; outDir?: string; rootDir: string } | null {
  try {
    const project = readProjectConfig({
      cwd: options.cwd,
      file: options.file,
      tsconfig: options.tsconfig,
    });
    const outDir = project.compilerOptions.outDir;
    const rawRoot = project.compilerOptions.rootDir;
    const rootDir =
      typeof rawRoot === "string" && rawRoot.length !== 0
        ? path.isAbsolute(rawRoot)
          ? rawRoot
          : path.resolve(project.root, rawRoot)
        : project.root;
    const rawJsx = project.compilerOptions.jsx;
    return {
      jsx:
        typeof rawJsx === "string" && rawJsx.length !== 0
          ? rawJsx.toLowerCase()
          : undefined,
      outDir:
        typeof outDir === "string" && outDir.length !== 0 ? outDir : undefined,
      rootDir,
    };
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

function singleFileJavaScriptExtension(
  file: string,
  jsx: string | undefined,
): string {
  switch (path.extname(file).toLowerCase()) {
    case ".mts":
      return ".mjs";
    case ".cts":
      return ".cjs";
    case ".tsx":
    case ".jsx":
      return jsx === "preserve" ? ".jsx" : ".js";
    default:
      return ".js";
  }
}

function passthroughStringOption(
  tokens: readonly string[] | undefined,
  name: string,
): string | undefined {
  let value: string | undefined;
  for (let index = 0; index < (tokens?.length ?? 0); index++) {
    const token = tokens?.[index];
    if (
      token === undefined ||
      token.includes("=") ||
      resolveFlagSpec(token)?.name !== resolveFlagSpec(name)?.name
    ) {
      continue;
    }
    const next = tokens?.[index + 1];
    if (next !== undefined) {
      value = next.toLowerCase();
      index++;
    }
  }
  return value;
}
