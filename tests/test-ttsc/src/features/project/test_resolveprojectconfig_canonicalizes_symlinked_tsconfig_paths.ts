import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  resolveProjectConfig,
} from "../../internal/project";

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
 */
export const test_resolveprojectconfig_canonicalizes_symlinked_tsconfig_paths =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const real = path.join(root, "real");
    const link = path.join(root, "link");
    fs.mkdirSync(real, { recursive: true });
    fs.writeFileSync(path.join(real, "tsconfig.json"), "{}\n", "utf8");
    fs.symlinkSync(real, link, "dir");

    const resolved = resolveProjectConfig({
      tsconfig: path.join(link, "tsconfig.json"),
    });
    assert.equal(resolved, fs.realpathSync(path.join(real, "tsconfig.json")));
  };
