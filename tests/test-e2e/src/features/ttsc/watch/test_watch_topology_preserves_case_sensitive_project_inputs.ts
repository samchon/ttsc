import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const childProcess = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies watch topology preserves case-sensitive project inputs.
 *
 * Lowercasing Windows paths can collapse two physical roots before watcher
 * pruning and can make a glob match its case-distinct sibling. Both exact and
 * glob inputs must retain the identities reported by the filesystem.
 *
 * 1. Create case-distinct external roots and glob roots.
 * 2. Assert both recursive watcher handles remain live.
 * 3. Observe each exact and glob input, then remove one glob and keep it quiet.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: watch topology preserves case-sensitive project inputs. 1. Create case-distinct external roots and glob roots. 2. Assert both recursive watcher handles remain live. 3. Observe each exact and glob input, then remove one glob and keep it quiet.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create case-distinct external roots and glob roots. 2. Assert both recursive watcher handles remain live. 3. Observe each exact and glob input, then remove one glob and keep it quiet.
 * Unavailable initial filesystem capabilities return false so the runner reports SKIPPED; returns after a completed path-identity assertion retain that partial result.
 *
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Create case-distinct external roots and glob roots. 2. Assert both recursive watcher handles remain live. 3. Observe each exact and glob input, then remove one glob and keep it quiet. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_preserves_case_sensitive_project_inputs =
  async (): Promise<void | false> => {
    const root = TestProject.tmpdir("ttsc-project-input-case-project-");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          outDir: "dist",
          rootDir: "src",
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const external = TestProject.tmpdir("ttsc-project-input-case-external-");
    if (enableWindowsCaseSensitivity(external) === false) return false;
    const upperRoot = path.join(external, "Project");
    const lowerRoot = path.join(external, "project");
    fs.mkdirSync(upperRoot);
    if (createCaseDistinctDirectory(lowerRoot) === false) return false;
    assert.notEqual(realpath(upperRoot), realpath(lowerRoot));
    const upperApi = path.join(upperRoot, "Api");
    const lowerApi = path.join(upperRoot, "api");
    fs.mkdirSync(upperApi);
    if (createCaseDistinctDirectory(lowerApi) === false) return;
    assert.notEqual(realpath(upperApi), realpath(lowerApi));

    const upperExact = path.join(upperRoot, "nested", "evidence.md");
    const lowerExact = path.join(lowerRoot, "nested", "evidence.md");
    const upperGlob = path.join(upperApi, "**", "*.json");
    const lowerGlob = path.join(lowerApi, "**", "*.json");
    const changes: WatchInputChange[] = [];
    let liveRoots: readonly string[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onProjectInputWatchRoots: (roots) => {
          liveRoots = [...roots];
        },
        onTopologyChange: () => {
          throw new Error("external inputs must not alter compiler membership");
        },
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [upperExact, lowerExact],
        globs: [upperGlob, lowerGlob],
      });
      assert.deepEqual(
        liveRoots,
        [realpath(upperRoot), realpath(lowerRoot)].sort(),
      );

      await writeAndWait(changes, upperExact, "upper\n");
      await writeAndWait(changes, lowerExact, "lower\n");
      const upperJson = path.join(upperApi, "openapi.json");
      const lowerJson = path.join(lowerApi, "openapi.json");
      await writeAndWait(changes, upperJson, "{}\n");
      await writeAndWait(changes, lowerJson, "{}\n");

      topology.setProjectInputs({
        root,
        files: [upperExact, lowerExact],
        globs: [upperGlob],
      });
      const count = changes.length;
      fs.writeFileSync(lowerJson, '{"removed":true}\n', "utf8");
      await delay();
      assert.equal(changes.length, count, JSON.stringify(changes.slice(count)));
    } finally {
      topology.close();
    }
  };

async function writeAndWait(
  changes: readonly WatchInputChange[],
  location: string,
  content: string,
): Promise<void> {
  const count = changes.length;
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, content, "utf8");
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (
    changes
      .slice(count)
      .some(
        (change) =>
          change.kind === "project" &&
          change.path !== undefined &&
          pathMatchesOrContains(change.path, location),
      ) === false
  ) {
    if (Date.now() >= deadline) {
      assert.fail(
        `expected project change for ${location}: ${JSON.stringify(
          changes.slice(count),
        )}`,
      );
    }
    await delay(25);
  }
  await delay();
}

function pathMatchesOrContains(changed: string, target: string): boolean {
  const root = realpath(changed);
  const candidate = realpath(target);
  return (
    candidate === root ||
    candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)
  );
}

function enableWindowsCaseSensitivity(directory: string): boolean {
  if (process.platform !== "win32") return true;
  const result = childProcess.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", directory, "enable"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  return result.status === 0;
}

function createCaseDistinctDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
