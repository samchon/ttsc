const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { partitionFiles, runPool } = require("./feature-worker-pool.cjs");

test("feature workers isolate state and collect failures", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-worker-test-"));
  try {
    for (const dir of ["a", "b"]) fs.mkdirSync(path.join(root, dir));
    for (const file of [
      "a/test_first.ts",
      "a/test_failure.ts",
      "a/test_excluded.ts",
      "b/test_first.ts",
      "b/test_last.ts",
    ])
      fs.writeFileSync(
        path.join(root, file),
        "throw new Error('discovery must not import');",
      );
    const groups = partitionFiles(
      [path.join(root, "a"), path.join(root, "b")],
      (name) => !name.includes("excluded"),
      2,
    );
    assert.deepEqual(groups.flat().sort(), [
      "test_failure.ts",
      "test_first.ts",
      "test_last.ts",
    ]);
    assert.throws(() => partitionFiles([], () => true, 0), /positive integer/);
    const entry = path.join(root, "worker.cjs");
    fs.writeFileSync(
      entry,
      `
      const fs = require('node:fs');
      const path = require('node:path');
      const names = JSON.parse(fs.readFileSync(process.env.TTSC_TEST_WORKER_FILES, 'utf8'));
      if (process.env.ISOLATED_MUTATION) process.exit(9);
      process.env.ISOLATED_MUTATION = 'yes';
      const original = process.cwd();
      process.chdir(path.dirname(process.env.TTSC_TEST_WORKER_FILES));
      fs.writeFileSync(path.join(original, names[0] + '.json'), JSON.stringify({ names, original, workers: process.env.TTSC_TEST_WORKERS }));
      process.exitCode = names.includes('test_failure.ts') ? 1 : 0;
    `,
    );
    const failures = await runPool(groups, {
      args: [entry],
      cwd: root,
      stdio: "pipe",
    });
    assert.deepEqual(
      failures,
      groups.filter((group) => group.includes("test_failure.ts")),
    );
    const reports = groups.map((group) =>
      JSON.parse(fs.readFileSync(path.join(root, group[0] + ".json"), "utf8")),
    );
    assert.deepEqual(
      reports.flatMap((report) => report.names).sort(),
      groups.flat().sort(),
    );
    assert.ok(
      reports.every(
        (report) => report.original === root && report.workers === "1",
      ),
    );
    assert.equal(process.env.ISOLATED_MUTATION, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
