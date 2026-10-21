import fs from "node:fs";
import { createRequire } from "node:module";

/**
 * The synchronous compiler API (`typescript/sync`) of the consuming project's
 * own TypeScript, as far as an in-memory single-root build uses it.
 *
 * TypeScript 7.1 publishes the API at `typescript/sync`. It drives the same
 * native executable the command line runs, over a pipe, and adds what the
 * command line cannot do: a snapshot whose filesystem layer supplies files that
 * exist only in memory, and an emit that returns its files instead of writing
 * them. TypeScript 7.0 publishes `typescript/unstable/sync`, whose program has
 * no emit, so a 7.0 project has no such API here.
 *
 * The declarations are structural: they name the members this package calls,
 * with the shapes `typescript@7.1.0-beta` gives them, rather than importing a
 * type ttsc's own TypeScript version does not have. `load` checks each member
 * before returning the module.
 *
 * @evidence contracts/common.md#principled-implementation The module is resolved through the consumer package's own exports by its manifest name, so the API is the one that package publishes and drives the executable that package ships. Member presence is checked before use; shapes are those of the published beta. Diagnostics are gathered in the compiler's own report order.
 * @evidence contracts/common.md#clear-and-simple-design One namespace holds the consumed API surface, its loader and the compiler's diagnostic order, apart from the build that uses them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The API is used as published; nothing in it is patched or replaced, and a package without it yields undefined rather than an emulation.
 * @evidence contracts/common.md#meaningful-documentation The prose states which TypeScript lines publish the API, what it adds over the command line, and why the declarations are structural.
 * @evidence contracts/portability.md#os-neutral-implementation Node's createRequire resolves the module from the package manifest's native path; no path is assembled by hand.
 * @evidence contracts/performance.md#efficient-algorithms Loading reads one manifest and requires one module; Node's module cache serves later loads of the same package.
 * @evidence contracts/performance.md#reuse-equivalent-work Node's module cache shares the loaded module across builds of one process.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The loaded module stays in Node's module cache for the process lifetime; sessions it creates are closed by their caller.
 */
export namespace TypeScriptSyncApi {
  /**
   * The loaded `typescript/sync` module.
   *
   * `API` starts a session whose child runs the package's native executable, or
   * `tsserverPath` when given; the session's `close` ends it.
   * `formatDiagnostics` renders diagnostics as the command line does without
   * `--pretty`, with file names relative to the session's working directory.
   *
   * @evidence contracts/common.md#principled-implementation The members are the published 7.1 API's, typed structurally by the shapes this package calls.
   * @evidence contracts/common.md#clear-and-simple-design Only the two members the in-memory build reaches are declared.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The type describes the published module without wrapping or replacing it.
   * @evidence contracts/common.md#meaningful-documentation The prose states what each member starts or renders and the session's ownership of its child.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation A type declaration touches no filesystem, path or process.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration holds no resource.
   */
  export interface Module {
    API: new (options: { cwd?: string; tsserverPath?: string }) => Session;
    formatDiagnostics: FormatDiagnostics;
  }

  /**
   * Load the API of the TypeScript package whose manifest is `packageJson`.
   *
   * @returns The module, or `undefined` when the package publishes no `./sync`
   *   export, it cannot be loaded, or it lacks a member the build calls.
   * @evidence contracts/common.md#principled-implementation Node resolves `<name>/sync` through the package's own exports from its manifest; each called member is checked on the loaded classes, so a package that lacks one is refused rather than failing mid-build.
   * @evidence contracts/common.md#clear-and-simple-design Resolution, loading and member checks form one small function returning the module or undefined.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Any load failure returns undefined so the caller keeps the command-line build; the version string is never consulted in place of the members.
   * @evidence contracts/common.md#meaningful-documentation The returns tag names each case that yields undefined.
   * @evidence contracts/portability.md#os-neutral-implementation createRequire takes the manifest's native path and Node's resolver handles the platform's path rules.
   * @evidence contracts/performance.md#efficient-algorithms One manifest read and one require; later requires of the same module come from Node's cache.
   * @evidence contracts/performance.md#reuse-equivalent-work Node's module cache shares the module across calls; a failed resolution is retried per call, costing one export lookup.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Node's module cache retains a loaded module for the process lifetime; nothing else is retained.
   */
  export function load(packageJson: string): Module | undefined {
    try {
      const { name } = JSON.parse(fs.readFileSync(packageJson, "utf8")) as {
        name?: unknown;
      };
      if (typeof name !== "string") return undefined;
      const loaded = createRequire(packageJson)(`${name}/sync`) as Record<
        string,
        unknown
      >;
      const { API, Program, formatDiagnostics } = loaded;
      if (
        typeof API !== "function" ||
        typeof Program !== "function" ||
        typeof formatDiagnostics !== "function" ||
        !["createSnapshot", "parseCommandLine", "close"].every(
          (member) => member in API.prototype,
        ) ||
        !("emitToString" in Program.prototype)
      )
        return undefined;
      return loaded as unknown as Module;
    } catch {
      return undefined;
    }
  }

