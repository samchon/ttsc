import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { prepareExecution } from "../../../../../packages/ttsc/src/launcher/internal/prepareExecution";

/**
 * Verifies explicit runtime caches refuse POSIX paths with no string address.
 *
 * 1. Create a cache alias to a native byte directory and a UTF-8 lookalike.
 * 2. Select the alias by cache option and environment, including a missing child.
 * 3. Confirm neither target acquired a run. Admit the genuine U+FFFD directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual runtime preparation through both cache configuration paths. Refusal precedes directory creation and run claims. A genuine U+FFFD cache reaches the normal run callback.
 * @evidence contracts/testing.md#independent-expectations The two byte paths and their sentinel are independently authored. The callback uses a distinct exception to prove accepted storage without building the project.
 * @evidence contracts/testing.md#distinguishing-cases Existing terminal alias, missing descendant, environment override, and genuine U+FFFD spelling expose different paths through acquisition. The Linux gate covers a host that supports raw byte filenames.
 * @evidence contracts/testing.md#execution-ownership The fixture and its runtime claim belong to this unit. It stops preparation at the callback before compilation, supplies an explicit environment, and removes its own temporary tree.
 */
export function test_explicit_runtime_cache_rejects_lossy_physical_path(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-raw-cache-")),
  );
  const raw = Buffer.concat([
    Buffer.from(`${root}/cache-`),
    Buffer.from([0xff]),
  ]);
  const lookalike = path.join(root, "cache-\ufffd");
  const alias = path.join(root, "cache-alias");
  const source = path.join(root, "entry.ts");
  try {
    fs.mkdirSync(lookalike);
    fs.writeFileSync(source, "export {};\n");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      '{"files":["entry.ts"]}',
    );
    fs.writeFileSync(path.join(lookalike, "sentinel"), "untouched");
    if (process.platform === "linux") {
      fs.mkdirSync(raw);
      fs.symlinkSync(raw, alias);
      for (const options of [
        { cacheDir: alias },
        { cacheDir: path.join(alias, "missing", "cache") },
        { env: { TTSC_CACHE_DIR: alias } },
      ]) {
        assert.throws(
          () => prepareExecution(source, { cwd: root, ...options }),
          /runtime cache directory has no UTF-8 path/,
        );
        assert.deepEqual(fs.readdirSync(raw), []);
        assert.deepEqual(fs.readdirSync(lookalike), ["sentinel"]);
      }
    }

    const stop = new Error("stop after the runtime claim");
    assert.throws(
      () =>
        prepareExecution(source, {
          cwd: root,
          cacheDir: lookalike,
          onRuntimeDirectory: (run) => {
            assert.equal(run.cacheDir, lookalike);
            throw stop;
          },
        }),
      (error) => error === stop,
    );
    assert.equal(
      fs.readFileSync(path.join(lookalike, "sentinel"), "utf8"),
      "untouched",
    );
  } finally {
    if (process.platform === "linux") {
      if (fs.existsSync(alias)) fs.unlinkSync(alias);
      if (fs.existsSync(raw)) fs.rmSync(raw, { recursive: true });
    }
    fs.rmSync(root, { recursive: true });
  }
}
