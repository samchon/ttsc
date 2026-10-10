import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runtimeExecutableIdentity } from "../../../../../packages/ttsc/src/internal/runtimeExecutableIdentity";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a runtime executable's digest is reused across processes only while
 * the recorded metadata holds and is separable from a fresh reference.
 *
 * A plugin load asked for this identity six times per launch and streamed an 85
 * MB runtime each time (#1723). With a record store the bytes are proven from
 * metadata; a replaced or rewritten executable must still be read. A corrupted
 * recorded digest distinguishes a reused record from a fresh read.
 *
 * 1. Record a fixture file's identity, corrupt the record and reopen the store.
 * 2. Rewrite identical bytes and then different bytes; both must stream again.
 * 3. Give the file a stamp the reference cannot separate; the record must not be
 *    trusted.
 *
 * @evidence contracts/testing.md#behavioral-verification runtimeExecutableIdentity runs with and without a real record store over a regular file; the asserted result is the returned identity string, whose last field is the content digest.
 * @evidence contracts/testing.md#independent-expectations The same function without a store streams the file and is the oracle for a fresh reading; the corrupted literal digest is the oracle for reuse.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged separable metadata reuses; identical-byte rewrite and content change stream; an unseparable future stamp streams without trusting the record. Link retargeting stays with the existing streamed-identity unit.
 * @evidence contracts/testing.md#execution-ownership The named unit calls the identity owner in process on authored files and a private cache root; no binary runs.
 */
export function test_runtime_executable_identity_reuses_a_recorded_digest_only_under_separable_metadata(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({ runtime: "first runtime bytes" }),
  );
  const file = path.join(root, "runtime");
  const cache = path.join(root, "cache");
  const settle = (): void => {
    const past = new Date(Date.now() - 3_600_000);
    fs.utimesSync(file, past, past);
  };
  const open = (): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: cache,
      env: {},
    });
    assert.ok(store);
    return store;
  };
  const digestOf = (identity: string | undefined): string => {
    assert.ok(identity, "an identity is formed");
    return identity.split("\0").at(-1)!;
  };
  const corrupt = (): string => {
    const directory = path.join(cache, "identities");
    const records = fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".json"));
    assert.equal(records.length, 1);
    const recordFile = path.join(directory, records[0]!);
    const entry = JSON.parse(fs.readFileSync(recordFile, "utf8")) as {
      digest: string;
    };
    entry.digest = "f".repeat(64);
    fs.writeFileSync(recordFile, JSON.stringify(entry));
    return entry.digest;
  };
  const failures: unknown[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  settle();
  verify("a cold identity streams and records", () => {
    assert.equal(
      runtimeExecutableIdentity(file, open()),
      runtimeExecutableIdentity(file),
    );
  });
  verify("a recorded digest stands while its metadata holds", () => {
    const corrupted = corrupt();
    assert.equal(digestOf(runtimeExecutableIdentity(file, open())), corrupted);
  });
  for (const [name, bytes] of [
    ["identical bytes rewritten", "first runtime bytes"],
    ["bytes replaced", "second runtime bytes"],
  ] as const) {
    verify(name, () => {
      corrupt();
      fs.writeFileSync(file, bytes);
      settle();
      assert.equal(
        digestOf(runtimeExecutableIdentity(file, open())),
        digestOf(runtimeExecutableIdentity(file)),
      );
    });
  }
  verify("an unseparable stamp streams the file", () => {
    corrupt();
    const future = new Date(Date.now() + 3_600_000);
    fs.utimesSync(file, future, future);
    assert.equal(
      digestOf(runtimeExecutableIdentity(file, open())),
      digestOf(runtimeExecutableIdentity(file)),
    );
  });
  if (failures.length !== 0)
    throw new AggregateError(failures, "runtime identity record matrix failed");
}