  /**
   * The diagnostics the command line reports for a program, in its order
   * (`GetDiagnosticsOfAnyProgram`): configuration and syntax; then options and
   * global diagnostics when syntax found none; then semantic diagnostics, and
   * the global ones checking found, when those found none either.
   *
   * @evidence contracts/common.md#principled-implementation Mirrors TypeScript-Go's GetDiagnosticsOfAnyProgram: each later group is gathered only while no diagnostic beyond the configuration ones precedes it, and global diagnostics are asked again after checking. Declaration diagnostics are left out because the single-root build emits no declarations.
   * @evidence contracts/common.md#clear-and-simple-design One function holds the report order the in-memory build needs for its check and failure messages.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Every group comes from the compiler's own program; none is filtered or reworded.
   * @evidence contracts/common.md#meaningful-documentation The prose gives the order and the condition for each later group.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The function exchanges diagnostics with the compiler session and touches no filesystem path itself.
   * @evidence contracts/performance.md#efficient-algorithms At most six requests to the session; semantic checking runs only when syntax, options and global diagnostics are clean, as on the command line.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call reads one program's diagnostics once; the caller asks once per build.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned array holds the diagnostics until the caller discards it; the session owns everything else.
   */
  export function reportedDiagnostics(program: Program): Diagnostic[] {
    const reported = [...program.getConfigFileParsingDiagnostics()];
    const configured = reported.length;
    reported.push(...program.getSyntacticDiagnostics());
    if (reported.length !== configured) return reported;
    reported.push(
      ...program.getProgramDiagnostics(),
      ...program.getGlobalDiagnostics(),
    );
    if (reported.length !== configured) return reported;
    reported.push(
      ...program.getSemanticDiagnostics(),
      ...program.getGlobalDiagnostics(),
    );
    return reported;
  }
}

/** Renders diagnostics, with file names relative to the host's directory. */
type FormatDiagnostics = (
  diagnostics: readonly Diagnostic[],
  host: Session,
) => string;

/** One API session. */
interface Session {
  /** Parses argv with the session compiler's own command-line parser. */
  parseCommandLine(args: readonly string[]): {
    readonly errors: readonly Diagnostic[];
  };

  /**
   * Opens projects in a new snapshot. A `layer` filesystem supplies files that
   * take precedence over the disk.
   */
  createSnapshot(params: {
    openProjects: readonly string[];
    fileSystem: { kind: "layer"; files: Record<string, string> };
  }): Snapshot;

  /** Ends the session's child process. */
  close(): void;
}

/** A snapshot of opened projects. */
interface Snapshot {
  getConfiguredProject(configFileName: string): { id: unknown } | undefined;
  getProgram(projectId: unknown): Program | undefined;
}

/** The program of one opened project. */
interface Program {
  getConfigFileParsingDiagnostics(): readonly Diagnostic[];
  getProgramDiagnostics(): readonly Diagnostic[];
  getGlobalDiagnostics(): readonly Diagnostic[];
  getSyntacticDiagnostics(): readonly Diagnostic[];
  getSemanticDiagnostics(): readonly Diagnostic[];

  /**
   * Emits every file of the program the way the build would, returning the
   * files instead of writing them. `sourceFileName` names the source an output
   * was emitted from.
   */
  emitToString(): {
    readonly emitSkipped: boolean;
    readonly diagnostics?: readonly Diagnostic[];
    readonly outputFiles: Iterable<
      readonly [
        fileName: string,
        file: { readonly text: string; readonly sourceFileName?: string },
      ]
    >;
  };
}

/** A compiler diagnostic, opaque except for rendering. */
interface Diagnostic {
  readonly code: number;
}
