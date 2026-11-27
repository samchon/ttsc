import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "../../../../../packages/unplugin/src/core/bridge/PROJECT_RECORD_DIRECTORY";
import { fallbackToolDirectory } from "../../../../../packages/unplugin/src/core/bridge/fallbackToolDirectory";
import { prepareProjectRecordDirectory } from "../../../../../packages/unplugin/src/core/bridge/prepareProjectRecordDirectory";
import { farmPersistentCacheWithoutRecords } from "../../../../../packages/unplugin/src/core/farm/farmPersistentCacheWithoutRecords";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies Farm keeps its persistent cache where the adapter can write a
 * project record Farm accepts, and turns it off, once and with a warning, where
 * it can write none (samchon/ttsc#1480).
 *
 * Farm offers a JavaScript plugin no per-module opt-out of its persistent
 * cache, so a module handed over without its record was restored after a
 * restart whatever the types its output consulted did while Farm was stopped.
 * Its `config` hook can turn the cache off for the whole compile, measured on
 * Farm 1.7.11, and the adapter does so exactly when no record can exist.
 *
 * 1. Configure a root with a same-volume fallback and verify the option stays
 *    enabled without writing into the project.
 * 2. Block a different root's actual fallback path with a file. Verify the cache
 *    turns off, stays off and warns once.
 * 3. Put a directory link in the fallback ancestry. Both the host and the record
 *    writer must refuse it without changing its destination.
 * 4. Verify a writable POSIX directory without search permission is refused by
 *    both owners when the current user cannot traverse it.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls farmPersistentCacheWithoutRecords and fallbackToolDirectory; asserts the same-volume record directory preserves caching without touching the project, unavailable temporary storage disables caching, an already disabled cache stays disabled, and one warning names the root.
 * @evidence contracts/testing.md#independent-expectations A host cache cannot validate output without a writable project record. Exact preserved configuration and persistentCache false are independent consequences of that storage contract; no Farm host is launched.
 * @evidence contracts/testing.md#distinguishing-cases Covers a usable fallback, a blocking file, repeated warnings, linked ancestors and POSIX record directories lacking effective traversal.
 * @evidence contracts/testing.md#execution-ownership The unit uses real project and temporary roots and restores TEMP, TMP, TMPDIR and the warning listener in finally. No Farm host starts.
 */
export async function test_farm_turns_its_persistent_cache_off_without_records(): Promise<void> {
  const writable = TestProject.tmpdir("ttsc-unplugin-farm-writable-");
  const config = { compilation: { persistentCache: { cacheDir: "x" } } };
  assert.deepEqual(
    farmPersistentCacheWithoutRecords({ ...config, root: writable }, "/"),
    { ...config, root: writable },
    "the host can use its same-volume record directory",
  );
  assert.deepEqual(fs.readdirSync(writable), []);

  const withFallback = TestProject.tmpdir("ttsc-unplugin-farm-fallback-");
  const warnings: Error[] = [];
  const listen = (warning: Error & { code?: string }) => {
    if (warning.code === "TTSC_PROJECT_RECORD_UNWRITABLE")
      warnings.push(warning);
  };
  // The system temporary directory is the test's own throughout, so the
  // fallback it probes is removed with it.
  const saved = ["TEMP", "TMP", "TMPDIR"].map((key) => [key, process.env[key]]);
  const temporary = TestProject.tmpdir("ttsc-unplugin-farm-tmp-");
  const nowhere = TestProject.tmpdir("ttsc-unplugin-farm-blocked-");
  process.on("warning", listen);
  try {
    for (const [key] of saved) process.env[key!] = temporary;
    const usable = fallbackToolDirectory(withFallback);
    assert.ok(usable);
    assert.deepEqual(
      farmPersistentCacheWithoutRecords({ ...config, root: withFallback }, "/"),
      { ...config, root: withFallback },
      "records in the fallback",
    );

    const unusable = fallbackToolDirectory(nowhere);
    assert.ok(unusable);
    const relative = path.relative(
      TestProject.physicalPath(temporary),
      unusable,
    );
    assert.ok(
      relative && !path.isAbsolute(relative) && !relative.startsWith(".."),
    );
    fs.mkdirSync(path.dirname(unusable), { mode: 0o700, recursive: true });
    fs.writeFileSync(unusable, "");
    const off = farmPersistentCacheWithoutRecords(
      { ...config, root: nowhere },
      "/",
    );
    assert.deepEqual(off, {
      compilation: { persistentCache: false },
      root: nowhere,
    });
    assert.deepEqual(
      farmPersistentCacheWithoutRecords(off, "/"),
      off,
      "a cache already off stays off",
    );
    farmPersistentCacheWithoutRecords({ ...config, root: nowhere }, "/");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(warnings.length, 1, "warned once");
    assert.ok(warnings[0]!.message.includes(nowhere), warnings[0]!.message);

    const hosts = path.dirname(usable);
    const parked = hosts + "-ordinary";
    const destination = path.join(withFallback, "redirected");
    const foreignHost = path.join(destination, path.basename(usable));
    fs.mkdirSync(foreignHost, { recursive: true });
    fs.renameSync(hosts, parked);
    try {
      fs.symlinkSync(
        destination,
        hosts,
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.deepEqual(
        farmPersistentCacheWithoutRecords(
          { ...config, root: withFallback },
          "/",
        ),
        { compilation: { persistentCache: false }, root: withFallback },
      );
      assert.throws(
        () =>
          prepareProjectRecordDirectory(
            path.join(usable, PROJECT_RECORD_DIRECTORY),
          ),
        /unsafe private project record directory/,
      );
      assert.deepEqual(fs.readdirSync(foreignHost), []);
    } finally {
      if (fs.lstatSync(hosts, { throwIfNoEntry: false })?.isSymbolicLink())
        fs.unlinkSync(hosts);
      fs.renameSync(parked, hosts);
    }
    if (process.platform !== "win32" && process.getuid?.() !== 0) {
      const records = path.join(usable, PROJECT_RECORD_DIRECTORY);
      fs.mkdirSync(records, { recursive: true, mode: 0o700 });
      try {
        for (const [mode, missing] of [
          [0o600, fs.constants.X_OK],
          [0o300, fs.constants.R_OK],
        ] as const) {
          fs.chmodSync(records, mode);
          fs.accessSync(records, fs.constants.W_OK);
          assert.throws(() => fs.accessSync(records, missing));
          assert.deepEqual(
            farmPersistentCacheWithoutRecords(
              { ...config, root: withFallback },
              "/",
            ),
            { compilation: { persistentCache: false }, root: withFallback },
          );
          assert.throws(
            () => prepareProjectRecordDirectory(records),
            /unsafe private project record directory/,
          );
        }
      } finally {
        fs.chmodSync(records, 0o700);
      }
    }
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
    process.off("warning", listen);
  }
}
