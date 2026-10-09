import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import type { TtscSingleFileEmitOptions } from "../../structures/internal/TtscSingleFileEmitOptions";
import { EmitOwnershipIndex } from "./EmitOwnershipIndex";
import { runBuild } from "./build/runBuild";
import { CompilerProjectSelection } from "./project/CompilerProjectSelection";
import { readProjectConfig } from "./project/readProjectConfig";
import { readEffectiveCompilerOptions } from "./readEffectiveCompilerOptions";

/**
 * Emit one source file by building its project into a temporary directory.
 *
 * The full project is compiled with its `rootDir` pinned, and the output is
 * selected through the producing build's emitted-source provenance and current
 * physical source identity. Missing or ambiguous ownership is refused without
 * source-map or filename-precedence inference. Temp-directory removal in
 * `finally` is attempted after acquisition, including failure paths. Removal
 * failure propagates on success and is aggregated with an earlier operation
 * failure rather than replacing it.
 *
 * A launcher-supplied selection shares its project and original compiler argument
 * cwd with public output planning. Response freshness is checked before native
 * work and publication; these sequential checks do not pin bytes atomically.
 * Callers without that record retain explicit config/nearest-file discovery.
 *
 * @returns The transformed JavaScript source text.
 * @throws When the build exits non-zero, proves no JavaScript for the requested
 *   source or cannot establish unique ownership.
 * @evidence contracts/common.md#principled-implementation The supplied invocation selection or legacy locator establishes one project and compiler argument base; current response observations, effective rootDir precedence and isolated emission preserve that producing invocation; its emitted-source provenance and current physical source identity select the actual written output before optional caller-directed writing.
 * @evidence contracts/common.md#clear-and-simple-design One operation owns project emission, optional public copy and returned text. A supplied existing selection replaces repeated discovery; delegated option interpretation and provenance retain their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or ambiguous provenance cannot become ownership through basename, source-map presence or extension precedence; inferred-root pinning addresses the compiler's injected-outDir requirement.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain exact-source selection, missing owned output and temporary lifetime; the private realpath helper describes unavailable identity without a test-specific premise.
 * @evidence contracts/performance.md#efficient-algorithms A supplied project avoids another discovery; otherwise legacy discovery remains. Sequential response freshness checks and effective-option inspection precede one full project build, followed by publication reobservation. Output enumeration visits directory entries and sorts output paths; provenance indexing resolves native output identities and processes source associations. Only selected output content is read here, with optional caller output writing; path/association/output bytes and delegated native/build costs remain part of this call.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This invocation observes the project's current compiler/plugin effects and owns no valid-generation cache; equivalent build sharing belongs to higher-level runtime owners.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One accepted private output directory reaches removal in finally after success, build failure, lookup failure or output writing; acquisition has its own failure limitations. The index and selected text live until return/throw and transfer text to the caller, without an output-byte ceiling or timeout supplied here. Cleanup failure propagates after success and aggregates with the original failure and cause after an unsuccessful operation, so neither outcome is hidden.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and filesystem identities use Node APIs, child execution uses argument arrays, and optional output targets resolve from the invocation cwd on each supported host.
 */
export function runSingleFileEmit(
  options: TtscSingleFileEmitOptions,
  selection?: ReturnType<typeof CompilerProjectSelection.read>,
): string {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const sourceFile = realpathIfExists(
    path.isAbsolute(options.file)
      ? options.file
      : path.resolve(cwd, options.file),
  );
  const project =
    selection?.project ??
    readProjectConfig({
      cwd,
      file: options.file,
      projectRoot: options.projectRoot,
      tsconfig: options.tsconfig,
    });
  const tsconfig = project.path;
  const compilerArgsCwd = selection?.compilerArgsCwd ?? project.root;
  if (selection !== undefined) CompilerProjectSelection.assertCurrent(selection);
  // The root tsgo lays the outputs against: a `--rootDir` forwarded on the
  // command line, which reaches it after the config; otherwise the declared
  // one, which `readProjectConfig` already absolutized; otherwise the project's
  // own directory, which `pinInferredRootDir` hands it below.
  const effective = readEffectiveCompilerOptions(
    project,
    options.passthrough,
    options.binary,
    options.env,
    compilerArgsCwd,
  )?.("rootDir");
  const rootDir =
    typeof effective === "string"
      ? path.resolve(compilerArgsCwd, effective)
      : project.root;
  if (selection !== undefined) CompilerProjectSelection.assertCurrent(selection);
  const outDir = createCanonicalTempDirectory("ttsc-single-file-");
  let failed = false;
  let failure: unknown;
  try {
    const result = runBuild({
      ...options,
      cwd,
      compilerArgsCwd,
      emit: true,
      forceEmitProvenance: true,
      isolateOutputsTo: outDir,
      outDir,
      // The private temp directory above is an `outDir` this lane injected, not
      // one the project declared, and tsgo answers an inferred common source
      // directory with TS5011 as soon as any `outDir` is in play. Pinning the
      // root tsgo would infer keeps `ttsc <file.ts>` working on a project that
      // declares no output at all, while the producing invocation reports its
      // actual source/output ownership separately.
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
      emittedSources: result.emittedSources,
      emittedSourceProofFailures: result.emittedSourceProofFailures,
      outputs: EmitOwnershipIndex.listOutputs(outDir),
    }).find(sourceFile);
    if (emitted === null) {
      throw new Error(
        `ttsc single-file emit: ${tsconfig} emitted no JavaScript owned by ${sourceFile}; check that the project includes the source and its options permit JavaScript emission`,
      );
    }
    const transformed = fs.readFileSync(emitted, "utf8");
    if (selection !== undefined) CompilerProjectSelection.assertCurrent(selection);
    if (options.out) {
      const target = path.isAbsolute(options.out)
        ? options.out
        : path.resolve(cwd, options.out);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, transformed, "utf8");
    }
    return transformed;
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
    } catch (cleanupError) {
      if (failed) {
        throw new AggregateError(
          [failure, cleanupError],
          "ttsc: single-file emission and temporary output cleanup failed",
          { cause: failure },
        );
      }
      throw cleanupError;
    }
  }
}

/**
 * Resolve a physical target when native realpath succeeds; otherwise preserve
 * the requested lexical spelling so project diagnostics and ownership lookup
 * decide its actual outcome.
 */
function realpathIfExists(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}
