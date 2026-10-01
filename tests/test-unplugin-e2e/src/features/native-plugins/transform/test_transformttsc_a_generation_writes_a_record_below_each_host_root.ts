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
 * The record's path is the host's root's, while a generation is the cache's,
 * and one cache can reach hosts whose roots differ: a caller of `transformTtsc`
 * can hand one cache to hosts of its own, and the adapters' process-wide cache
 * names the root of each delivery by the directory the process runs in at the
 * time. The adapter kept one record per generation, so the second host was
 * handed the first host's record, outside its own root, and nothing was written
 * below it.
 *
 * 1. Deliver a module of a project to a host whose tool directory is one
 *    directory, then the same module from the same cache to a host whose tool
 *    directory is another, and assert the project compiled once.
 * 2. Assert each host was handed one record, below its own tool directory.
 * 3. Assert both records hold the generation's state under one name.
 *
 * @evidence contracts/testing.md#behavioral-verification Two project-register host contexts deliver the same main through one cache; the native run log must show one capture. Each context must receive one record physically below its own tool directory, readProjectRecordFile must decode both, and both record basenames must identify the same project.
 * @evidence contracts/testing.md#independent-expectations A record belongs to the receiving host tool root even when generation identity is shared. Relative-path containment and independently counted native invocations require two publications from one capture; decoding generated records exercises publication behavior, not committed-file arrangement. Record content equality is not asserted beyond readability and name.
 * @evidence contracts/testing.md#distinguishing-cases First versus second distinct host root reuse the same source/options/generation. The second must not inherit the first record location. Unwritable record fallback and volatility are owned by separate entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_generation_writes_a_record_below_each_host_root in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary Real native capture, transform-cache reuse and on-disk project-record publication meet two host registration contexts. Direct record-path calculation cannot prove cached delivery writes and hands each host its own usable record.
 * @evidence contracts/e2e.md#shared-execution One createProject, shared counting-plugin artifact, main source and cache serve both hosts. Unique tool directories are required by the host-root routing distinction, while the real capture is shared and asserted once.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Project, run log and both tool directories are separately allocated by TestProject. Host callbacks retain their own handed arrays, preventing earlier registrations becoming later results. This entry does not explicitly reset its local cache; build-independent trackers and temporary resources end with the runner, a narrower lifetime than immediate per-case release.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_generation_writes_a_record_below_each_host_root; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
