import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const { spawnSync } = E2eProcessTrace;
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
 * @evidence contracts/testing.md#distinguishing-cases One case-only selection compares the supplied SDK policy with candidate resolution: sensitive rejects, insensitive accepts. Native alias existence is separately asserted outside Windows, whose pinned policy is insensitive. This does not independently classify arbitrary volume/directory policy or execute every controlled lookup/emit form.
 * @evidence contracts/testing.md#execution-ownership This named entry receives the installed SDK policy operation/launcher from test_e2e_installation. Its policy and compiler request are distinct observations; historical matrix size is not currently executed installation/Program/process coverage.
 * @evidence contracts/e2e.md#necessary-boundary The installed SDK's predicted compiler policy must agree with a real candidate compiler module-resolution request on its ordinary installation volume; controlled source units cannot prove native candidate assembly and volume interpretation.
 * @evidence contracts/e2e.md#shared-execution One compiler request consumes the already installed candidate binary and a private fixture; no additional installation, Go build or native plugin producer is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A TestProject-owned child separates inputs/cache policy key while retaining parent installation dependency resolution. The tracked child/root ancestry is retained before policy preparation and compiler request. Workspace overrides are removed; synchronous error/signal/status does not certify arbitrary descendant termination or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original lowercase value7, uppercase import, boolean policy/Windows false or native alias contrast, TS2307-versus-zero result and unchanged source bytes remain. This installed connection does not itself execute controlled source lookup/emit transfers; separate survival and mixed-volume/directory-authority coverage are not certified here.
 */
export function case_installed_compiler_resolves_case_only_imports_with_its_host_policy(
  compilerUsesCaseSensitiveFileNames: typeof compilerCaseOperation,
  ttscBinary: string,
  consumerRoot: string,
): void {
  const root = TestProject.tmpdir("ttsc-compiler-case-policy-", consumerRoot);
  TestProject.retainTemporaryDirectory(root, "installed compiler policy/request has no descendant join acknowledgement");
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
