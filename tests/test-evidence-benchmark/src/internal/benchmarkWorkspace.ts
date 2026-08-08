import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EvidenceBenchmarkToolchain } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkToolchain";
import { EvidenceBenchmarkWorkspace } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkWorkspace";
import type { ITtscEvidenceBenchmarkWorkspaceArtifact } from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkWorkspaceArtifact";
import type { EvidenceBenchmarkArm } from "../../../../benchmarks/evidence/src/typings/EvidenceBenchmarkArm";
import type { IBenchmarkWorkspace } from "./IBenchmarkWorkspace";
import { packEvidenceArchive } from "./packEvidenceArchive";
import { repositoryRoot } from "./suiteRoot";

/**
 * The requirements directory every case measures against.
 *
 * One subject is enough and the smallest is the cheapest: what a case asserts
 * is that a population is non-empty and that its units are the ones the
 * documents on disk declare, and neither property is subject-specific. The
 * expectation is derived from whatever
 * `benchmarks/evidence/requirements/<subject>/` contains, so choosing a subject
 * fixes the cost, not the assertion.
 */
const SUBJECT = "todo";

/**
 * The plugin package name a benchmark launch installs into an Evidence arm.
 *
 * `EvidenceBenchmarkCommandLine` writes the same name into the prepared
 * manifest, which is what makes the arm's `lint.config.ts` imports resolve.
 */
const EVIDENCE_PACKAGE_NAME = "@ttsc/evidence";

/** One temporary directory holding every workspace this process prepared. */
let suiteDirectory: string | undefined;

/** Prepared workspaces, keyed by arm and reused for the life of the process. */
const prepared = new Map<EvidenceBenchmarkArm, Promise<IBenchmarkWorkspace>>();

/** The packed toolchain, packed once and copied into every prepared arm. */
let toolchain: Promise<ITtscEvidenceBenchmarkWorkspaceArtifact[]> | undefined;

/**
 * Prepares one benchmark workspace per arm and hands every case the same tree.
 *
 * Preparation is a real `pnpm install` of a NestJS, Prisma, Playwright, and
 * Vite workspace followed by a baseline commit, and the layers a case walks sit
 * on top of a real `build:prisma`, `build:main`, and `build:sdk`. Paying that
 * once per arm rather than once per case is what makes an honest suite runnable
 * at all; paying it once per case would buy isolation this suite already has,
 * because {@link IBenchmarkWorkspace.restore} returns the tree to the baseline
 * commit preparation itself made.
 *
 * The workspace is materialized through `EvidenceBenchmarkWorkspace` rather
 * than by copying the template here. Copying it would test a copier this
 * repository does not ship: the arm overlay, the `{{...}}` substitutions, the
 * byte-for-byte requirements copy, the archive injection, the install, and the
 * baseline commit are all decisions the real preparation path makes, and a case
 * that re-made them could agree with itself while disagreeing with a launch.
 */
export const acquireBenchmarkWorkspace = async (
  arm: EvidenceBenchmarkArm,
): Promise<IBenchmarkWorkspace> => {
  const existing: Promise<IBenchmarkWorkspace> | undefined = prepared.get(arm);
  if (existing !== undefined) {
    const workspace: IBenchmarkWorkspace = await existing;
    workspace.restore();
    return workspace;
  }
  const creation: Promise<IBenchmarkWorkspace> = create(arm);
  prepared.set(arm, creation);
  return creation;
};

const create = async (
  arm: EvidenceBenchmarkArm,
): Promise<IBenchmarkWorkspace> => {
  const suite: string = suiteTemporaryDirectory();
  const apiPackageName = `@benchmark/${SUBJECT}-api`;
  const packed: ITtscEvidenceBenchmarkWorkspaceArtifact[] =
    await acquireToolchain(suite);
  const result = await EvidenceBenchmarkWorkspace.prepareWorkspace({
    repository: repositoryRoot,
    output: path.join(suite, arm),
    project: SUBJECT,
    arm,
    variables: {
      name: `benchmark-${SUBJECT}`,
      apiPackageName,
      backendPackageName: `@benchmark/${SUBJECT}-backend`,
      frontendPackageName: `@benchmark/${SUBJECT}-frontend`,
    },
    artifact:
      arm === "plain"
        ? undefined
        : {
            name: EVIDENCE_PACKAGE_NAME,
            archive: packEvidenceArchive(path.join(suite, "archive")),
          },
    toolchain: packed,
  });
  return {
    arm,
    subject: SUBJECT,
    root: result.root,
    workspace: result.workspace,
    apiPackageName,
    toolchain: packed,
    restore: () => restore(result.workspace),
  };
};

