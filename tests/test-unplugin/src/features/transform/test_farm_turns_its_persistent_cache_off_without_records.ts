import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { fallbackToolDirectory } from "../../../../../packages/unplugin/src/core/bridge/fallbackToolDirectory";
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
 * 1. Configure a root the adapter can write below, and assert the configuration
 *    comes back unchanged.
 * 2. Configure one with a file standing where `.ttsc` would be, while a temporary
 *    directory of the test's own holds the fallback, and assert it comes back
 *    unchanged, since the records live in the fallback.
 * 3. Configure another such root while no fallback can be established either, and
 *    assert the cache is turned off, a configuration that turned it off is
 *    kept, and one warning names the directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls farmPersistentCacheWithoutRecords and fallbackToolDirectory; asserts writable local and fallback records preserve configuration, unusable local and fallback storage disable caching, an already disabled cache stays disabled, and one warning names the root.
 * @evidence contracts/testing.md#independent-expectations A host cache cannot validate output without a writable project record. Exact preserved configuration and persistentCache false are independent consequences of that storage contract; no Farm host is launched.
 * @evidence contracts/testing.md#distinguishing-cases Owns local success, fallback success, total failure and repeated failure with warning deduplication. TEMP/TMP/TMPDIR and the warning listener are restored in finally; native Farm restart delivery remains separate.
 * @evidence contracts/testing.md#execution-ownership Unit test: test_farm_turns_its_persistent_cache_off_without_records calls the real farmPersistentCacheWithoutRecords and fallbackToolDirectory over real temporary roots (one writable, two with a file where .ttsc belongs) while pointing TEMP/TMP/TMPDIR at its own directory. No Farm host starts; the process warning listener and environment variables are restored in finally.
 */
export async function test_farm_turns_its_persistent_cache_off_without_records(): Promise<void> {
  const writable = TestProject.tmpdir("ttsc-unplugin-farm-writable-");
  const config = { compilation: { persistentCache: { cacheDir: "x" } } };
  assert.deepEqual(
    farmPersistentCacheWithoutRecords({ ...config, root: writable }, "/"),
    { ...config, root: writable },
    "records below the root",
  );

  const blocked = () => {
    const root = TestProject.tmpdir("ttsc-unplugin-farm-blocked-");
    fs.writeFileSync(path.join(root, ".ttsc"), "");
    return root;
  };
  const withFallback = blocked();
  const warnings: Error[] = [];
  const listen = (warning: Error & { code?: string }) => {
    if (warning.code === "TTSC_PROJECT_RECORD_UNWRITABLE")
      warnings.push(warning);
  };
  // The system temporary directory is the test's own throughout, so the
  // fallback it probes is removed with it.
  const saved = ["TEMP", "TMP", "TMPDIR"].map((key) => [key, process.env[key]]);
  const temporary = TestProject.tmpdir("ttsc-unplugin-farm-tmp-");
  // No user directory can be established below a temporary directory that is
  // a file.
  const unusable = path.join(temporary, "file");
  fs.writeFileSync(unusable, "");
  const nowhere = blocked();
  process.on("warning", listen);
  try {
    for (const [key] of saved) process.env[key!] = temporary;
    assert.notEqual(fallbackToolDirectory(withFallback), undefined);
    assert.deepEqual(
      farmPersistentCacheWithoutRecords({ ...config, root: withFallback }, "/"),
      { ...config, root: withFallback },
      "records in the fallback",
    );

    for (const [key] of saved) process.env[key!] = unusable;
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
    assert.ok(
      warnings[0]!.message.includes(path.join(nowhere, ".ttsc")),
      warnings[0]!.message,
    );
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
    process.off("warning", listen);
  }
}
