import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../../internal/plugin-corpus";
import { WatchSession } from "../../../internal/watch";

type ResidentSample = {
  pid: number;
  programLoads: number;
  programUpdates: number;
  reused: boolean;
};

const projectInputContributor = `package projectinput

import (
  "path/filepath"

  "github.com/samchon/ttsc/packages/lint/rule"
)

type topologyRule struct{}

func (topologyRule) Name() string { return "topology/project-input" }
func (topologyRule) Check(*rule.ProjectContext) {}
func (topologyRule) ProjectInputs(ctx *rule.ProjectInputContext) []rule.ProjectInput {
  root := ctx.Identity.PhysicalProjectRoot
  return []rule.ProjectInput{
    {
      Kind: rule.ProjectInputFile,
      Pattern: filepath.Join(root, "docs", "spec.md"),
    },
    {
      Kind: rule.ProjectInputGlob,
      Pattern: filepath.ToSlash(filepath.Join(root, "api", "**", "*.json")),
    },
  }
}

func init() { rule.RegisterProject(topologyRule{}) }
`;

/**
 * Verifies real check-watch distinguishes JSON topology from data edits.
 *
 * The source imports an initially missing project-input JSON through
 * `resolveJsonModule`. Creating or deleting that file must cold-load the
 * Program while keeping the lint sidecar PID. Editing the loaded JSON and the
 * declared Markdown file must retain warm reuse.
 *
 * 1. Start with an unresolved JSON import and one resident Program load.
 * 2. Create the JSON and require a second load in the same sidecar.
 * 3. Edit JSON and Markdown content and require warm reuse.
 * 4. Delete the JSON and require another cold load without a process restart.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch keeps the same PID while JSON creation/deletion cold-loads the Program and JSON/Markdown content edits retain the exact warm load/update counter states.
 * @evidence contracts/testing.md#independent-expectations The explicit unresolved JSON import and declared file/glob inputs distinguish membership from content; literal five-step counter tables independently encode the required invalidation policy.
 * @evidence contracts/testing.md#distinguishing-cases Owns missing-to-present and present-to-missing JSON roots versus existing JSON/Markdown content changes, with the original contributor project-input protocol present in all cycles.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-misc export drives one actual watcher, linked Go project-input contributor and native Program in the Linux batch.
 * @evidence contracts/e2e.md#necessary-boundary The rule-input response, real filesystem notifications and native resident update decisions must agree on root-set invalidation; a watcher topology unit cannot prove those protocol handoffs.
 * @evidence contracts/e2e.md#shared-execution All five transitions reuse one consumer, watcher, contributor build and resident PID; batch cache/Go objects are shared and only Program membership changes require another Program load.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The JSON/Markdown paths and contributor/config belong to a private fixture, each transition waits for its completed cycle and quiet interval, and finally closes the watcher; no warm cache bypasses the required load counters.
 * @evidence contracts/e2e.md#preserved-coverage Original five cardinality/counter tables and mutation sequence remain unchanged. Neither extra cycles nor lost membership changes are ignored merely to shorten the run.
 */
export async function test_plugin_corpus_check_watch_invalidates_json_input_membership_without_restarting_resident(): Promise<void> {
  const root = setupLintProject("lint-violations");
  const source = path.join(root, "src", "main.ts");
  const markdown = path.join(root, "docs", "spec.md");
  const json = path.join(root, "api", "openapi.json");
  fs.mkdirSync(path.join(root, "contributors", "project-input"), {
    recursive: true,
  });
  fs.mkdirSync(path.dirname(markdown), { recursive: true });
  fs.writeFileSync(
    path.join(root, "contributors", "project-input", "project_input.go"),
    projectInputContributor,
    "utf8",
  );
  fs.writeFileSync(markdown, "# Contract\n", "utf8");
  fs.writeFileSync(
    source,
    [
      'import contract from "../api/openapi.json";',
      "export const contractName: string = contract.name;",
      "JSON.stringify(contractName);",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        esModuleInterop: true,
        module: "commonjs",
        noEmit: true,
        plugins: [{ transform: "@ttsc/lint" }],
        resolveJsonModule: true,
        rootDir: ".",
        strict: true,
        target: "ES2022",
      },
      include: ["src"],
    }),
    "utf8",
  );
  fs.rmSync(path.join(root, "lint.config.json"), { force: true });
  fs.writeFileSync(
    path.join(root, "lint.config.cjs"),
    `const path = require("node:path");
module.exports = {
  plugins: {
    topology: {
      source: path.join(__dirname, "contributors", "project-input"),
    },
  },
  rules: {
    "topology/project-input": "error",
  },
};
`,
    "utf8",
  );

  const session = new WatchSession(root, {
    args: ["--noEmit", "--diagnostics"],
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      TTSC_WATCH_DEBUG_INPUTS: "1",
    },
  });
  try {
    await session.waitForBuilds(1, 300_000);
    let samples = residentSamples(session.transcript());
    assert.equal(samples.length, 1, session.transcript());
    assert.deepEqual(samples[0], {
      pid: samples[0]!.pid,
      programLoads: 1,
      programUpdates: 0,
      reused: false,
    });

    fs.mkdirSync(path.dirname(json), { recursive: true });
    fs.writeFileSync(json, '{"name":"created"}\n', "utf8");
    await session.waitForBuilds(2);
    await session.waitForQuiet(300);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 2, session.transcript());
    assert.deepEqual(
      samples[1],
      {
        pid: samples[0]!.pid,
        programLoads: 2,
        programUpdates: 0,
        reused: false,
      },
      session.transcript(),
    );

    fs.writeFileSync(json, '{"name":"edited"}\n', "utf8");
    await session.waitForBuilds(3);
    await session.waitForQuiet(300);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 3, session.transcript());
    assert.deepEqual(samples[2], {
      pid: samples[0]!.pid,
      programLoads: 2,
      programUpdates: 1,
      reused: true,
    });

    fs.writeFileSync(markdown, "# Revised contract\n", "utf8");
    await session.waitForBuilds(4);
    await session.waitForQuiet(300);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 4, session.transcript());
    assert.deepEqual(samples[3], {
      pid: samples[0]!.pid,
      programLoads: 2,
      programUpdates: 1,
      reused: true,
    });

    fs.rmSync(json);
    await session.waitForBuilds(5);
    await session.waitForQuiet(300);
    samples = residentSamples(session.transcript());
    assert.equal(samples.length, 5, session.transcript());
    assert.deepEqual(samples[4], {
      pid: samples[0]!.pid,
      programLoads: 3,
      programUpdates: 1,
      reused: false,
    });
  } finally {
    await session.close();
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
