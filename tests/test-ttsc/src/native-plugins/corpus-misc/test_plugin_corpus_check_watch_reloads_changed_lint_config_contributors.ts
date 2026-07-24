import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../internal/plugin-corpus";
import { WatchSession } from "../../internal/watch";

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
 * 3. Require a fresh PID, cold Program, and only B's behavior in that cycle.
 */
export const test_plugin_corpus_check_watch_reloads_changed_lint_config_contributors =
  async (): Promise<void> => {
    const root = setupLintProject("lint-violations");
    const config = path.join(root, "lint.config.cjs");
    const shared = fs.mkdtempSync(
      path.join(path.dirname(root), "ttsc-lint-selection-"),
    );
    const selection = path.join(shared, "selection.cjs");
    const alpha = path.join(root, "contributors", "alpha");
    const beta = path.join(root, "contributors", "beta");
    fs.rmSync(path.join(root, "lint.config.json"), { force: true });
    writeContributor(alpha, "alpha");
    writeContributor(beta, "beta");
    writeConfig(config, selection);
    writeSelection(selection, "alpha", alpha);

    let session: WatchSession | undefined;
    try {
      session = new WatchSession(root, {
        args: ["--noEmit", "--diagnostics"],
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
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
    } finally {
      await session?.close();
      fs.rmSync(shared, { recursive: true, force: true });
    }
  };

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
    return (error as NodeJS.ErrnoException).code === "EPERM";
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
