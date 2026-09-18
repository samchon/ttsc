import fs from "node:fs";
import path from "node:path";

import {
  type IRunResult,
  type ITtscEvidenceProject,
  createProject,
  linkDirectory,
  resolveDependency,
  runCheck,
} from "../internal/index";

/**
 * Verifies every TypeScript source file of the `ttsc` package declares exactly
 * one documented public identity.
 *
 * `ttsc` cannot install `@ttsc/evidence` on itself: the rules run inside the
 * compiler the package is. The convention still binds its source — one public
 * identity per file, named after it, carrying a JSDoc block a reader or an
 * agent can start from — and a convention nobody checks decays one merge at a
 * time. This case is the check. It copies `packages/ttsc/src` into a consumer
 * project with the package's own compiler options and runtime dependencies, so
 * the rules see the real program rather than a pile of unresolved imports, and
 * runs the packaged `evidence/singular` and `evidence/documented` rules over it
 * through the real toolchain.
 *
 * A clean run alone would not prove anything, because a rule the host failed
 * to register is silent. A canary file with one violation of each rule rides
 * along, and the case requires both of its diagnostics before it trusts the
 * silence everywhere else.
 *
 * 1. Copy every `.ts`, `.mts`, and `.cts` file under `packages/ttsc/src`, add the
 *    canary, and link the package's type and runtime dependencies.
 * 2. Run `ttsc check` with both rules at `error`.
 * 3. Assert the canary produced a singular and a documented diagnostic.
 * 4. Assert no other diagnostic of any kind was reported.
 */
export const test_evidence_repository_ttsc_source_holds_one_documented_identity_per_file =
  (): void => {
    const packageRoot: string = fs.realpathSync(resolveDependency("ttsc"));
    const sourceRoot: string = path.join(packageRoot, "src");
    const files: Record<string, string> = {
      // `ttsc` publishes no `type`, so its source is CommonJS under nodenext.
      "package.json": JSON.stringify(
        { name: "fixture-ttsc-source", private: true },
        null,
        2,
      ),
      [CANARY]: [
        "export function first(): number {",
        "  return 1;",
        "}",
        "",
        "/** The second identity the singular rule must reject. */",
        "export function second(): number {",
        "  return 2;",
        "}",
        "",
      ].join("\n"),
    };
    collectSources(sourceRoot, sourceRoot, files);

    const project: ITtscEvidenceProject = createProject({
      name: "ttsc-source",
      include: ["src"],
      lintConfig: [
        'import { evidence } from "@ttsc/evidence";',
        "",
        "export default {",
        '  plugins: { "evidence": evidence },',
        "  rules: {",
        '    "evidence/singular": "error",',
        '    "evidence/documented": "error",',
        "  },",
        "};",
        "",
      ].join("\n"),
      files,
      compilerOptions: readPackageCompilerOptions(packageRoot),
    });
    try {
      linkPackageDependencies(packageRoot, project.directory);
      const result: IRunResult = runCheck(project.directory);
      const diagnostics: IDiagnostic[] = parseDiagnostics(result.output);
      // A diagnostic with no location (an option error, say) matches no parsed
      // line, so every code the compiler printed has to be one of them.
      const printed: number =
        stripColors(result.output).match(/\berror TS\d+:/g)?.length ?? 0;
      if (printed !== diagnostics.length)
        throw new Error(
          `The check printed ${printed} error code(s) but only ${diagnostics.length} located diagnostic(s); a failure outside any file would otherwise pass unseen.\n\nActual output:\n${result.output}`,
        );
      const canary: IDiagnostic[] = diagnostics.filter(
        (diagnostic) => diagnostic.file === CANARY,
      );
      for (const rule of ["evidence/singular", "evidence/documented"])
        if (!canary.some((diagnostic) => diagnostic.message.includes(rule)))
          throw new Error(
            `The canary must draw a [${rule}] diagnostic, or a silent run proves nothing about the source.\n\nActual output:\n${result.output}`,
          );

      const violations: IDiagnostic[] = diagnostics.filter(
        (diagnostic) => diagnostic.file !== CANARY,
      );
      if (violations.length !== 0)
        throw new Error(
          [
            `packages/ttsc/src must hold exactly one documented public identity per file, but the check reported ${violations.length} diagnostic(s):`,
            "",
            ...violations.map(
              (diagnostic) =>
                `  ${diagnostic.file.replace(/^src\//, "packages/ttsc/src/")}:${diagnostic.line} ${diagnostic.message}`,
            ),
          ].join("\n"),
        );
    } finally {
      project.cleanup();
    }
  };

