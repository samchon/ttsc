import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/**
 * One owned directory that every Metro boundary scenario takes projects from.
 *
 * Each scenario used to create its own temporary project (and, for several, an
 * external directory beside it) and leave removal to process exit. The
 * workspace materializes the unplugin fixture project once as a template and
 * every scenario enters a project slot by replacing that slot with a fresh copy
 * of it, which also removes the slot's `node_modules/.cache/ttsc-metro`
 * snapshot, so no snapshot, epoch or recorded input can carry between
 * scenarios.
 */
export namespace MetroWorkspace {
  /** The owned directory and the project template copied into its slots. */
  export interface IWorkspace {
    /** Directory holding every slot, the template and the external directory. */
    readonly base: string;

    /** Generated fixture project copied into each unplugin-shaped slot. */
    readonly template: string;
  }

  /** Options a scenario may change on the copied template. */
  export interface IProjectOptions {
    /** Replaces the template's tsconfig plugin list when present. */
    plugins?: unknown[];

    /** Replaces the template's `src/main.ts` text when present. */
    source?: string;
  }

  /**
   * Create the owned directory and the fixture project template.
   *
   * @evidence contracts/common.md#principled-implementation The template is produced by the same TestUnpluginProject owner every unplugin-shaped scenario formerly called, so copied slots have the descriptor, Go plugin entry and tsconfig the product reads.
   * @evidence contracts/common.md#clear-and-simple-design One owner holds the directory, the template and slot replacement; scenarios own their mutations and assertions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No fingerprint, snapshot or compiler result is stubbed or prepared here; slots start without any cache.
   * @evidence contracts/common.md#meaningful-documentation Explains why slots are replaced rather than mutated.
   * @evidence contracts/portability.md#os-neutral-implementation Node path and copy APIs build the slots; symlinks and chmod-dependent states are created by the scenarios that assert them.
   * @evidence contracts/performance.md#efficient-algorithms Creating the template and each copy visit a handful of small authored files.
   * @evidence contracts/performance.md#reuse-equivalent-work The fixture project is generated once and copied, and the content-keyed Go plugin cache serves every native transform; project state is never shared between scenarios.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The base directory is a tracked temporary directory that the experiment removes with close after every scenario has joined its work.
   */
  export function open(): IWorkspace {
    const base = fs.realpathSync.native(TestProject.tmpdir("ttsc-metro-e2e-"));
    const template = TestUnpluginProject.createProject({
      temporaryParent: base,
    });
    return { base, template };
  }

