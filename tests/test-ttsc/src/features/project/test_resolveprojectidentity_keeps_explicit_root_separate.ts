import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  resolveProjectIdentity,
} from "../../internal/project";

/**
 * Verifies an explicit Program root remains a separate project-identity channel
 * from the selected config's logical parent.
 *
 * Generated wrapper configs can live outside the root TypeScript-Go should use.
 * Collapsing these paths would make contributors unable to distinguish the
 * selected config, its logical root, and the caller's explicit override.
 *
 * 1. Put a config under `configs/` and create a separate explicit root.
 * 2. Resolve both relative to the lexical invocation cwd.
 * 3. Assert all logical, explicit, and physical fields retain their meaning.
 */
export const test_resolveprojectidentity_keeps_explicit_root_separate =
  (): void => {
    const cwd = TestProject.tmpdir("ttsc-identity-explicit-");
    const configDir = path.join(cwd, "configs");
    const explicitRoot = path.join(cwd, "workspace");
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(explicitRoot, { recursive: true });
    fs.writeFileSync(path.join(configDir, "tsconfig.json"), "{}\n");

    const identity = resolveProjectIdentity({
      cwd,
      projectRoot: "workspace",
      tsconfig: "configs/tsconfig.json",
    });
    assert.equal(identity.logicalProjectRoot, configDir);
    assert.equal(identity.explicitProjectRoot, explicitRoot);
    assert.equal(identity.physicalProjectRoot, fs.realpathSync(explicitRoot));
    assert.equal(
      identity.physicalConfigPath,
      fs.realpathSync(path.join(configDir, "tsconfig.json")),
    );
  };
