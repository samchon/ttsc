import { TestProject } from "@ttsc/testing";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

type ResidentSample = {
  pid: number;
  programLoads: number;
  programUpdates: number;
  reused: boolean;
};

/**
 * Verifies a lint-config contributor transition replaces resident execution.
 *
 * The config path is both a backward-compatible project input and a CLI reload
 * input. Reusing the old execution, an entry-only cache, or CommonJS module
 * state would leave the alpha binary active after an imported helper selects
 * beta.
 *
 * 1. Start check watch with contributor A selected by a helper outside the project
 *    and record its resident PID/finding.
 * 2. Change only that helper to select contributor B.
 * 3. Require a distinct PID, cold-load telemetry, and only B's behavior in that cycle.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch replaces alpha with beta after only the imported selection helper changes, requires distinct positive telemetry PIDs, fresh-load counters and native ESRCH for the old PID. These counters do not count total Program constructions.
 * @evidence contracts/testing.md#independent-expectations Literal alpha/beta finding markers and distinct contributor sources independently identify behavior; complete fresh-counter checks and old-PID liveness checks establish replacement rather than stale config reuse.
 * @evidence contracts/testing.md#distinguishing-cases Owns executable-config transitive input changes selecting a different compiled contributor, both positive and negative finding-family controls and old process disposal.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-misc export executes real CJS config evaluation, contributor compilation and watcher protocol in the generic corpus-misc population; no platform filter is present in this body.
 * @evidence contracts/e2e.md#necessary-boundary The imported helper observation must invalidate config evaluation, select a changed native binary and retire the old resident; direct source hashing or config parsing cannot prove the full transition.
 * @evidence contracts/e2e.md#shared-execution One watcher serves both selections and the shared Go-cache location is available. Alpha and beta must select different behavior; cache hits, build totals and identical Program objects are not measured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The external helper has a tracked allocation owned by the watcher alongside its project; cleanup waits for successful watcher close and uncertain close retains its inputs. Body/close/removal errors are retained separately. Old PID absence accepts only ESRCH, with EPERM still live and other errors propagated. This does not certify executable-image identity or arbitrary descendant shutdown.
 * @evidence contracts/e2e.md#preserved-coverage Original sample counts, fresh PID/load/update/reuse checks, alpha/beta presence and absence, no-unknown-rule control and old-process exit assertions remain through the same two-cycle transition.
 */
export async function test_plugin_corpus_check_watch_reloads_changed_lint_config_contributors(): Promise<void> {
  const root = setupLintProject("lint-violations");
  const config = path.join(root, "lint.config.cjs");
  const shared = TestProject.tmpdir("ttsc-lint-selection-", path.dirname(root));
  const selection = path.join(shared, "selection.cjs");
  const alpha = path.join(root, "contributors", "alpha");
  const beta = path.join(root, "contributors", "beta");
  fs.rmSync(path.join(root, "lint.config.json"), { force: true });
  writeContributor(alpha, "alpha");
  writeContributor(beta, "beta");
  writeConfig(config, selection);
  writeSelection(selection, "alpha", alpha);

  let session: WatchSession | undefined;
  const failures: unknown[] = [];
  try {
    session = new WatchSession(root, {
      ownedInputRoots: [shared],
      args: ["--noEmit", "--diagnostics"],
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        TTSC_WATCH_DEBUG_INPUTS: "1",
      },
    });
    await session.waitForBuilds(1, 300_000);
    const firstTranscript = session.transcript();
    const firstSamples = residentSamples(firstTranscript);
    assert.equal(firstSamples.length, 1, firstTranscript);
    assertFreshSample(firstSamples[0]!, undefined);
    assert.match(firstTranscript, /\[alpha\/marker\].*alpha active/s);
    assert.doesNotMatch(firstTranscript, /\[beta\/marker\]/);

    writeSelection(selection, "beta", beta);
    await session.waitForBuilds(2, 300_000);
    const transcript = session.transcript();
    const samples = residentSamples(transcript);
    assert.equal(samples.length, 2, transcript);
    assertFreshSample(samples[1]!, samples[0]!.pid);
    const secondCycle = transcript.slice(firstTranscript.length);
    assert.match(secondCycle, /\[beta\/marker\].*beta active/s);
    assert.doesNotMatch(secondCycle, /\[alpha\/marker\]/);
    assert.doesNotMatch(secondCycle, /ignoring unknown rule/i);
    await waitForProcessExit(samples[0]!.pid);
  } catch (error) {
    failures.push(error);
  } finally {
    let joined = session === undefined;
    try { await session?.close(); joined = true; } catch (error) { failures.push(error); }
    if (joined) {
      try { fs.rmSync(shared, { recursive: true, force: true }); } catch (error) { failures.push(error); }
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Contributor reload and cleanup failed");
}

function writeContributor(directory: string, namespace: string): void {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "rule.go"),
    `package ${namespace}

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/samchon/ttsc/packages/lint/rule"
)

type marker struct{}

func (marker) Name() string { return "${namespace}/marker" }
func (marker) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (marker) Check(ctx *rule.Context, node *shimast.Node) {
  ctx.Report(node, "${namespace} active")
}

func init() { rule.Register(marker{}) }
`,
    "utf8",
  );
}

function writeConfig(location: string, selection: string): void {
  fs.writeFileSync(
    location,
    `module.exports = require(${JSON.stringify(selection)});\n`,
    "utf8",
  );
}

function writeSelection(
  location: string,
  namespace: "alpha" | "beta",
  source: string,
): void {
  fs.writeFileSync(
    location,
    `module.exports = ${JSON.stringify({
      plugins: { [namespace]: { source } },
      rules: { [`${namespace}/marker`]: "error" },
    })};\n`,
    "utf8",
  );
}

function assertFreshSample(
  sample: ResidentSample,
  previousPid: number | undefined,
): void {
  assert.ok(Number.isSafeInteger(sample.pid) && sample.pid > 0 && sample.pid !== process.pid);
  if (previousPid !== undefined) assert.notEqual(sample.pid, previousPid);
  assert.equal(sample.programLoads, 1);
  assert.equal(sample.programUpdates, 0);
  assert.equal(sample.reused, false);
}

async function waitForProcessExit(pid: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (processIsAlive(pid)) {
    if (Date.now() >= deadline) {
      assert.fail(
        `resident check sidecar ${String(pid)} survived config reload`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    throw error;
  }
}

function residentSamples(transcript: string): ResidentSample[] {
  return [
    ...transcript.matchAll(
      /@ttsc\/lint resident check: pid=(\d+) programLoads=(\d+) programUpdates=(\d+) reused=(true|false)/g,
    ),
  ].map((match) => ({
    pid: Number(match[1]),
    programLoads: Number(match[2]),
    programUpdates: Number(match[3]),
    reused: match[4] === "true",
  }));
}
