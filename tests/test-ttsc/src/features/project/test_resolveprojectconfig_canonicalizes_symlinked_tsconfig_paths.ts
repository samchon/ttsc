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
 * This ttsc project config scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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
