import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a module whose host's tool directory cannot be written is handed a
 * record in the fallback the host accepts, and that a watching session with no
 * such place refuses the module rather than serve it without one
 * (samchon/ttsc#1480).
 *
 * A module handed to a build host without its project's record depends on its
 * own bytes alone. The adapter marked it uncacheable and warned, which keeps a
 * one-shot build and a host's persistent cache correct, but a watching session
 * never ran it again after an edit to a type its output consulted, and Farm,
 * which offers no per-module cache opt-out, restored it after a restart. The
 * record now lives in a fallback below the user's temporary directory where the
 * host accepts one, and a watching session that has none fails the delivery,
 * naming the directory, instead of serving output it cannot keep current.
 *
 * 1. Give the host a tool directory the record cannot be written below, a file
 *    standing where its record directory would be, and a fallback; deliver a
 *    module, and assert the record is written in the fallback and handed over,
 *    the module is not marked uncacheable, and nothing is warned.
 * 2. Deliver it in a watching session with no fallback, and assert the delivery
 *    fails naming the record, while the same delivery outside a watching
 *    session is only marked uncacheable.
 * 3. Give a host with no fallback a record that is there but read-only, deliver in
 *    a watching session, and assert that record is handed over all the same: it
 *    stands for the last state written until a write lands.
 */
export async function test_transformttsc_hands_a_fallback_record_or_refuses_a_watching_delivery(): Promise<void> {
  const {
    PROJECT_RECORD_DIRECTORY,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const main = TestUnpluginProject.mainFile(root);
  const toolDirectory = path.join(
    TestProject.tmpdir("ttsc-unplugin-fallback-tool-"),
    ".ttsc",
  );
  fs.mkdirSync(toolDirectory, { recursive: true });
  fs.writeFileSync(path.join(toolDirectory, PROJECT_RECORD_DIRECTORY), "");
  const fallbackToolDirectory = path.join(
    TestProject.tmpdir("ttsc-unplugin-fallback-"),
    "host",
  );
  const warnings: Error[] = [];
  const listen = (warning: Error & { code?: string }) => {
    if (warning.code === "TTSC_PROJECT_RECORD_UNWRITABLE")
      warnings.push(warning);
  };
  process.on("warning", listen);
  try {
    const cache = createTtscTransformCache();
    const deliver = async (project: {
      fallbackToolDirectory?: string;
      watching?: boolean;
    }) => {
      const handed: string[] = [];
      let volatile = 0;
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
            ...project,
          },
        },
      );
      return { handed, volatile };
    };

    // 1. The fallback holds the record.
    const fallback = await deliver({ fallbackToolDirectory, watching: true });
    assert.equal(fallback.handed.length, 1);
    assert.equal(
      path.dirname(path.dirname(fallback.handed[0]!)),
      fallbackToolDirectory,
      "the record lives in the fallback",
    );
    assert.equal(fs.existsSync(fallback.handed[0]!), true);
    assert.equal(fallback.volatile, 0, "a module with its record is cacheable");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(warnings, [], "nothing to warn about");

    // 2. No place at all.
    await assert.rejects(
      deliver({ watching: true }),
      (error: Error & { name?: string }) =>
        error.name === "TtscProjectRecordUnwritableError" &&
        error.message.includes(
          path.join(toolDirectory, PROJECT_RECORD_DIRECTORY),
        ),
    );
    const oneShot = await deliver({});
    assert.deepEqual(oneShot.handed, []);
    assert.equal(oneShot.volatile, 1, "a one-shot build is kept out of caches");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(warnings.length, 1, "one warning for the record");

    // 3. A record that is there, without a fallback.
    const existingTool = path.join(
      TestProject.tmpdir("ttsc-unplugin-existing-tool-"),
      ".ttsc",
    );
    const existing = await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      resolveOptions(),
      undefined,
      createTtscTransformCache(),
      {
        project: {
          register: () => undefined,
          toolDirectory: existingTool,
        },
      },
    );
    assert.ok(existing);
    const record = path.join(
      existingTool,
      PROJECT_RECORD_DIRECTORY,
      fs.readdirSync(path.join(existingTool, PROJECT_RECORD_DIRECTORY))[0]!,
    );
    fs.chmodSync(record, 0o444);
    try {
      const kept = await (async () => {
        const handed: string[] = [];
        await transformTtsc(
          main,
          fs.readFileSync(main, "utf8"),
          resolveOptions(),
          undefined,
          createTtscTransformCache(),
          {
            project: {
              register: (registration: { record: string }) =>
                handed.push(registration.record),
              toolDirectory: existingTool,
              watching: true,
            },
          },
        );
        return handed;
      })();
      assert.deepEqual(kept, [record], "the record that is there");
    } finally {
      fs.chmodSync(record, 0o644);
    }
  } finally {
    process.off("warning", listen);
  }
}
