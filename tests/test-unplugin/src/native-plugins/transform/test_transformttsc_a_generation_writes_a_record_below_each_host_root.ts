import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies one generation delivered in one process to two hosts whose roots
 * differ hands each host the record below its own root, and writes both.
 *
 * A process can run two build hosts over one project with the same options,
 * such as esbuild with an `absWorkingDir` of its own beside a bundler in the
 * directory the process runs in, and they share the generation. The record is
 * named by the host's root, the one place each host accepts it, but the adapter
 * kept one record per generation, so the second host was handed the first
 * host's record, outside its own root, and nothing was written below it.
 *
 * 1. Deliver a module of a project to a host whose tool directory is one
 *    directory, then the same module from the same cache to a host whose tool
 *    directory is another, and assert the project compiled once.
 * 2. Assert each host was handed one record, below its own tool directory.
 * 3. Assert both records hold the generation's state under one name.
 */
export async function test_transformttsc_a_generation_writes_a_record_below_each_host_root(): Promise<void> {
  const {
    createTtscTransformCache,
    readProjectRecordFile,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-host-roots-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
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
  const cache = createTtscTransformCache();
  const deliver = async (toolDirectory: string): Promise<string[]> => {
    const handed: string[] = [];
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      resolveOptions(),
      undefined,
      cache,
      {
        project: {
          register: (registration: { record: string }) =>
            handed.push(registration.record),
          toolDirectory,
        },
      },
    );
    return handed;
  };
  const tools = ["a", "b"].map((name) =>
    path.join(TestProject.tmpdir(`ttsc-unplugin-host-root-${name}-`), ".ttsc"),
  );

  const records: string[] = [];
  for (const tool of tools) {
    const handed = await deliver(tool);
    assert.equal(handed.length, 1, `one record for the host below ${tool}`);
    records.push(handed[0]!);
  }
  assert.equal(compiles(), 1, "the two hosts share one generation");

  tools.forEach((tool, index) => {
    const relative = path.relative(tool, records[index]!);
    assert.ok(
      !relative.startsWith("..") && !path.isAbsolute(relative),
      `the host below ${tool} takes a record below it: ${records[index]}`,
    );
    assert.ok(
      readProjectRecordFile(records[index]!) !== undefined,
      `the record below ${tool} holds the generation's state`,
    );
  });
  assert.equal(
    path.basename(records[0]!),
    path.basename(records[1]!),
    "both records are the project's",
  );
}