  /**
   * Replace a slot with a fresh copy of the unplugin fixture project.
   *
   * @evidence contracts/common.md#principled-implementation Removing the slot and copying the template restores exactly the authored files and drops the slot's snapshot cache, so a scenario observes only its own transitions.
   * @evidence contracts/common.md#clear-and-simple-design A remove-and-copy of one directory replaces creating another project.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A previous scenario's recorded inputs and epochs are removed rather than tolerated or skipped.
   * @evidence contracts/common.md#meaningful-documentation Names the slot and option semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Node removal with retries and the existing directory copier handle Windows delayed handle release.
   * @evidence contracts/performance.md#efficient-algorithms Copies the few fixture files once per scenario.
   * @evidence contracts/performance.md#reuse-equivalent-work Reuses the generated template and plugin build instead of regenerating them.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each entry replaces its slot, so retained state is one slot per name.
   */
  export function enterProject(
    workspace: IWorkspace,
    options: IProjectOptions = {},
    slot = "primary",
  ): string {
    const root = clear(workspace, slot);
    TestProject.copyDirectory(workspace.template, root);
    if (options.plugins !== undefined) {
      const tsconfig = path.join(root, "tsconfig.json");
      const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
        compilerOptions: Record<string, unknown>;
      };
      parsed.compilerOptions.plugins = options.plugins;
      fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");
    }
    if (options.source !== undefined)
      fs.writeFileSync(
        path.join(root, "src", "main.ts"),
        options.source,
        "utf8",
      );
    return root;
  }

  /**
   * Replace a slot with a copy of a static authored project from
   * `fixtures/metro`.
   *
   * @evidence contracts/common.md#principled-implementation The slot holds the checked-in files byte for byte through the existing directory copier, so the scenario starts from its authored input and applies only its runtime links.
   * @evidence contracts/common.md#clear-and-simple-design One copy replaces inline file writes in the scenario.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No expected output is stored with the input.
   * @evidence contracts/common.md#meaningful-documentation Names the fixture root and slot semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Node path and copy APIs; links the scenario needs are created by the scenario.
   * @evidence contracts/performance.md#efficient-algorithms Copies a handful of small files.
   * @evidence contracts/performance.md#reuse-equivalent-work Replaces the slot instead of allocating a temporary directory.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One slot per name inside the owned directory.
   */
  export function enterFixture(
    workspace: IWorkspace,
    name: string,
    slot = name,
  ): string {
    const root = clear(workspace, slot);
    TestProject.copyDirectory(
      path.resolve(import.meta.dirname, "../../../../fixtures/metro", name),
      root,
    );
    return root;
  }

  /**
   * Replace a slot with the plugin-less project used by fingerprint scenarios.
   *
   * @evidence contracts/common.md#principled-implementation Writes the same minimal strict project the fingerprint scenarios used, with no plugin, so they need no native compiler or Go toolchain.
   * @evidence contracts/common.md#clear-and-simple-design Three authored files in one directory.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nothing about the fingerprint is precomputed.
   * @evidence contracts/common.md#meaningful-documentation States that the project has no plugin.
   * @evidence contracts/portability.md#os-neutral-implementation Node path and write APIs only.
   * @evidence contracts/performance.md#efficient-algorithms Writes three small files.
   * @evidence contracts/performance.md#reuse-equivalent-work Replaces the slot rather than creating another temporary directory.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One slot per name inside the owned directory.
   */
  export function enterBare(workspace: IWorkspace, slot = "bare"): string {
    const root = clear(workspace, slot);
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "app.ts"),
      "export const value: number = 1;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true }, include: ["src"] }),
      "utf8",
    );
    return root;
  }

  /**
   * Replace and return the directory scenarios use for inputs outside a
   * project.
   *
   * @evidence contracts/common.md#principled-implementation An empty directory beside the slots is outside every project root, which is the property the out-of-walk scenarios assert.
   * @evidence contracts/common.md#clear-and-simple-design One empty directory under the owned base.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No input is pre-recorded.
   * @evidence contracts/common.md#meaningful-documentation Names the directory's purpose.
   * @evidence contracts/portability.md#os-neutral-implementation Node path and mkdir APIs only.
   * @evidence contracts/performance.md#efficient-algorithms Constant work.
   * @evidence contracts/performance.md#reuse-equivalent-work Replaces rather than allocates.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Owned by the base directory and removed with it.
   */
  export function enterExternal(workspace: IWorkspace): string {
    return clear(workspace, "external");
  }

  /**
   * Remove the owned directory and verify nothing remains.
   *
   * @evidence contracts/common.md#principled-implementation Recursive removal of the single owned base removes every slot, template and external input, and the existence check proves it.
   * @evidence contracts/common.md#clear-and-simple-design One removal and one postcondition.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed removal throws instead of being ignored.
   * @evidence contracts/common.md#meaningful-documentation States the postcondition.
   * @evidence contracts/portability.md#os-neutral-implementation Node retries transient Windows removal failures; link scenarios remove their own junctions as links inside the base.
   * @evidence contracts/performance.md#efficient-algorithms Visits each file once.
   * @evidence contracts/performance.md#reuse-equivalent-work Performs the one cleanup of one workspace.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Releases the only directory the workspace owns after scenario work has joined.
   */
  export function close(workspace: IWorkspace): void {
    fs.rmSync(workspace.base, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    if (fs.existsSync(workspace.base))
      throw new Error("Metro workspace was not removed: " + workspace.base);
  }

  function clear(workspace: IWorkspace, slot: string): string {
    const root = path.join(workspace.base, slot);
    fs.rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    fs.mkdirSync(root, { recursive: true });
    return root;
  }
}