/**
 * Packs this repository's compiler toolchain once for every prepared arm.
 *
 * A launch packs `ttsc`, `@ttsc/lint`, `@ttsc/unplugin`, and the platform
 * package carrying the native compiler binary, then binds all four in both arms
 * so a cell compiles against the tree under test instead of the last published
 * release. A suite that skipped this would stand up a workspace no launch
 * produces: every gate would run a registry compiler, and the whole preparation
 * path this suite exists to prove would be exercised with the one argument that
 * turns it off.
 *
 * The set comes from `EvidenceBenchmarkToolchain` rather than from a list kept
 * here, for the same reason {@link acquireBenchmarkWorkspace} materializes
 * through the real preparation: a list spelled twice can agree with itself
 * while disagreeing with what a cell installs.
 *
 * Packing is shared across arms because the archives are identical by
 * definition — the toolchain is not an arm treatment — and the platform package
 * alone is a hundred and forty megabytes of native compiler.
 * `copyToolchainArchives` copies from these paths into each workspace, so one
 * pack still delivers two independent trees.
 */
const acquireToolchain = async (
  suite: string,
): Promise<ITtscEvidenceBenchmarkWorkspaceArtifact[]> => {
  const existing = toolchain;
  if (existing !== undefined) return existing;
  const directory: string = path.join(suite, "toolchain");
  fs.mkdirSync(directory, { recursive: true });
  const creation = EvidenceBenchmarkToolchain.pack(repositoryRoot, directory);
  toolchain = creation;
  return creation;
};

/**
 * Returns the workspace to its baseline commit and proves it arrived there.
 *
 * `git clean` deliberately omits `-x`: the ignored tree is the install and the
 * generated build output, and discarding those would turn a restore into
 * another install. What it does remove is every file a case added, and `reset
 * --hard` reverts every file a case edited — including the `lint.config.ts`
 * gates, whose removal is the whole subject of this suite.
 *
 * The status check afterwards is not ceremony. A restore that silently left a
 * gate removed would make the next case pass for a reason it never stated.
 */
const restore = (workspace: string): void => {
  git(workspace, ["reset", "--hard", "HEAD"]);
  git(workspace, ["clean", "-fd"]);
  const status: string = git(workspace, ["status", "--porcelain"]);
  if (status.trim() !== "")
    throw new Error(
      `The prepared workspace did not return to its baseline commit:\n${status}`,
    );
};

const git = (cwd: string, argumentList: readonly string[]): string => {
  const result: SpawnSyncReturns<string> = spawnSync("git", argumentList, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `git ${argumentList.join(" ")} failed in ${cwd} with status ${String(result.status)}.\n\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  return result.stdout ?? "";
};

/**
 * Creates the one temporary directory every prepared workspace lives under.
 *
 * `benchmarks/evidence/output/` is where a measured run is retained and is
 * never written by a test, so these trees go to the OS temporary directory. The
 * removal is registered on process exit rather than in each case's `finally`,
 * because the workspaces outlive individual cases by design.
 */
const suiteTemporaryDirectory = (): string => {
  if (suiteDirectory !== undefined) return suiteDirectory;
  const directory: string = fs.mkdtempSync(
    path.join(os.tmpdir(), "evidence-benchmark-suite-"),
  );
  suiteDirectory = directory;
  process.once("exit", () => cleanupQuietly(directory));
  return directory;
};

/**
 * Removes the suite's trees, tolerating what Windows has not released yet.
 *
 * A prepared workspace holds a package manager's store links and the
 * toolchain's own handles, so a removal immediately after the last command can
 * lose a race with the OS and raise EBUSY. Leftover temporary files are litter;
 * a suite that reports failure because of that litter is a lie about the code
 * under test.
 */
const cleanupQuietly = (directory: string): void => {
  for (let attempt = 0; attempt < 3; attempt++)
    try {
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
      return;
    } catch {
      // Retry, then give up: the OS releases these handles on its own schedule.
    }
};
