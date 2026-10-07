import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/**
 * One owned project directory that `TtscCompiler` API scenarios share.
 *
 * Every state starts from the authored baseline under
 * `fixtures/ttsc/api/baseline` and overlays only what that state changes (a
 * tsconfig, a source tree or one file) from `fixtures/ttsc/api/<state>`. The
 * directory survives state changes; each baseline/overlay copy may replace its
 * package manifest. Callers own compiler objects, real Program lifetimes and
 * any asynchronous workers, and must join their operations before entering
 * another state or closing the root.
 */
export namespace CompilerApiWorkspace {
  const FIXTURES = path.resolve(
    import.meta.dirname,
    "../../../../fixtures/ttsc/api",
  );

  /** Absolute project directory and the authored fixture root. */
  export interface IWorkspace {
    readonly root: string;
  }

  /**
   * Copy the baseline project into a tracked temporary directory.
   *
   * @evidence contracts/common.md#principled-implementation The baseline is the checked-in project copied byte for byte through the existing directory copier, so the API under test reads the same files a consumer's project would hold.
   * @evidence contracts/common.md#clear-and-simple-design One function copies the baseline and the other replaces the changing inputs, so scenarios state only their overlay name.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No compiler result is stored in the fixture and no state is special-cased by name beyond selecting its overlay directory.
   * @evidence contracts/common.md#meaningful-documentation Explains the baseline and overlay model and what survives a state change.
   * @evidence contracts/portability.md#os-neutral-implementation Node path and copy APIs build the project; the dotted directory names are ordinary names on every supported filesystem.
   * @evidence contracts/performance.md#efficient-algorithms Each state copies a handful of small files.
   * @evidence contracts/performance.md#reuse-equivalent-work One project directory serves every state instead of one temporary project per scenario.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The directory is tracked and removed at process exit or earlier through close.
   */
  export function open(): IWorkspace {
    const root = TestProject.tmpdir("ttsc-compiler-api-");
    TestProject.copyDirectory(path.join(FIXTURES, "baseline"), root);
    return { root };
  }

  /**
   * Replace the sources and configuration with the baseline plus one overlay.
   *
   * Only `src`, `..src`, `..dist`, `dist`, `packages`, `node_modules` and
   * `tsconfig.json` are reset; the baseline and overlay copies may overwrite
   * package.json. Nothing outside the project directory is touched.
   *
   * @evidence contracts/common.md#principled-implementation Removing exactly the directories a state may populate and copying baseline then overlay leaves one authored input set, so a result can only come from the entered state.
   * @evidence contracts/common.md#clear-and-simple-design A bounded reset replaces creating another project.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Output directories are removed rather than tolerated, so a stale emit cannot satisfy an absence assertion.
   * @evidence contracts/common.md#meaningful-documentation Lists what is reset and what is kept.
   * @evidence contracts/portability.md#os-neutral-implementation Node removal with retry options and path joins only.
   * @evidence contracts/performance.md#efficient-algorithms Visits only the small authored trees.
   * @evidence contracts/performance.md#reuse-equivalent-work Reuses the project directory while recopying its authored baseline and overlay, including their package manifest; compiler result or producer reuse remains caller-owned.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Leaves only the files of the entered state.
   */
  export function enter(workspace: IWorkspace, state: string): void {
    for (const directory of [
      "src",
      "..src",
      "..dist",
      "dist",
      "packages",
      "node_modules",
    ])
      fs.rmSync(path.join(workspace.root, directory), {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    fs.rmSync(path.join(workspace.root, "tsconfig.json"), { force: true });
    TestProject.copyDirectory(path.join(FIXTURES, "baseline"), workspace.root);
    if (state !== "baseline") {
      // An overlay state authors its own source tree; the baseline sources would
      // otherwise join its program and change what it reports.
      fs.rmSync(path.join(workspace.root, "src"), {
        recursive: true,
        force: true,
      });
      TestProject.copyDirectory(path.join(FIXTURES, state), workspace.root);
    }
  }

  /**
   * Remove the project directory and verify nothing remains.
   *
   * @evidence contracts/common.md#principled-implementation Recursive removal of the one owned directory removes every state's files and the existence check proves it.
   * @evidence contracts/common.md#clear-and-simple-design One removal and one postcondition.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed removal throws instead of being ignored.
   * @evidence contracts/common.md#meaningful-documentation States the postcondition.
   * @evidence contracts/portability.md#os-neutral-implementation Node retries transient Windows removal failures.
   * @evidence contracts/performance.md#efficient-algorithms Visits each file once.
   * @evidence contracts/performance.md#reuse-equivalent-work Performs the one cleanup of one workspace.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Releases the only directory the workspace owns after callers have joined their synchronous operations or asynchronous workers; this directory helper does not itself join a compiler or process.
   */
  export function close(workspace: IWorkspace): void {
    fs.rmSync(workspace.root, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    if (fs.existsSync(workspace.root))
      throw new Error(
        "Compiler API workspace was not removed: " + workspace.root,
      );
  }
}
