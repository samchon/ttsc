import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";

const { spawnSync } = E2eProcessTrace;

/**
 * Verifies a new process witnesses the dependency-only paths the project's
 * record names before its first compile, so it compiles once, and still
 * compiles the current content of a dependency edited while nothing ran
 * (samchon/ttsc#1743).
 *
 * A compile learns a plugin-reported dependency path only from its own
 * envelope, and one it had no witness for compiles again. The witness list
 * lived in memory with the transform cache, so every new process of a host
 * without a session store compiled such a project twice.
 *
 * 1. Transform the entry in a process of its own with a host record directory: it
 *    compiles twice, learning the reported file, and writes the record.
 * 2. Do it again in a new process: it compiles once.
 * 3. Edit the reported file while nothing runs, and do it again: it compiles once
 *    and serves the edited content.
 *
 * @evidence contracts/testing.md#behavioral-verification Three fresh host processes yield compile counts two, three and four and the PLUGIN:FIRST, PLUGIN:FIRST, PLUGIN:SECOND outputs.
 * @evidence contracts/testing.md#independent-expectations The run log's byte count fixes the compiles, and the authored helper content fixes each output.
 * @evidence contracts/testing.md#distinguishing-cases A cold process, a new process over an unchanged project and a new process after an offline dependency edit are separate rows.
 * @evidence contracts/testing.md#execution-ownership This scenario owns fresh Node processes of the built adapter, a private project, run log and host record directory; each process completes before its counts are asserted.
 * @evidence contracts/e2e.md#necessary-boundary The record is written by one process and read by another through the built adapter and the real native producer; an in-process cache cannot show the cross-process witness.
 * @evidence contracts/e2e.md#shared-execution One fixture project and record directory are reused across this case's processes; native artifacts share the suite's build cache.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project, run log, external helper and record directory keep other cases' records out; no session store is opened, so no publication can be adopted instead.
 * @evidence contracts/e2e.md#preserved-coverage New coverage; no existing assertion is moved or removed.
 */
export async function test_transformttsc_a_new_process_witnesses_the_dependencies_its_record_names(): Promise<void> {
  const external = path.join(
    TestProject.tmpdir("ttsc-unplugin-record-witness-external-"),
    "helper.ts",
  );
  fs.writeFileSync(external, "first\n", "utf8");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-record-witness-log-"),
    "compiles.bin",
  );
  const toolDirectory = TestProject.tmpdir(
    "ttsc-unplugin-record-witness-tool-",
  );
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external);
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
    {
      transform: "./plugin.cjs",
      name: "reader",
      operation: "read-configured-helper",
      path: relative,
    },
    {
      transform: "./plugin.cjs",
      name: "reporter",
      operation: "emit-dependencies",
      dependencies: [relative.split(path.sep).join("/")],
    },
    {
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    },
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);

  /** One host process: transform the module with a record directory, exit. */
  const run = (): string => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.TTSC_UNPLUGIN_TRANSFORM_SESSION;
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `const api = await import(${JSON.stringify(TestUnpluginRuntime.libUrl("api"))});`,
          'const fs = await import("node:fs");',
          "const [file, toolDirectory] = JSON.parse(process.argv[1]);",
          "const cache = api.createTtscTransformCache();",
          "const hooks = { project: { register: () => undefined, toolDirectory } };",
          'const result = await api.transformTtsc(file, fs.readFileSync(file, "utf8"), api.resolveOptions(), undefined, cache, hooks);',
          'process.stdout.write(result?.code ?? "");',
        ].join("\n"),
        JSON.stringify([main, toolDirectory]),
      ],
      { encoding: "utf8", env, windowsHide: true },
    );
    assert.equal(child.status, 0, child.stderr);
    return child.stdout;
  };

  assert.match(run(), /PLUGIN:FIRST/);
  assert.equal(compiles(), 2, "a cold process learns the reported file");

  assert.match(run(), /PLUGIN:FIRST/);
  assert.equal(compiles(), 3, "a new process witnesses it from the record");

  fs.writeFileSync(external, "second\n", "utf8");
  assert.match(run(), /PLUGIN:SECOND/);
  assert.equal(compiles(), 4, "the edited content, compiled once");
}
