import { TestProject } from "@ttsc/testing";
import type { SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { realNativeEnvelopeContributor } from "./unplugin/internal/real-native-envelope/realNativeEnvelopeContributor";

/**
 * One owned project tree for the three utility plugins' shared experiment.
 *
 * `@ttsc/banner`, `@ttsc/paths` and `@ttsc/strip` are driven the same way: a
 * project whose tsconfig names the plugin, a `node_modules/@ttsc/<name>` link
 * to the checkout's package, and `ttsc --emit` through the built launcher. The
 * experiment opens `fixtures/utilities/workspace` once, and
 * every scenario owns a sibling directory that differs from the others only by
 * the configuration, discovery or compiler-option state it asserts.
 */
export namespace UtilityWorkspace {
  /** Process result of one launcher invocation. */
  export type Result = SpawnSyncReturns<string>;

  /** The opened workspace; the experiment that opened it alone closes it. */
  export interface IWorkspace {
    /** Physical root of the temporary copy. */
    readonly root: string;

    /** Checkout packages linked into the copy's `node_modules/@ttsc`. */
    readonly packageRoots: readonly string[];
    /** Actual ApplyProgram observations from the shared linked probe. */
    readonly programRunLog: string;

    /** Toolchain path and plugin cache every launcher invocation receives. */
    readonly env: {
      readonly PATH: string | undefined;
      readonly TTSC_CACHE_DIR: string;
    };
  }

  /**
   * Copy the combined static workspace once and link all three real packages.
   *
   * The copy keeps authored bytes through the existing directory copier. The
   * package links are the same junctions or symlinks the former per-case projects
   * created, made once at the workspace root so every scenario directory
   * resolves the plugin through ordinary upward `node_modules` lookup. Scenarios
   * are sibling directories, so no scenario's manifest or configuration lies on
   * another scenario's ancestor path, and the workspace root itself carries
   * neither a manifest nor a plugin configuration.
   *
   * @evidence contracts/common.md#principled-implementation The workspace is the authored fixture copied byte for byte plus three real package links, so scenarios observe the same upward tsconfig, package and node_modules resolution an installed consumer has; no compiler result is synthesized.
   * @evidence contracts/common.md#clear-and-simple-design One function owns copy, link and the per-scenario process environment; scenarios own their assertions and expected strings, and no executor framework is introduced beyond the failure collector.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither the launcher nor plugin cache is replaced or stubbed. The cache directory is the content-keyed shared owner, and cold-cache behavior is not asserted by these scenarios.
   * @evidence contracts/common.md#meaningful-documentation Describes the shared tree, the three package links and the manifest rule that keeps scenario discovery independent.
   * @evidence contracts/portability.md#os-neutral-implementation The link is a junction type on Windows and a directory symlink elsewhere through Node's single call; paths use path.join and the Go toolchain directory is prepended with the platform delimiter.
   * @evidence contracts/performance.md#efficient-algorithms Copying visits each fixture entry once, so cost is linear in authored files.
   * @evidence contracts/performance.md#reuse-equivalent-work One copy, three package links and one environment serve all utility scenes; the content-keyed shared cache supplies plugin binaries. The combined CommonJS scenes explicitly share one completed emit and runtime, while distinct configuration states emit fresh results.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The copy is a tracked temporary directory that the experiment releases through close; an interrupted process still removes it at exit.
   */
  export function open(): IWorkspace {
    const root = TestProject.tmpdir("ttsc-utilities-e2e-");
    const source = path.resolve(
      import.meta.dirname,
      "../../fixtures",
      "utilities",
      "workspace",
    );
    TestProject.copyDirectory(source, root);

    const scope = path.join(root, "node_modules", "@ttsc");
    fs.mkdirSync(scope, { recursive: true });
    const packageRoots = ["banner", "paths", "strip"].map((name) => {
      const packageRoot = path.join(TestProject.WORKSPACE_ROOT, "packages", name);
      fs.symlinkSync(packageRoot, path.join(scope, name), "junction");
      return packageRoot;
    });

    const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
    const programRunLog = path.join(root, "baseline-program-runs.bin");
    const baselineConfig = path.join(root, "banner", "external-maps", "tsconfig.json");
    const baseline = JSON.parse(fs.readFileSync(baselineConfig, "utf8"));
    baseline.compilerOptions.plugins.push({
      name: "real-envelope-compile-probe",
      transform: "./compile-probe.cjs",
      fixtureSource: realNativeEnvelopeContributor(),
      runLog: programRunLog,
    });
    fs.writeFileSync(baselineConfig, JSON.stringify(baseline), "utf8");
    return {
      root,
      packageRoots,
      programRunLog,
      env: {
        PATH: fs.existsSync(localGo)
          ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
          : process.env.PATH,
        TTSC_CACHE_DIR: TestProject.sharedPluginCache(),
      },
    };
  }

  /**
   * Absolute directory of one scenario project.
   *
   * @evidence contracts/common.md#principled-implementation A scenario is the workspace subdirectory of that name, so joining the physical root with it names the directory the copy holds.
   * @evidence contracts/common.md#clear-and-simple-design A single join keeps scenario addressing in one place instead of each scene composing paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nothing is hardcoded to a scenario or expected result.
   * @evidence contracts/common.md#meaningful-documentation States that the result is an absolute directory inside the copy.
   * @evidence contracts/portability.md#os-neutral-implementation path.join produces the native separator and the scenario may itself contain slash-separated segments.
   * @evidence contracts/performance.md#efficient-algorithms Constant-time string join.
   * @evidence contracts/performance.md#reuse-equivalent-work Computes nothing worth sharing and performs no filesystem access.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retains and opens nothing.
   */
  export function project(workspace: IWorkspace, scenario: string): string {
    return path.join(workspace.root, scenario);
  }

  /**
   * Run a launcher or executable in one scenario with the shared inputs.
   *
   * @evidence contracts/common.md#principled-implementation The real process runs synchronously in the scenario directory with the checkout's native and TypeScript binaries wired by the existing spawn helper and the shared toolchain and cache environment.
   * @evidence contracts/common.md#clear-and-simple-design One call site supplies working directory and environment, so scenarios state only their command and arguments.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The command is not stubbed, its output is returned unmodified and failures are not retried.
   * @evidence contracts/common.md#meaningful-documentation States the working directory and environment inputs.
   * @evidence contracts/portability.md#os-neutral-implementation Node launchers run through the current Node executable inside the spawn helper, avoiding shebang and executable-bit differences between platforms.
   * @evidence contracts/performance.md#efficient-algorithms One process per call; cost is the command's own.
   * @evidence contracts/performance.md#reuse-equivalent-work The only shared inputs are the toolchain path and the content-keyed plugin cache; results are never reused between calls.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous process is joined before returning, so no child outlives the call.
   */
  export function run(
    workspace: IWorkspace,
    command: string,
    args: string[],
    scenario: string,
  ): Result {
    return TestProject.spawn(command, args, {
      cwd: project(workspace, scenario),
      env: workspace.env,
    });
  }

  /**
   * Run `ttsc --emit` for one scenario and return its joined result.
   *
   * @evidence contracts/common.md#principled-implementation The built public launcher emits the scenario's own tsconfig, so plugin discovery starts from that directory exactly as a user's invocation does.
   * @evidence contracts/common.md#clear-and-simple-design A thin application of run with the one argument vector all utility scenarios use.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No flag, plugin or result is substituted.
   * @evidence contracts/common.md#meaningful-documentation States the command and that the process is joined.
   * @evidence contracts/portability.md#os-neutral-implementation Delegates process launch to run and passes the directory as a native path.
   * @evidence contracts/performance.md#efficient-algorithms One compiler process per call.
   * @evidence contracts/performance.md#reuse-equivalent-work Plugin binaries come from the shared content-keyed cache; each call is a distinct configuration state and is not memoized.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The process is joined before return.
   */
  export function emit(workspace: IWorkspace, scenario: string): Result {
    const result = run(
      workspace,
      TestProject.TTSC_BIN,
      ["--cwd", project(workspace, scenario), "--emit"],
      scenario,
    );
    console.log("Utility compiler invocation " + JSON.stringify({ scenario, pid: result.pid, status: result.status }));
    return result;
  }

  /**
   * Read one emitted or authored file of a scenario as UTF-8.
   *
   * @evidence contracts/common.md#principled-implementation Reads the actual file bytes the scenario produced or authored and decodes them as UTF-8.
   * @evidence contracts/common.md#clear-and-simple-design A single synchronous read keeps assertions about output text direct.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing files throw rather than yielding an empty or default string.
   * @evidence contracts/common.md#meaningful-documentation States the encoding and the scenario-relative path.
   * @evidence contracts/portability.md#os-neutral-implementation path.join addresses the file with native separators; callers pass slash-separated relative names.
   * @evidence contracts/performance.md#efficient-algorithms Reads the file once; cost is its size.
   * @evidence contracts/performance.md#reuse-equivalent-work Output is always read fresh because scenarios compare current emitted bytes.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous read leaves no open handle and retains only the returned string.
   */
  export function read(workspace: IWorkspace, scenario: string, file: string): string {
    return fs.readFileSync(path.join(project(workspace, scenario), file), "utf8");
  }

  /**
   * Whether a file exists beneath a scenario directory.
   *
   * @evidence contracts/common.md#principled-implementation Answers existence from the filesystem entry itself, which is what copied or invented outputs are asserted by.
   * @evidence contracts/common.md#clear-and-simple-design One filesystem query behind a name that reads as the assertion subject.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Never fabricates an answer; a nonexistent path is false.
   * @evidence contracts/common.md#meaningful-documentation States the scenario-relative lookup.
   * @evidence contracts/portability.md#os-neutral-implementation path.join addresses the entry with native separators.
   * @evidence contracts/performance.md#efficient-algorithms One stat per call.
   * @evidence contracts/performance.md#reuse-equivalent-work Always queries current state because assertions concern what an emit just wrote.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retains and opens nothing.
   */
  export function exists(workspace: IWorkspace, scenario: string, file: string): boolean {
    return fs.existsSync(path.join(project(workspace, scenario), file));
  }

  /**
   * Remove the copy and verify the package link did not escape the root.
   *
   * @evidence contracts/common.md#principled-implementation Recursive removal of a directory tree deletes a junction as a link, so the checkout package must still exist afterwards; the check proves cleanup did not follow the link.
   * @evidence contracts/common.md#clear-and-simple-design One function releases the single owned root and verifies its two postconditions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failures to remove or an eroded package throw instead of being ignored.
   * @evidence contracts/common.md#meaningful-documentation States both postconditions.
   * @evidence contracts/portability.md#os-neutral-implementation Node's recursive removal treats junctions on Windows and symlinks elsewhere as links; the postcondition verifies this on every platform that runs the experiment.
   * @evidence contracts/performance.md#efficient-algorithms Visits each copied entry once.
   * @evidence contracts/performance.md#reuse-equivalent-work Performs the one cleanup of one workspace and shares nothing.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Releases the only directory the workspace owns, after every launcher call has been joined.
   */
  export function close(workspace: IWorkspace): void {
    fs.rmSync(workspace.root, { recursive: true, force: true });
    if (fs.existsSync(workspace.root))
      throw new Error("Workspace was not removed: " + workspace.root);
    for (const packageRoot of workspace.packageRoots)
      if (!fs.existsSync(path.join(packageRoot, "package.json")))
        throw new Error("Workspace cleanup reached the linked package: " + packageRoot);
  }
}
