import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  path,
  resolveProjectConfig,
} from "../../internal/project-unit";

/**
 * Verifies resolveProjectConfig canonicalizes symlinked tsconfig paths.
 *
 * The plugin cache key and `pluginBaseDirs` entries must be derived from real
 * (canonical) paths so that two projects pointing at the same shared config
 * through different symlink paths share cache entries. Without canonicalization
 * two symlinks to the same file would produce different cache keys and compile
 * the plugin twice.
 *
 * 1. Create a real directory `real/` with a tsconfig and a symlink `link/ →
 *    real/`.
 * 2. Invoke `resolveProjectConfig` with the symlinked tsconfig path.
 * 3. Assert the returned path equals `fs.realpathSync(real/tsconfig.json)`.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveProjectConfig returns the physical tsconfig path when the request enters through a directory alias.
 * @evidence contracts/testing.md#independent-expectations The native filesystem realpath of the independently created real config is the canonical-path oracle.
 * @evidence contracts/testing.md#distinguishing-cases One case: a tsconfig requested through a directory link (junction on Windows) must come back as the physical path; only one link is used, so equality of the result across two different links, and cache-key behavior, are not exercised.
 * @evidence contracts/testing.md#execution-ownership A unit test calling resolveProjectConfig directly in private temp directories with a real symlink or junction; no compiler artifact, installed consumer or CLI host is prepared.
 */
export const test_resolveprojectconfig_canonicalizes_symlinked_tsconfig_paths =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const real = path.join(root, "real");
    const link = path.join(root, "link");
    fs.mkdirSync(real, { recursive: true });
    fs.writeFileSync(path.join(real, "tsconfig.json"), "{}\n", "utf8");
    fs.symlinkSync(real, link, process.platform === "win32" ? "junction" : "dir");

    const resolved = resolveProjectConfig({
      tsconfig: path.join(link, "tsconfig.json"),
    });
    assert.equal(resolved, fs.realpathSync(path.join(real, "tsconfig.json")));
  };
