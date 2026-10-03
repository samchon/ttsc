import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { javascriptRuntimeCapabilities } from "../../../../../packages/ttsc/src/internal/javascriptRuntimeCapabilities";

/**
 * Reprobes an unchanged POSIX wrapper when its selected runtime changes.
 *
 * The first call-local environment selects real Node; the second selects an
 * authored Node script reporting Bun-shaped data. The wrapper's own bytes and
 * mode stay unchanged, so its identity alone cannot authorize cached features.
 * This does not execute Bun or establish process-death/cache-eviction behavior.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly invokes javascriptRuntimeCapabilities twice through the original stable POSIX wrapper, observing real Node false/true features then authored Bun-shaped true/false features. Independent wrapper-byte/mode observations retain the mutable-environment cache premise.
 * @evidence contracts/testing.md#independent-expectations Literal original shell/script bytes and call-local TTSC_TEST_RUNTIME_TARGET values select the actual Node executable or authored alternate response. Expected flags and reported executable paths belong to those targets, not the cache implementation; the alternate is not certified as real Bun.
 * @evidence contracts/testing.md#distinguishing-cases Changes only the selected target environment while retaining the wrapper path, bytes and 0755 mode. Both actual probe results have independent feature/path observations. The original Windows return false is preserved and the existing generic unit executor reports SKIPPED with no behavioral coverage, rather than PASS.
 * @evidence contracts/testing.md#execution-ownership This named project source unit imports the actual probe owner; its synchronous native subprocesses execute the shell wrapper and selected Node targets without an installation, compiler, Go build, product host or foreign replacement. Environments are call-local copies, private-root cleanup failures are aggregated and owning probe fallback/cache retention remains production-owned. Body existence does not establish runtime, selection or native-child outcomes.
 */
export function test_javascriptruntimecapabilities_does_not_cache_mutable_wrappers(): void | false {
  if (process.platform === "win32") return false;
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-runtime-wrapper-capability-"),
  );
  const failures: Error[] = [];
  const observe = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    const wrapper = path.join(root, "runtime-wrapper");
    const alternate = path.join(root, "alternate-runtime");
    const wrapperBytes = '#!/bin/sh\nexec "$TTSC_TEST_RUNTIME_TARGET" "$@"\n';
    fs.writeFileSync(wrapper, wrapperBytes, "utf8");
    fs.writeFileSync(
      alternate,
      [
        "#!/usr/bin/env node",
        "process.stdout.write(JSON.stringify({",
        "  bun: true,",
        "  executable: process.argv[1],",
        "  registerHooks: false,",
        "}));",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.chmodSync(wrapper, 0o755);
    fs.chmodSync(alternate, 0o755);
    observe("wrapper bytes before both probes", () => {
      assert.equal(fs.readFileSync(wrapper, "utf8"), wrapperBytes);
      assert.equal(fs.statSync(wrapper).mode & 0o777, 0o755);
    });
    for (const [name, target, bun, registerHooks] of [
      ["real Node", process.execPath, false, true],
      ["authored Bun-shaped response", alternate, true, false],
    ] as const) {
      let result: ReturnType<typeof javascriptRuntimeCapabilities> | undefined;
      observe(`${name} actual wrapper probe`, () => {
        result = javascriptRuntimeCapabilities(
          wrapper,
          { ...process.env, TTSC_TEST_RUNTIME_TARGET: target },
          root,
        );
      });
      const capabilities = result;
      if (capabilities !== undefined) {
        observe(`${name} bun flag`, () => {
          assert.equal(capabilities.bun, bun);
        });
        observe(`${name} registerHooks flag`, () => {
          assert.equal(capabilities.registerHooks, registerHooks);
        });
        observe(`${name} reported executable`, () => {
          assert.equal(capabilities.executable, path.resolve(target));
        });
      }
      observe(`${name} unchanged wrapper after probe`, () => {
        assert.equal(fs.readFileSync(wrapper, "utf8"), wrapperBytes);
        assert.equal(fs.statSync(wrapper).mode & 0o777, 0o755);
      });
    }
  } catch (cause) {
    failures.push(
      new Error("mutable runtime wrapper fixture preparation", { cause }),
    );
  } finally {
    observe("mutable runtime wrapper root cleanup", () => {
      fs.rmSync(root, { recursive: true, force: true });
    });
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "mutable runtime wrapper observations failed",
    );
}
