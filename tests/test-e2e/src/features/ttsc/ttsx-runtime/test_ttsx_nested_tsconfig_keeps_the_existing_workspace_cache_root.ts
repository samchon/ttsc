import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
  ttsxBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsx nested tsconfig: keeps the existing workspace cache root.
 *
 * The ttsx runtime directory used to be created below the tsconfig directory
 * before source-plugin cache discovery. That new `node_modules` became a false
 * project boundary, so a cache warmed at the package root was missed.
 *
 * 1. Create a single package with a root install and a nested tsconfig.
 * 2. Run ttsx without plugins and assert it creates no nested `node_modules`.
 * 3. Assert cache-path discovery names the same root before and after the run.
 *
 * @evidence contracts/testing.md#behavioral-verification Cache paths CLI before/after a nested-project ttsx run must select the root physical node_modules/.cache/ttsc; output is nested-cache-root, no nested node_modules exists and the runtime project cache is empty after exit.
 * @evidence contracts/testing.md#independent-expectations The authored root install and physicalRoot establish expected cache ancestry independently of discovery output; literal absent nested boundary and empty cache index detect unintended runtime topology.
 * @evidence contracts/testing.md#distinguishing-cases A nested tsconfig with root node_modules contrasts with creating a nearer false boundary. TTSC_CACHE_DIR is cleared for every discovery/run observation.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Actual runtime directory creation, bootstrap cleanup and later CLI cache discovery must agree across host lifetimes. Direct discovery tests cannot establish the run did not change future ancestry.
 * @evidence contracts/e2e.md#shared-execution One root/install fixture serves two cache-path queries and one ttsx host. Queries require separate CLI consumers to observe before/after state; no plugin source producer or consumer install is recreated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Synchronous before/run/after ordering fixes the observed topology. TestProject tracks the root, and runtime exit must clear project generations; the case deliberately retains the root install directory.
 * @evidence contracts/e2e.md#preserved-coverage Original output/status, exact before/root path, equal after path, absent nested node_modules and empty runtime index remain executable here.
 */
export function test_ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root() {
  const root = createProject(
    FixtureFiles.read(
      "ttsc/ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root/inputs-1",
    ),
  );
  const physicalRoot = fs.realpathSync(root);
  fs.mkdirSync(path.join(root, "node_modules"));

  const before = cacheRoot(root);
  const result = spawn(
    ttsxBin,
    ["--cwd", root, "--project", "test/tsconfig.json", "test/main.ts"],
    { cwd: root, env: { TTSC_CACHE_DIR: "" } },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "nested-cache-root");
  assert.equal(fs.existsSync(path.join(root, "test", "node_modules")), false);
  assert.equal(
    before,
    path.join(physicalRoot, "node_modules", ".cache", "ttsc"),
  );
  assert.equal(cacheRoot(root), before);
  assert.deepEqual(fs.readdirSync(path.join(before, "ttsx", "project")), []);
}

function cacheRoot(root: string): string {
  const result = spawn(
    ttscBin,
    [
      "cache",
      "paths",
      "--json",
      "--cwd",
      root,
      "--project",
      "test/tsconfig.json",
    ],
    { cwd: root, env: { TTSC_CACHE_DIR: "" } },
  );
  assert.equal(result.status, 0, result.stderr);
  return (JSON.parse(result.stdout) as { cacheRoot: string }).cacheRoot;
}
