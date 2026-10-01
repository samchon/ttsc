import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { compilerUsesCaseSensitiveFileNames as compilerCaseOperation } from "../../../../../../../packages/ttsc/src/compiler/internal/project/compilerUsesCaseSensitiveFileNames";

/**
 * Verifies installed compiler resolution agrees with its ordinary volume policy.
 *
 * The paths source units supply both compiler case authorities through the
 * supported filesystem seam. This connection checks the candidate SDK proxy
 * against a real compiler request on the installation's ordinary temp volume.
 * It observes case-only resolution, rather than reading a private compiler flag;
 * mixed volume and explicitly sensitive Windows directory policies remain outside
 * this fixture.
 *
 * 1. Write a lowercase module and a root importing its uppercase spelling.
 * 2. Read the supplied candidate SDK compiler case policy for the private cache.
 * 3. Execute the candidate compiler and compare its result with that policy.
 *
 * @evidence contracts/testing.md#behavioral-verification The installed ttsc compiler accepts ./VALUE.js where its ordinary host policy ignores case and reports TS2307 where it is sensitive; source module bytes remain unchanged.
 * @evidence contracts/testing.md#independent-expectations Authored value.ts exports a known value while main.ts imports ./VALUE.js. Actual native alias existence independently observes the ordinary input volume; Windows' pinned compiler policy is explicitly insensitive. Successful resolution or TS2307 comes from the candidate native compiler, separately from the SDK policy proxy.
 * @evidence contracts/testing.md#distinguishing-cases One case-only module selection crosses the actual supported installation platform: sensitive hosts must reject it while insensitive hosts must accept it. Parsed Program source units own both controlled policies and the four paths lookup/emit forms; this fixture does not claim mixed-volume or directory-override coverage.
 * @evidence contracts/testing.md#execution-ownership This named os-boundaries/platform entry receives the installed SDK policy operation and launcher from test_installed_os_boundaries in the sole six-row installation matrix; it is separate from portable paths units.
 * @evidence contracts/e2e.md#necessary-boundary The installed SDK's predicted compiler policy must agree with a real candidate compiler module-resolution request on its ordinary installation volume; controlled source units cannot prove native candidate assembly and volume interpretation.
 * @evidence contracts/e2e.md#shared-execution One compiler request consumes the already installed candidate binary and a private fixture; no additional installation, Go build or native plugin producer is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A TestProject-owned child of the installed consumer separates compiler inputs and its cache policy key while reusing the parent installation's TypeScript dependency. Workspace compiler/runtime overrides are removed from the child environment so the supplied launcher resolves the candidate binaries, and synchronous completion ends its child before assertions.
 * @evidence contracts/e2e.md#preserved-coverage This ordinary-volume connection accompanies the transfer of case-only paths lookup/emit assertions to their controlled source unit owner; it adds no skipped supported platform and does not replace the actual file-identity or Windows directory-authority cases.
 */
export function case_installed_compiler_resolves_case_only_imports_with_its_host_policy(
  compilerUsesCaseSensitiveFileNames: typeof compilerCaseOperation,
  ttscBinary: string,
  consumerRoot: string,
): void {
  const root = TestProject.tmpdir("ttsc-compiler-case-policy-", consumerRoot);
  const files = FixtureFiles.read("ttsc/installed_compiler_resolves_case_only_imports_with_its_host_policy/inputs-1");
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, name), body, "utf8");
  const cacheDir = path.join(root, "cache");
  const env: NodeJS.ProcessEnv = { ...process.env, TTSC_CACHE_DIR: cacheDir };
  for (const key of Object.keys(env)) {
    if (["TTSC_BINARY", "TTSC_TSGO_BINARY", "TTSC_NODE_BINARY", "NODE_OPTIONS", "TTSX_RUNTIME_MANIFEST"].includes(key.toUpperCase())) delete env[key];
  }
  const sensitive = compilerUsesCaseSensitiveFileNames({ cacheDir, env, projectRoot: root });
  assert.equal(typeof sensitive, "boolean");
  if (process.platform === "win32") assert.equal(sensitive, false);
  else assert.equal(sensitive, !fs.existsSync(path.join(root, "VALUE.ts")));
  const result = spawnSync(process.execPath, [ttscBinary, "--cwd", root, "--noEmit"], {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  if (sensitive) {
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /TS2307/);
  } else {
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  assert.equal(fs.readFileSync(path.join(root, "value.ts"), "utf8"), "export const value = 7;\n");
}
