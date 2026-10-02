import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { normalizeCompilerEnumValue } from "../../flags/normalizeCompilerEnumValue";
import { readCompilerOptionValues } from "../../flags/readCompilerOptionValues";
import { resolvePhysicalPath } from "../../internal/pathIdentity/resolvePhysicalPath";

/**
 * Resolves the only file that positional `ttsc <source>` can materialize in the
 * user's tree.
 *
 * The compiler itself emits into a private temporary directory. The launcher
 * then copies one transformed JavaScript file to this path, so project-mode
 * declaration, map, build-info, outFile, and broad outDir products are not
 * positional outputs. Forwarded JSX uses native argv frames and CLI enum
 * normalization; an explicit reset selects the default suffix instead of
 * reviving the configured JSX.
 *
 * @evidence contracts/common.md#principled-implementation CLI output wins over project output, supported source extensions choose the emitted suffix, and physical root/file relation preserves project layout through links when the file is contained.
 * @evidence contracts/common.md#clear-and-simple-design Output placement delegates project settings and isolates containment, extension and forwarded-option readers; it does not materialize compiler side products.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Basename placement for files outside the project root is a supported positional-output rule; no fixture path or transformed-content special case decides the destination.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish the one copied JavaScript artifact from private build products; the physical-path comment explains why lexical aliases are insufficient.
 * @evidence contracts/portability.md#os-neutral-implementation Native path operations and shared physical resolution handle volumes, separators and links; containment checks reject absolute cross-volume relatives without unconditional case folding.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources resolveSingleFileOutput acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidenceExclude contracts/performance.md#efficient-algorithms resolveSingleFileOutput performs a fixed number of steps with no loop or recursion over caller data.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work resolveSingleFileOutput computes one result per call, so there is no repeated work to share.
 */
export function resolveSingleFileOutput(options: {
  cliOutDir?: string;
  cwd: string;
  file: string;
  passthrough?: readonly string[];
  tsconfig?: string;
}): string {
  const project = readProjectSettings(options);
  const forwarded = readCompilerOptionValues(options.passthrough).values;
  const rawJsx = forwarded.has("jsx") ? forwarded.get("jsx") : project?.jsx;
  const extension = singleFileJavaScriptExtension(
    options.file,
    typeof rawJsx === "string" ? rawJsx : undefined,
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
    // The project resolves to its physical directory, while the file is spelled
    // as the cwd reaches it. Related as spelled through a link, the file lies
    // outside `rootDir` and its mirrored place is lost, so both are related as
    // the filesystem names them.
    const fromRoot = path.relative(
      resolvePhysicalPath(project.rootDir),
      resolvePhysicalPath(options.file),
    );
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
          ? (normalizeCompilerEnumValue(rawJsx, "json") ?? undefined)
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
