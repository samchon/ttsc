import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Verifies the isolated descriptor recorder publishes each observed edge in
 * order, refuses a missing selected file, and reports an open failure.
 *
 * 1. Load several authored modules under the real runtime hooks in one child.
 * 2. Close the report before its final observation and compare both channels.
 * 3. Repeat with a directory as the report destination, retaining child execution
 *    while refusing a complete observation.
 * 4. Resolve an absent file through a public hook without loading it and refuse
 *    its selected-file proof while keeping ordinary missing candidates valid.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Node hook evaluation returns every authored module, emits one valid NDJSON line per recorded edge in exactly the envelope's order, marks an open failure incomplete while modules still run, and marks a missing selected file unstable after resolve-only selection.
 * @evidence contracts/testing.md#independent-expectations Authored module exports and paths establish the execution and membership oracle; equal serialized channel bytes and valid individual JSON records establish transport without deriving expected source outputs from the recorder.
 * @evidence contracts/testing.md#distinguishing-cases Writable and unwritable destinations contrast completion with open failure; selected absent/present file URLs and a failed ordinary lookup separate selected-file proof from valid missing candidates; several distinct modules exercise ordered appends.
 * @evidence contracts/testing.md#execution-ownership The matching E2E batch entry starts the built runtime hook in real Node children; source units own portable record parsing, while this case owns public hook ordering, process/report transport and child completion.
 * @evidence contracts/e2e.md#necessary-boundary The actual preload, public Node resolve hook, filesystem descriptor and child exit must connect to observe whether resolve-only virtual selection is refused and a completed report matches its envelope.
 * @evidence contracts/e2e.md#shared-execution The child invocations reuse one prepared built runtime and owned root; the transport failure changes only the report destination, while the selection child adds one public resolver hook and authored paths.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns a private root and output paths; each synchronous child finalizes its report before snapshot and exits before assertions, and no result cache or watcher is shared across children.
 * @evidence contracts/e2e.md#preserved-coverage Report success, ordered records and open-failure assertions remain; this case adds resolve-only selected-file refusal, while descriptor and capability cache replay belong to their owning tests.
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
    "const [reportModule, observation, serializedModules] = process.argv.slice(1);",
    "const { PluginDescriptorInputReport } = require(reportModule);",
    "const { PluginDescriptorInputObservation } = require(observation);",
    'process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE = "1";',
    "const members = JSON.parse(serializedModules).map((file) => require(file));",
    "PluginDescriptorInputReport.finish();",
    "process.stdout.write(JSON.stringify({ members, observed: PluginDescriptorInputObservation.snapshot() }));",
  ].join("\n");
  const run = (report: string) => {
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

  const missingSelected = path.join(root, "selected-missing.cjs");
  const presentSelected = path.join(root, "selected-present.cjs");
  fs.writeFileSync(presentSelected, "module.exports = 1;\n", "utf8");
  const selectedHook = path.join(root, "selected-hook.cjs");
  fs.writeFileSync(
    selectedHook,
    [
      'const { registerHooks } = require("node:module");',
      'const { pathToFileURL } = require("node:url");',
      "registerHooks({ resolve(specifier, context, nextResolve) {",
      '  if (specifier === "ttsc-selected-missing") return { shortCircuit: true, url: pathToFileURL(process.env.TTSC_TEST_SELECTED_MISSING).href };',
      '  if (specifier === "ttsc-selected-present") return { shortCircuit: true, url: pathToFileURL(process.env.TTSC_TEST_SELECTED_PRESENT).href };',
      '  if (specifier === "ttsc-cjs-hook-probe") return { shortCircuit: true, url: pathToFileURL(process.env.TTSC_TEST_SELECTED_PRESENT).href };',
      "  return nextResolve(specifier, context);",
      "} });",
    ].join("\n"),
    "utf8",
  );
  const selectedActor = [
    'import path from "node:path";',
    'import { createRequire } from "node:module";',
    "const [reportModule, observationModule] = process.argv.slice(1);",
    'process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE = "1";',
    'const esmMissing = import.meta.resolve("ttsc-selected-missing");',
    'const esmPresent = import.meta.resolve("ttsc-selected-present");',
    'const requireFromHere = createRequire(path.join(process.cwd(), "entry.cjs"));',
    'let cjsHookSupported = false; try { const probe = requireFromHere.resolve("ttsc-cjs-hook-probe"); if (probe !== process.env.TTSC_TEST_SELECTED_PRESENT) throw new Error(`unexpected CJS hook probe: ${probe}`); cjsHookSupported = true; } catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }',
    'const cjsMissing = cjsHookSupported ? requireFromHere.resolve("ttsc-selected-missing") : null;',
    'let failedLookup = false; try { import.meta.resolve("ttsc-ordinary-missing"); } catch { failedLookup = true; }',
    'const { PluginDescriptorInputReport } = createRequire(path.join(process.cwd(), "entry.cjs"))(reportModule);',
    'const { PluginDescriptorInputObservation } = createRequire(path.join(process.cwd(), "entry.cjs"))(observationModule);',
    "PluginDescriptorInputReport.finish();",
    "process.stdout.write(JSON.stringify({ esmMissing, esmPresent, cjsHookSupported, cjsMissing, failedLookup, observed: PluginDescriptorInputObservation.snapshot() }));",
  ].join("\n");
  const selectedReport = path.join(root, "selected-inputs.ndjson");
  const selectedChild = childProcess.spawnSync(
    process.execPath,
    [
      "--require",
      selectedHook,
      "--require",
      preload,
      "--input-type=module",
      "-e",
      selectedActor,
      reportModule,
      observation,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE: "0",
        TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT: selectedReport,
        TTSC_TEST_SELECTED_MISSING: missingSelected,
        TTSC_TEST_SELECTED_PRESENT: presentSelected,
      },
      windowsHide: true,
    },
  );
  const selectedDetails = `${selectedChild.stdout ?? ""}\n${selectedChild.stderr ?? ""}`;
  assert.equal(selectedChild.error, undefined, selectedDetails);
  assert.equal(selectedChild.signal, null, selectedDetails);
  assert.equal(selectedChild.status, 0, selectedDetails);
  const selected = JSON.parse(selectedChild.stdout) as {
    esmMissing: string;
    esmPresent: string;
    cjsHookSupported: boolean;
    cjsMissing: string | null;
    failedLookup: boolean;
    observed: { complete: boolean; lines: string[] };
  };
  assert.equal(selected.esmMissing, pathToFileURL(missingSelected).href);
  assert.equal(selected.esmPresent, pathToFileURL(presentSelected).href);
  assert.equal(selected.cjsHookSupported, selected.cjsMissing !== null);
  if (selected.cjsHookSupported)
    assert.equal(selected.cjsMissing, missingSelected);
  assert.equal(selected.failedLookup, true);
  assert.equal(selected.observed.complete, true);
  assert.equal(
    fs.readFileSync(selectedReport, "utf8"),
    selected.observed.lines.join(""),
  );
  const selectedRecords = selected.observed.lines.map(
    (line) =>
      JSON.parse(line) as {
        hash?: string | null;
        realpath?: string | null;
        resolved?: string;
        unstable?: boolean;
      },
  );
  const missingRecords = selectedRecords.filter(
    (record) => record.resolved === missingSelected,
  );
  assert.ok(missingRecords.length >= (selected.cjsMissing === null ? 1 : 2));
  assert.ok(missingRecords.every((record) => record.unstable === true));
  assert.ok(
    selectedRecords.some(
      (record) =>
        record.resolved === presentSelected &&
        typeof record.hash === "string" &&
        typeof record.realpath === "string" &&
        record.unstable !== true,
    ),
  );
  assert.ok(
    selectedRecords.some(
      (record) =>
        record.resolved?.includes("ttsc-ordinary-missing") &&
        record.hash === null &&
        record.realpath === null &&
        record.unstable !== true,
    ),
  );
}
