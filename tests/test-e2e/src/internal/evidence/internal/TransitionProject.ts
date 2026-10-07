import fs from "node:fs";
import path from "node:path";

import { EvidenceProcessOwnership } from "../../../../../utils/src/evidence/EvidenceProcessOwnership";
import type { ITtscEvidenceProject } from "../../../../../utils/src/evidence/ITtscEvidenceProject";
import { createProject } from "../../../../../utils/src/evidence/createProject";

/**
 * One linked Evidence consumer that successive scenarios take over.
 *
 * The scenarios that rewrite sources, documents and lint configuration between
 * real `ttsc check` runs need the same linked packages, compiler and plugin
 * cache. They differ in their authored sources, compiler options and
 * configuration, so each enters the project by replacing exactly those inputs
 * rather than linking a second consumer.
 */
export namespace TransitionProject {
  /** Authored inputs one scenario installs into the shared consumer. */
  export interface IState {
    /** Compiler options applied over the consumer's strict defaults. */
    compilerOptions?: Record<string, unknown>;

    /** Program roots; defaults to the consumer's `src` and `lint.config.ts`. */
    include?: string[];

    /** Complete `lint.config.ts` text. */
    lintConfig: string;

    /** Files beneath the project directory, keyed by relative path. */
    files: Record<string, string>;

    /** Files beside the project in its workspace, keyed by relative path. */
    workspaceFiles?: Record<string, string>;
  }

  const bases = new WeakMap<ITtscEvidenceProject, Record<string, unknown>>();

  /**
   * Link one consumer with the authored lint snapshot, compiler and Evidence
   * package.
   *
   * @evidence contracts/common.md#principled-implementation The consumer comes from the same createProject owner as every other Evidence case, with the byte-proven authored lint snapshot, so scenarios exercise the actual packaged contributor; the strict base tsconfig is captured once so entering never invents compiler options.
   * @evidence contracts/common.md#clear-and-simple-design One call prepares the single consumer and records its defaults; scenarios own their authored inputs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No producer, compiler result or capability is replaced.
   * @evidence contracts/common.md#meaningful-documentation Explains that scenarios take the consumer over by replacing their own inputs.
   * @evidence contracts/portability.md#os-neutral-implementation Delegates links and paths to createProject, and reads the generated tsconfig with Node path APIs.
   * @evidence contracts/performance.md#efficient-algorithms Constant setup plus one small file read.
   * @evidence contracts/performance.md#reuse-equivalent-work The one linked consumer replaces one per scenario; the content-keyed native cache serves every check.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the returned project and releases it through its cleanup after the last scenario.
   */
  export function open(
    preparation: { preparedModules?: string; workspaceParent?: string } = {},
  ): ITtscEvidenceProject {
    const project = createProject({
      ...preparation,
      nativeProducer: "snapshot",
      name: "transitions",
      lintConfig: "export default {};\n",
      files: {},
    });
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(project.directory, "tsconfig.json"), "utf8"),
    ) as { compilerOptions: Record<string, unknown> };
    bases.set(project, tsconfig.compilerOptions);
    return project;
  }

  /**
   * Replace the previous scenario's sources, documents and configuration.
   *
   * The reset removes only the directories scenarios populate (`src`, `docs`,
   * the workspace `api` directory) and rewrites `tsconfig.json` and
   * `lint.config.ts`; links, `node_modules` and the plugin cache are
   * untouched.
   *
   * @evidence contracts/common.md#principled-implementation Removing and rewriting exactly the authored inputs leaves no earlier source, so a check observes only the entering scenario's files while compiler, package links and cache stay valid.
   * @evidence contracts/common.md#clear-and-simple-design A bounded reset of three directories and two files replaces creating another consumer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nothing is cached across scenarios beyond the unmodified links; no check result or warm state is reused.
   * @evidence contracts/common.md#meaningful-documentation States which inputs are reset and which survive.
   * @evidence contracts/portability.md#os-neutral-implementation Node removal and path joins with retry options handle Windows delayed release; no shell commands are used.
   * @evidence contracts/performance.md#efficient-algorithms Visits only the tiny authored inputs once per transition.
   * @evidence contracts/performance.md#reuse-equivalent-work Reuses the consumer's links and native cache instead of rebuilding them per scenario.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Asserts no process owns the project before mutating it, and leaves only the files the new scenario authors.
   */
  export function enter(project: ITtscEvidenceProject, state: IState): void {
    EvidenceProcessOwnership.assertAvailable(project.directory);
    const reset = (directory: string): void =>
      fs.rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    reset(path.join(project.directory, "src"));
    reset(path.join(project.directory, "docs"));
    reset(path.join(project.workspace, "api"));
    const base = bases.get(project);
    if (base === undefined)
      throw new Error("Project was not opened by TransitionProject");
    const write = (root: string, relative: string, text: string): void => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, "utf8");
    };
    write(
      project.directory,
      "tsconfig.json",
      JSON.stringify(
        {
          compilerOptions: { ...base, ...(state.compilerOptions ?? {}) },
          include: state.include ?? ["src", "lint.config.ts"],
        },
        null,
        2,
      ),
    );
    write(project.directory, "lint.config.ts", state.lintConfig);
    for (const [relative, text] of Object.entries(state.files))
      write(project.directory, relative, text);
    for (const [relative, text] of Object.entries(state.workspaceFiles ?? {}))
      write(project.workspace, relative, text);
  }
}
