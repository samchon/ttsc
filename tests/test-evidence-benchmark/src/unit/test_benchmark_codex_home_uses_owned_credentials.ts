import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EvidenceBenchmarkRuntime } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkRuntime";

/**
 * Exercises isolated and retained Codex homes using owned credential files.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual prepareCodexHome and compares auth bytes, exact configuration and directory contents, then observes missing credentials and actual copy/write failures without executing Codex.
 * @evidence contracts/testing.md#independent-expectations Auth bytes and the complete pinned Playwright configuration are literal fixture expectations, including version 0.0.79, required true and startup timeout 300; unrelated operator files must remain absent from isolated homes.
 * @evidence contracts/testing.md#distinguishing-cases Fresh, unrooted, historical retained and already-isolated retained homes contrast; absent auth rejects before destination creation, directory-valued auth fails copying, and directory-valued config fails writing after copying credentials. Both failure residues are inspected before cleanup.
 * @evidence contracts/testing.md#execution-ownership One named source-unit function uses only actual native filesystem operations under owned temporary roots; it supplies the explicit home dependency, never reads operator authentication or replaces globals, and removes every owned root in finally.
 */
export function test_benchmark_codex_home_uses_owned_credentials(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-home-unit-"));
  let unrooted: string | undefined;
  try {
    const operator = path.join(root, "operator");
    fs.mkdirSync(operator);
    const auth = Buffer.from('{"credential":"fixture-only"}\r\n\0', "utf8");
    fs.writeFileSync(path.join(operator, "auth.json"), auth);
    fs.writeFileSync(path.join(operator, "config.toml"), "operator configuration");
    fs.writeFileSync(path.join(operator, "AGENTS.md"), "operator instructions");
    const configuration = '[mcp_servers.playwright]\ncommand = "npx"\nargs = ["-y", "@playwright/mcp@0.0.79"]\nrequired = true\nstartup_timeout_sec = 300\n';
    const assertIsolated = (home: string): void => {
      assert.deepEqual(fs.readdirSync(home).sort(), ["auth.json", "config.toml"]);
      assert.deepEqual(fs.readFileSync(path.join(home, "auth.json")), auth);
      assert.equal(fs.readFileSync(path.join(home, "config.toml"), "utf8"), configuration);
    };
    const freshRoot = path.join(root, "fresh");
    const fresh = EvidenceBenchmarkRuntime.prepareCodexHome(freshRoot, undefined, operator);
    assert.equal(fresh, path.join(freshRoot, "codex-home"));
    assertIsolated(fresh);
    unrooted = EvidenceBenchmarkRuntime.prepareCodexHome(undefined, undefined, operator);
    assert.notEqual(unrooted, operator);
    assertIsolated(unrooted);
    const historicalRoot = path.join(root, "historical");
    assert.equal(EvidenceBenchmarkRuntime.prepareCodexHome(historicalRoot, "retained-thread", operator), operator);
    assert.equal(fs.existsSync(historicalRoot), false);
    assert.equal(fs.readFileSync(path.join(operator, "config.toml"), "utf8"), "operator configuration");
    fs.writeFileSync(path.join(fresh, "auth.json"), "expired isolated credential");
    fs.writeFileSync(path.join(fresh, "config.toml"), "stale configuration");
    assert.equal(EvidenceBenchmarkRuntime.prepareCodexHome(freshRoot, "retained-thread", operator), fresh);
    assertIsolated(fresh);
    const missingRoot = path.join(root, "missing-destination");
    assert.throws(() => EvidenceBenchmarkRuntime.prepareCodexHome(missingRoot, undefined, path.join(root, "missing-home")), /Codex is not logged in:/);
    assert.equal(fs.existsSync(missingRoot), false);
    assert.throws(() => EvidenceBenchmarkRuntime.prepareCodexHome(missingRoot, "retained-thread", path.join(root, "missing-home")), /Codex is not logged in:/);
    assert.equal(fs.existsSync(missingRoot), false);
    const badAuth = path.join(root, "directory-auth");
    fs.mkdirSync(path.join(badAuth, "auth.json"), { recursive: true });
    const copyFailure = path.join(root, "copy-failure");
    assert.throws(() => EvidenceBenchmarkRuntime.prepareCodexHome(copyFailure, undefined, badAuth));
    assert.deepEqual(fs.readdirSync(path.join(copyFailure, "codex-home")), []);
    const writeFailure = path.join(root, "write-failure");
    fs.mkdirSync(path.join(writeFailure, "codex-home", "config.toml"), { recursive: true });
    assert.throws(() => EvidenceBenchmarkRuntime.prepareCodexHome(writeFailure, undefined, operator));
    assert.deepEqual(fs.readFileSync(path.join(writeFailure, "codex-home", "auth.json")), auth);
    assert.ok(fs.statSync(path.join(writeFailure, "codex-home", "config.toml")).isDirectory());
  } finally {
    if (unrooted !== undefined) fs.rmSync(unrooted, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(fs.existsSync(root), false);
  if (unrooted !== undefined) assert.equal(fs.existsSync(unrooted), false);
}