/** Fixture path of the file seeded with one violation of each rule. */
const CANARY = "src/__evidence_canary__.ts";

/** One `file:line:column - error TSxxxx: message` diagnostic. */
interface IDiagnostic {
  /** Project-relative path with forward slashes. */
  file: string;

  /** One-based line the diagnostic points at. */
  line: number;

  /** Code and text after the severity, e.g. `TS12028: [evidence/...] ...`. */
  message: string;
}

/**
 * Copies every TypeScript source file under `directory` into `files`, keyed by
 * its fixture path below `src/`.
 */
const collectSources = (
  root: string,
  directory: string,
  files: Record<string, string>,
): void => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location: string = path.join(directory, entry.name);
    if (entry.isDirectory()) collectSources(root, location, files);
    else if (/\.[mc]?ts$/.test(entry.name))
      files[`src/${path.relative(root, location).split(path.sep).join("/")}`] =
        fs.readFileSync(location, "utf8");
  }
};

/**
 * The compiler options `packages/ttsc` builds with, minus what only matters
 * for emit.
 *
 * Read from the shared configuration the package extends rather than restated
 * here, so the fixture cannot drift into checking a program the package never
 * compiles.
 */
const readPackageCompilerOptions = (
  packageRoot: string,
): Record<string, unknown> => {
  const shared = JSON.parse(
    fs.readFileSync(
      path.resolve(packageRoot, "..", "..", "config", "tsconfig.json"),
      "utf8",
    ),
  ) as { compilerOptions: Record<string, unknown> };
  const {
    declaration: _declaration,
    sourceMap: _sourceMap,
    stripInternal: _stripInternal,
    ...options
  } = shared.compilerOptions;
  return { ...options, noEmit: true };
};

/**
 * Links the dependencies `packages/ttsc` declares, plus its Node type
 * definitions, into the fixture, so every import in the copied source resolves
 * and the only diagnostics left are the ones this case is about.
 */
const linkPackageDependencies = (
  packageRoot: string,
  directory: string,
): void => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  for (const name of [...Object.keys(manifest.dependencies ?? {}), "@types/node"]) {
    const target: string = fs.realpathSync(
      path.join(packageRoot, "node_modules", ...name.split("/")),
    );
    const location: string = path.join(
      directory,
      "node_modules",
      ...name.split("/"),
    );
    fs.mkdirSync(path.dirname(location), { recursive: true });
    linkDirectory(target, location);
  }
};

/**
 * Extracts every compiler diagnostic from the check output, with its colors
 * removed.
 *
 * The summary table ttsc prints after a failing run repeats file names, so only
 * lines of the `file:line:column - error` shape count.
 */
const parseDiagnostics = (output: string): IDiagnostic[] => {
  const plain: string = stripColors(output);
  const diagnostics: IDiagnostic[] = [];
  for (const line of plain.split(/\r?\n/)) {
    const match: RegExpMatchArray | null = line.match(
      /^(\S+?):(\d+):\d+ - (?:error|warning) (TS\d+: .*)$/,
    );
    if (match === null) continue;
    diagnostics.push({
      file: match[1]!.split("\\").join("/"),
      line: Number(match[2]),
      message: match[3]!,
    });
  }
  return diagnostics;
};

/** The check output with its ANSI color sequences removed. */
const stripColors = (output: string): string =>
  output.replace(/\x1b\[[0-9;]*m/g, "");
