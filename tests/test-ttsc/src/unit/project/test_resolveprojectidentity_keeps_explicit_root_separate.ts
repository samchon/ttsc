import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  path,
  resolveProjectIdentity,
} from "../../internal/project-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Compares selected-config parent, explicit project root and physical paths from resolveProjectIdentity, detecting accidental collapse of the separate caller and Program channels.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately creates configs and workspace as different sibling directories; expected logical paths follow the input request and expected physical paths come from filesystem realpath independently of the resolver.
 * @evidence contracts/testing.md#distinguishing-cases An explicit root differs from the config parent; preserves_linked_logical_selection owns the linked-selection twin, and discovers_config_through_logical_file_path owns automatic discovery.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers exported test_resolveprojectidentity_keeps_explicit_root_separate once under src/unit/project. It calls the authored resolver directly on isolated fixture directories; no compiler artifact, installed consumer or CLI host is prepared.
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
