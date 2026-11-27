import assert from "node:assert/strict";
import path from "node:path";

import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies `PluginContentIdentities.digest` skips the post-read observation
 * when the pre-read observation was already unseparable or absent, and still
 * brackets separable reads for publication.
 *
 * On a multi-volume layout where a source tree or SDK has no clock reference,
 * `before.separable` is already false before `read()` runs, so no record can be
 * published. Repeating `observe()` after `read()` walked the entire tree a
 * second time only to discard the result.
 *
 * 1. Run `digest` with an unseparable `before` observation and with an `undefined`
 *    `before` observation; assert `observe` runs once, `read` runs once, and
 *    nothing is recorded.
 * 2. Run `digest` with a stable separable observation; assert `observe` runs twice
 *    (before and after `read`), then a second call reuses the record with one
 *    `observe` and zero `read` calls.
 * 3. Run `digest` with a separable observation whose signature moves during
 *    `read`; assert `observe` runs twice and nothing is recorded.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls PluginContentIdentities.digest with a real opened store and counting observe/read callbacks, checking callback counts, returned digests and whether a record is subsequently reused.
 * @evidence contracts/testing.md#independent-expectations Literal digest strings and exact observe/read counts follow the before/after publication contract directly, independent of implementation internals.
 * @evidence contracts/testing.md#distinguishing-cases Unseparable and absent pre-read observations contrast with stable separable publication, warm record reuse and moving-signature refusal. Filesystem-level sourceDirectory and GOROOT observations remain in their own units.
 * @evidence contracts/testing.md#execution-ownership Discovered unit calls PluginContentIdentities.open and digest directly over an owned TestProject temporary cache root; no Go process, compiler or host runs.
 */
export function test_plugincontentidentities_skips_post_read_observe_when_unseparable(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-content-identities-unseparable-"),
  );
  const cache = path.join(root, "cache");
  const subject = path.join(root, "subject");
  const store = PluginContentIdentities.open({
    projectRoot: root,
    cacheDir: cache,
    env: {},
  });
  assert.ok(store, "a cache root outside the subject opens a store");

  const failures: unknown[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  verify("unseparable pre-read skips post-read observe", () => {
    let observes = 0;
    let reads = 0;
    const result = PluginContentIdentities.digest(
      store,
      "unseparable-kind",
      subject,
      () => {
        observes += 1;
        return { separable: false, signature: "sig-unseparable" };
      },
      () => {
        reads += 1;
        return "digest-unseparable";
      },
    );
    assert.equal(result, "digest-unseparable");
    assert.equal(reads, 1);
    assert.equal(
      observes,
      1,
      "an unseparable before observation cannot publish, so after observe must not run",
    );
  });

  verify("absent pre-read skips post-read observe", () => {
    let observes = 0;
    let reads = 0;
    const result = PluginContentIdentities.digest(
      store,
      "absent-kind",
      subject,
      () => {
        observes += 1;
        return undefined;
      },
      () => {
        reads += 1;
        return "digest-absent";
      },
    );
    assert.equal(result, "digest-absent");
    assert.equal(reads, 1);
    assert.equal(
      observes,
      1,
      "an absent before observation cannot publish, so after observe must not run",
    );
  });

  verify(
    "stable separable read brackets observe and reuses on next call",
    () => {
      let observes = 0;
      let reads = 0;
      const first = PluginContentIdentities.digest(
        store,
        "separable-kind",
        subject,
        () => {
          observes += 1;
          return { separable: true, signature: "sig-stable" };
        },
        () => {
          reads += 1;
          return "digest-stable";
        },
      );
      assert.equal(first, "digest-stable");
      assert.equal(reads, 1);
      assert.equal(
        observes,
        2,
        "a separable miss must observe before and after read to publish",
      );

      observes = 0;
      reads = 0;
      const second = PluginContentIdentities.digest(
        store,
        "separable-kind",
        subject,
        () => {
          observes += 1;
          return { separable: true, signature: "sig-stable" };
        },
        () => {
          reads += 1;
          return "digest-unexpected";
        },
      );
      assert.equal(second, "digest-stable");
      assert.equal(observes, 1);
      assert.equal(reads, 0);
    },
  );

  verify(
    "separable read whose signature moves still brackets and refuses publication",
    () => {
      let observes = 0;
      let reads = 0;
      const first = PluginContentIdentities.digest(
        store,
        "moving-kind",
        subject,
        () => {
          observes += 1;
          return {
            separable: true,
            signature: observes === 1 ? "sig-before" : "sig-after",
          };
        },
        () => {
          reads += 1;
          return "digest-moving-1";
        },
      );
      assert.equal(first, "digest-moving-1");
      assert.equal(reads, 1);
      assert.equal(observes, 2);

      reads = 0;
      const second = PluginContentIdentities.digest(
        store,
        "moving-kind",
        subject,
        () => ({ separable: true, signature: "sig-after" }),
        () => {
          reads += 1;
          return "digest-moving-2";
        },
      );
      assert.equal(second, "digest-moving-2");
      assert.equal(reads, 1, "a moving read must not have published a record");
    },
  );

  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "PluginContentIdentities.digest observation bracketing failed",
    );
}
