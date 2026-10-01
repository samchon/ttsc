import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getNativeLintProducer } from "../../../utils/src/NativeLintProducer";

import type { ICreateProjectProps } from "./ICreateProjectProps";
import { EvidenceProcessOwnership } from "./EvidenceProcessOwnership";
import type { ITtscEvidenceProject } from "./ITtscEvidenceProject";
import { linkDirectory } from "./linkDirectory";
import { resolveDependency } from "./resolveDependency";
import { suiteRoot } from "./suiteRoot";

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
 * @evidence contracts/common.md#clear-and-simple-design One typed preparation operation owns writing, published Evidence entrypoints and package links; the optional nativeProducer choice is explicit and leaves other consumers on their original live producer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Snapshot consumers resolve actual byte-proven copied lint source through their real package link, while cold/mutating consumers keep live source; no capability, provenance, source-key admission or compiler result is replaced.
 * @evidence contracts/common.md#meaningful-documentation Explains published-package assembly, ancestor fixture layout, explicit producer identity and release ownership, including transient removal retries that remain failures when exhausted.
 * @evidence contracts/portability.md#os-neutral-implementation Node path and filesystem APIs construct native workspace/link paths; package entrypoint strings keep their package-relative spelling, and the shared linkDirectory owner handles native directory-link creation.
 * @evidence contracts/performance.md#efficient-algorithms File writing visits each authored input once and dependency links follow the declared runtime manifest; retained fixture space scales with input bytes rather than copying installed dependency trees.
 * @evidence contracts/performance.md#reuse-equivalent-work Explicit non-mutating consumers reuse one verified authored lint snapshot and content-addressed native cache; the original live producer remains the default and changed test fixture inputs are written for every invocation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each invocation owns one exact private workspace; preparation failures release partial output. The returned callback refuses removal after unknown process-reader closure, retaining inputs and reporting its cause; known released fixtures use finite Node removal retries and propagate exhaustion.
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
    path.join(os.tmpdir(), `evidence-${props.name}-`),
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
  fs.mkdirSync(path.join(modules, "@ttsc"), { recursive: true });
  linkEvidencePackage(modules);
  linkEvidenceRuntimeDependencies(modules);
  linkDirectory(
    props.nativeProducer === "snapshot"
      ? getNativeLintProducer().packageRoot
      : resolveDependency("@ttsc/lint"),
    path.join(modules, "@ttsc", "lint"),
  );
  linkDirectory(
    resolveDependency("typescript"),
    path.join(modules, "typescript"),
  );
  linkDirectory(resolveDependency("ttsc"), path.join(modules, "ttsc"));

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

/** Absolute path to the workspace's `packages/evidence`. */
const evidencePackageRoot = (): string =>
  path.resolve(suiteRoot, "..", "..", "packages", "evidence");

/**
 * Links every runtime dependency `@ttsc/evidence` declares into the fixture.
 *
 * The package's `lib` is junctioned in, and a fixture cannot rely on Node
 * walking that link back into the workspace to resolve them: the loaders are
 * reached through ttsc's runtime hooks, which serve a module under the path it
 * was requested by rather than its physical one.
 *
 * The list comes from the manifest rather than being written here, so a
 * dependency the package gains upstream arrives with it instead of surfacing
 * later as one more "cannot find module" in a single failing case.
 */
const linkEvidenceRuntimeDependencies = (modules: string): void => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(evidencePackageRoot(), "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const scope: string | undefined = name.startsWith("@")
      ? name.slice(0, name.indexOf("/"))
      : undefined;
    if (scope !== undefined)
      fs.mkdirSync(path.join(modules, scope), { recursive: true });
    linkDirectory(
      resolveDependency(name),
      path.join(modules, ...name.split("/")),
    );
  }
};

const linkEvidencePackage = (modules: string): void => {
  const source: string = evidencePackageRoot();
  const manifest = JSON.parse(
    fs.readFileSync(path.join(source, "package.json"), "utf8"),
  ) as Record<string, unknown>;
  const publishConfig: unknown = manifest.publishConfig;
  if (
    typeof publishConfig !== "object" ||
    publishConfig === null ||
    Array.isArray(publishConfig)
  )
    throw new Error(
      "@ttsc/evidence must declare publishConfig before its consumer fixture can reproduce the published entry points.",
    );

  const destination: string = path.join(modules, "@ttsc", "evidence");
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(
    path.join(destination, "package.json"),
    JSON.stringify(
      { ...manifest, ...(publishConfig as Record<string, unknown>) },
      null,
      2,
    ),
    "utf8",
  );
  for (const directory of ["lib", "native"]) {
    const target: string = path.join(source, directory);
    if (!fs.existsSync(target))
      throw new Error(
        `@ttsc/evidence ${directory} is missing; run the workspace build before the feature suite.`,
      );
    linkDirectory(target, path.join(destination, directory));
  }
};
