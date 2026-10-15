import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the isolated descriptor recorder publishes each observed edge in
 * order and refuses completeness when its report cannot be opened.
 *
 * 1. Load several authored modules under the real runtime hooks in one child.
 * 2. Close the report before its final observation and compare both channels.
 * 3. Repeat with an invalid destination and a close refusal, retaining child
 *    execution while refusing complete observations.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Node hook evaluation returns every authored module, emits one valid NDJSON line per recorded edge in exactly the envelope's order, and marks open or close failure incomplete while the loaded modules still run.
 * @evidence contracts/testing.md#independent-expectations Authored module exports and paths establish the execution and membership oracle; equal serialized channel bytes and valid individual JSON records establish transport without deriving expected source outputs from the recorder.
 * @evidence contracts/testing.md#distinguishing-cases Writable and unwritable destinations plus a close refusal contrast completion with both failure stages; several distinct modules exercise ordered repeated appends, and an empty report is rejected by positive membership assertions.
 * @evidence contracts/testing.md#execution-ownership The matching E2E batch entry starts the built runtime hook in a real Node child; source units own portable record parsing, while this case owns process/report transport and child completion.
 * @evidence contracts/e2e.md#necessary-boundary The actual preload, Node module hooks, filesystem descriptor and child exit must connect to observe whether a completed report matches its envelope and failure stays advisory.
 * @evidence contracts/e2e.md#shared-execution All child invocations reuse one prepared built runtime and one authored module tree; failure runs change only the report destination or the close result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns a private root and output paths; each synchronous child finalizes its report before snapshot and exits before assertions, and no result cache or watcher is shared across children.
 * @evidence contracts/e2e.md#preserved-coverage This case adds report success and open failure coverage; descriptor module graph and cache reuse cases remain in their existing entries.
 */
export function test_ttsc_descriptor_input_report_preserves_order_and_failure(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-descriptor-report-"),
  );
  const preload = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "internal",
    "runtimeHookPreload.js",
  );
  const reportModule = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "internal",
    "runtime",
    "PluginDescriptorInputReport.js",
  );
  const observation = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "internal",
    "runtime",
    "PluginDescriptorInputObservation.js",
  );
  const modules = Array.from({ length: 12 }, (_, index) =>
    path.join(root, `member-${index}.cjs`),
  );
  for (const [index, file] of modules.entries())
    fs.writeFileSync(file, `module.exports = ${index};\n`, "utf8");
  const actor = [
    'const fs = require("node:fs");',
    "const [reportModule, observation, serializedModules, failClose] = process.argv.slice(1);",
    "const { PluginDescriptorInputReport } = require(reportModule);",
    "const { PluginDescriptorInputObservation } = require(observation);",
    'process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE = "1";',
    "const members = JSON.parse(serializedModules).map((file) => require(file));",
    "if (failClose === '1') {",
    "  const close = fs.closeSync;",
    "  fs.closeSync = (fd) => { close(fd); throw new Error('simulated close failure'); };",
    "}",
    "PluginDescriptorInputReport.finish();",
    "process.stdout.write(JSON.stringify({ members, observed: PluginDescriptorInputObservation.snapshot() }));",
  ].join("\n");
  const run = (report: string, failClose = false) => {
    const result = childProcess.spawnSync(
      process.execPath,
      [
        "--require",
        preload,
        "-e",
        actor,
        reportModule,
        observation,
        JSON.stringify(modules),
        failClose ? "1" : "0",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE: "0",
          TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT: report,
        },
        windowsHide: true,
      },
    );
    const details = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.error, undefined, details);
    assert.equal(result.signal, null, details);
    assert.equal(result.status, 0, details);
    return JSON.parse(result.stdout) as {
      members: number[];
      observed: { complete: boolean; lines: string[] };
    };
  };
  const report = path.join(root, "inputs.ndjson");
  const healthy = run(report);
  assert.deepEqual(
    healthy.members,
    modules.map((_, index) => index),
  );
  assert.equal(healthy.observed.complete, true);
  const onDisk = fs.readFileSync(report, "utf8");
  assert.equal(onDisk, healthy.observed.lines.join(""));
  const records = onDisk
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { resolved?: string });
  assert.ok(records.length >= modules.length);
  for (const file of modules)
    assert.ok(
      records.some((record) => record.resolved === file),
      file,
    );

  const failed = run(root);
  assert.deepEqual(failed.members, healthy.members);
  assert.equal(failed.observed.complete, false);

  const refusedClose = run(path.join(root, "close-failure.ndjson"), true);
  assert.deepEqual(refusedClose.members, healthy.members);
  assert.equal(refusedClose.observed.complete, false);
}
