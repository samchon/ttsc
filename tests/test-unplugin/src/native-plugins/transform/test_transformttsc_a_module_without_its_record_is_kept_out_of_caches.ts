import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a module the adapter cannot hand its project's record to is marked
 * uncacheable, and that the user is told once why.
 *
 * A build host watches a module and its record and nothing else, so a module
 * handed over without the record depends on its own bytes alone, and a host's
 * persistent cache restored it on those whatever its types did; nothing said
 * the host had lost the project's state. A record that does not exist is not
 * handed over, since what a host does with a dependency on a missing path
 * differs per host, so the module is marked uncacheable instead and a process
 * warning names the record and the cause.
 *
 * 1. Give the host a tool directory the record cannot be written below: a file
 *    stands where its record directory would be.
 * 2. Deliver a module twice and assert no record is handed over, the module is
 *    marked uncacheable at each delivery, and one warning names the record.
 */
export async function test_transformttsc_a_module_without_its_record_is_kept_out_of_caches(): Promise<void> {
  const {
    PROJECT_RECORD_DIRECTORY,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
    {
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog: path.join(
        TestProject.tmpdir("ttsc-unplugin-unwritable-log-"),
        "compiles.bin",
      ),
    },
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const main = TestUnpluginProject.mainFile(root);
  const toolDirectory = path.join(
    TestProject.tmpdir("ttsc-unplugin-unwritable-tool-"),
    ".ttsc",
  );
  fs.mkdirSync(toolDirectory, { recursive: true });
  fs.writeFileSync(path.join(toolDirectory, PROJECT_RECORD_DIRECTORY), "");
  const warnings: Error[] = [];
  const listen = (warning: Error & { code?: string }) => {
    if (warning.code === "TTSC_PROJECT_RECORD_UNWRITABLE")
      warnings.push(warning);
  };
  process.on("warning", listen);
  try {
    const cache = createTtscTransformCache();
    const handed: string[] = [];
    let volatile = 0;
    for (let delivery = 0; delivery < 2; delivery += 1) {
      await transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        resolveOptions(),
        undefined,
        cache,
        {
          markVolatile: () => {
            volatile += 1;
          },
          project: {
            register: (registration: { record: string }) =>
              handed.push(registration.record),
            toolDirectory,
          },
        },
      );
    }
    // A process warning is emitted on the next turn of the event loop.
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(handed, [], "no record is handed over");
    assert.equal(volatile, 2, "the module is uncacheable at each delivery");
    assert.equal(warnings.length, 1, "one warning for the record");
    assert.ok(
      warnings[0]!.message.includes(
        path.join(toolDirectory, PROJECT_RECORD_DIRECTORY),
      ),
      `the warning names the record: ${warnings[0]!.message}`,
    );
  } finally {
    process.off("warning", listen);
  }
}
