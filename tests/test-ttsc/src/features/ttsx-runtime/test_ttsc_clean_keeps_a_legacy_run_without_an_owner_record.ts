import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isolatedCacheEnvironment } from "../../internal/isolated-cache-environment";
import { runtimeRunsDirectory } from "../../internal/ttsx-run";

/**
 * Verifies default clean keeps a prior release's run with no owner record.
 *
 * An older ttsx process can still use its runtime output while a newer clean
 * runs. It records no owner and does not share the new lock, so absence of a
 * record cannot prove the run ended. Explicit cache removal remains available
 * when the caller knows every run has stopped.
 *
 * 1. Seed a legacy run directory without an owner record.
 * 2. Run default clean and assert it reports the kept directory without saying no
 *    cache directories were found.
 * 3. Remove the named cache explicitly and assert both protected directories go.
 *
 * @evidence contracts/testing.md#behavioral-verification Public default clean preserves legacy and malformed-owner runs, reports kept output and does not claim an empty cache; explicit cache removal removes both.
 * @evidence contracts/testing.md#independent-expectations Absent and unreadable owner records cannot prove a process died, whereas an explicit caller-selected cache root authorizes whole-cache removal; exact existence and public-report assertions distinguish those contracts.
 * @evidence contracts/testing.md#distinguishing-cases A run with no owner and an adjacent run with malformed JSON are independently asserted before and after default clean; explicit root selection is the destructive opt-in counterpart. The direct resolver unit owns the exact kept plan for both records.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry uses the actual public CLI and isolated filesystem cache; it builds no compiler artifact and installs no consumer.
 * @evidence contracts/e2e.md#necessary-boundary The public clean command must connect conservative ownership planning to directory preservation, kept reporting and explicit-root deletion; a direct plan result cannot establish those effects or report channels.
 * @evidence contracts/e2e.md#shared-execution Both ownership scenarios share one consumer/cache and one default-clean invocation, followed by the genuinely different explicit-delete invocation. No program or compiler build is needed for either bootstrap operation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture declares its own workspace root so ancestor installations cannot redirect its cache; the two independently named runs share only equivalent cache lookup and have no live processes; the explicit deletion runs after both preservation assertions, and synchronous CLI children finish before temporary fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The prior legacy case retains status, existence, kept and nonempty-report assertions plus explicit deletion. The prior malformed-owner case retains independent status, existence and kept-report assertions in this same command; exact plan distinctions are also directly tested in the resolver unit.
 */
export function test_ttsc_clean_keeps_a_legacy_run_without_an_owner_record(): void {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "legacy-run", private: true, workspaces: ["packages/*"] }),
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export const value = 1;\n",
    });
    const runs = runtimeRunsDirectory(root);
    const directory = path.join(runs, "legacy");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "main.js"), "", "utf8");
    const unknown = path.join(runs, "unknown");
    fs.mkdirSync(unknown);
    fs.writeFileSync(path.join(unknown, "owner-12.json"), "{", "utf8");
    const env = isolatedCacheEnvironment(root);

    const ordinary = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["clean", "--cwd", root],
      { cwd: root, env },
    );
    assert.equal(ordinary.status, 0, ordinary.stderr);
    assert.equal(fs.existsSync(directory), true, ordinary.stdout);
    assert.equal(fs.existsSync(unknown), true, ordinary.stdout);
    assert.match(ordinary.stdout, /ttsc: kept /);
    assert.doesNotMatch(ordinary.stdout, /no cache directories found/);

    const cacheRoot = path.dirname(path.dirname(runs));
    const explicit = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["clean", "--cwd", root, "--cache-dir", cacheRoot],
      { cwd: root, env },
    );
    assert.equal(explicit.status, 0, explicit.stderr);
    assert.equal(fs.existsSync(directory), false);
    assert.equal(fs.existsSync(unknown), false);
  }
