import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { spawnSyncWithLowDescriptors } from "../../../../../packages/ttsc/lib/internal/spawnSyncResilient.js";

/** The Darwin EBADF recovery broker preserves argv, I/O and failure results. */
export const test_spawn_sync_resilient_broker_preserves_process_contract =
  (): void => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-spawn-broker-"));
    try {
      const stdout = path.join(root, "stdout");
      const stderr = path.join(root, "stderr");
      const marker = 'literal $() `" ; & | argument';
      const success = spawnSyncWithLowDescriptors(
        process.execPath,
        [
          "-e",
          [
            "process.stdout.write(JSON.stringify({",
            "  arg: process.argv[1],",
            "  cwd: process.cwd(),",
            "  value: process.env.TTSC_BROKER_VALUE,",
            "}));",
            'process.stderr.write("diagnostic");',
          ].join("\n"),
          marker,
        ],
        {
          cwd: root,
          env: { ...process.env, TTSC_BROKER_VALUE: "preserved" },
          timeout: 30_000,
        },
        { stderr, stdout },
      );
      assert.equal(success.error, undefined);
      assert.equal(success.signal, null);
      assert.equal(success.status, 0);
      assert.deepEqual(JSON.parse(fs.readFileSync(stdout, "utf8")), {
        arg: marker,
        cwd: root,
        value: "preserved",
      });
      assert.equal(fs.readFileSync(stderr, "utf8"), "diagnostic");

      const nonzero = spawnSyncWithLowDescriptors(
        process.execPath,
        ["-e", "process.exit(23)"],
        { cwd: root, env: process.env, timeout: 30_000 },
        { stderr, stdout },
      );
      assert.equal(nonzero.error, undefined);
      assert.equal(nonzero.signal, null);
      assert.equal(nonzero.status, 23);

      const missing = spawnSyncWithLowDescriptors(
        path.join(root, "missing-command"),
        [],
        { cwd: root, env: process.env, timeout: 30_000 },
        { stderr, stdout },
      );
      assert.equal(missing.status, null);
      assert.equal(
        (missing.error as NodeJS.ErrnoException | undefined)?.code,
        "ENOENT",
      );
      if (process.platform !== "win32") {
        const signaled = spawnSyncWithLowDescriptors(
          process.execPath,
          ["-e", 'process.kill(process.pid, "SIGTERM")'],
          { cwd: root, env: process.env, timeout: 30_000 },
          { stderr, stdout },
        );
        assert.equal(signaled.error, undefined);
        assert.equal(signaled.signal, "SIGTERM");
        assert.equal(signaled.status, null);

        const timedOut = spawnSyncWithLowDescriptors(
          process.execPath,
          ["-e", "setInterval(() => undefined, 10_000)"],
          {
            cwd: root,
            env: process.env,
            killSignal: "SIGKILL",
            timeout: 50,
          },
          { stderr, stdout },
        );
        assert.equal(
          (timedOut.error as NodeJS.ErrnoException | undefined)?.code,
          "ETIMEDOUT",
        );
        assert.equal(timedOut.signal, "SIGKILL");
        assert.equal(timedOut.status, null);
      }
      assert.deepEqual(
        fs.readdirSync(root).sort(),
        ["stderr", "stdout"],
        "the broker result file must be removed after every outcome",
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
