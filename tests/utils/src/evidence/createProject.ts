import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getNativeLintProducer } from "../NativeLintProducer";

import type { ICreateProjectProps } from "./ICreateProjectProps";
import { EvidenceProcessOwnership } from "./EvidenceProcessOwnership";
import type { ITtscEvidenceProject } from "./ITtscEvidenceProject";
import { linkDirectory } from "./linkDirectory";
import { resolveDependency } from "./resolveDependency";
import { prepareEvidenceDependencies } from "./prepareEvidenceDependencies";

/**
 * Materializes a throwaway project wired to the real toolchain.
 *
 * The linked dependencies are the point. A fixture that imported the rules
 * directly would prove the Go compiles, not that a consumer can use it: ttsc
 * has to resolve `@ttsc/evidence` from node_modules, read its descriptor, find
 * the `source` directory inside the package, and link that Go into its own
 * binary. Every one of those steps is a place packaging can break while every
 * unit test stays green.
 *
 * The default producer is the live workspace package. Shared non-mutating
 * consumers explicitly select the byte-proven authored lint snapshot; mutation
 * and cold boundaries retain the live package. Preparation owns its partial
 * workspace even before it can return a cleanup callback.
 *
 * @evidence contracts/common.md#principled-implementation The operation materializes original compiler/config inputs and actual package entrypoints, then returns one private workspace owner; preparation failure releases that workspace and preserves concurrent cleanup failure.
 * @evidence contracts/common.md#clear-and-simple-design One typed project preparation writes authored inputs and either prepares or borrows actual modules. Explicit nativeProducer selects the live or snapshot root; borrowed modules must resolve the same selected lint producer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Snapshot consumers resolve actual byte-proven copied lint source through their real package link, while cold/mutating consumers keep live source; no capability, provenance, source-key admission or compiler result is replaced.
 * @evidence contracts/common.md#meaningful-documentation Explains published-package assembly, ancestor fixture layout, explicit producer identity and release ownership, including transient removal retries that remain failures when exhausted.
 * @evidence contracts/portability.md#os-neutral-implementation Node path and filesystem APIs construct native workspace/link paths; package entrypoint strings keep their package-relative spelling, and the shared linkDirectory owner handles native directory-link creation.
 * @evidence contracts/performance.md#efficient-algorithms File writing visits each authored input once and dependency links follow the declared runtime manifest; retained fixture space scales with input bytes rather than copying installed dependency trees.
 * @evidence contracts/performance.md#reuse-equivalent-work Explicit non-mutating consumers reuse one verified authored lint snapshot and content-addressed native cache; the original live producer remains the default and changed test fixture inputs are written for every invocation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each invocation owns one private ancestor workspace, optionally beneath a common manifest-free owner. Borrowed modules belong to that common owner and are not recursively removed through the project link; preparation failures release only partial private output. The returned callback refuses removal after unknown process-reader closure, retaining inputs and reporting its cause; known released fixtures use finite Node removal retries and propagate exhaustion.
 */
export const createProject = (
  props: ICreateProjectProps,
): ITtscEvidenceProject => {
  // The fixture is a workspace with the project one directory inside it, so a
  // case can place a document, a schema, or an OpenAPI file *beside* the
  // project. Writing above a project that sat directly in the temp directory
  // would litter a directory every other case shares, and the ancestor
  // population is precisely what has to be reachable.
  const workspace: string = fs.mkdtempSync(
    path.join(props.workspaceParent ?? os.tmpdir(), `evidence-${props.name}-`),
  );
  try {
  const directory: string = path.join(workspace, "project");
  fs.mkdirSync(directory, { recursive: true });

  const write = (relative: string, content: string): void => {
    const location: string = path.join(directory, relative);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    fs.writeFileSync(location, content, "utf8");
  };
  const writeOutside = (relative: string, content: string): void => {
    const location: string = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    fs.writeFileSync(location, content, "utf8");
  };

  write(
    "package.json",
    JSON.stringify(
      { name: `fixture-${props.name}`, private: true, type: "module" },
      null,
      2,
    ),
  );
  write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "esnext",
          module: "nodenext",
          moduleResolution: "nodenext",
          esModuleInterop: true,
          strict: true,
          noEmit: true,
          plugins: [{ transform: "@ttsc/lint" }],
          ...(props.compilerOptions ?? {}),
        },
        include: props.include ?? ["src", "lint.config.ts"],
      },
      null,
      2,
    ),
  );
  write("lint.config.ts", props.lintConfig);
  for (const [relative, content] of Object.entries(props.files))
    write(relative, content);
  for (const [relative, content] of Object.entries(props.workspaceFiles ?? {}))
    writeOutside(relative, content);

  // Link rather than install: the workspace build is what is under test, and an
  // npm-resolved copy would be testing whatever was last published. Materialize
  // the package's publishConfig entry points instead of exposing its
  // development-only TypeScript source entry to the consumer.
  //
  // `typescript` is linked too because ttsc refuses to start without the native
  // compiler resolvable from the consuming project — it is a real consumer
  // requirement, not a test artifact.
  const modules: string = path.join(directory, "node_modules");
  if (props.preparedModules) {
    if (!path.isAbsolute(props.preparedModules))
      throw new Error("Prepared modules must be an absolute caller-owned path");
    const expectedLint = props.nativeProducer === "snapshot"
      ? getNativeLintProducer().packageRoot
      : resolveDependency("@ttsc/lint");
    if (fs.realpathSync(path.join(props.preparedModules, "@ttsc", "lint")) !== fs.realpathSync(expectedLint))
      throw new Error("Shared Evidence dependencies select a different native lint producer");
    linkDirectory(props.preparedModules, modules);
  } else {
    prepareEvidenceDependencies(modules, props.nativeProducer);
  }
  return { directory, workspace, cleanup: () => {
    EvidenceProcessOwnership.assertAvailable(directory);
    cleanupWorkspace(workspace);
  } };
  } catch (error) {
    try {
      cleanupWorkspace(workspace);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Evidence fixture preparation and cleanup failed.");
    }
    throw error;
  }
};

/**
 * Releases the exact private fixture root after its native processes close.
 *
 * Windows can briefly retain a released handle, so Node retries transient
 * removal failures. Exhaustion remains a failure rather than silently leaving
 * a fixture behind or reporting successful ownership release.
 */
const cleanupWorkspace = (directory: string): void => {
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
};

