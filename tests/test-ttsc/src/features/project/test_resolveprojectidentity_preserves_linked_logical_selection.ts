import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  resolveProjectIdentity,
} from "../../internal/project";

/**
 * Verifies project identity preserves a linked config selection separately from
 * the physical Program paths.
 *
 * A caller can select a project through a symlink or Windows junction. The
 * logical config and root must retain that spelling while the config and root
 * supplied to TypeScript-Go use real paths. Passing the linked directory also
 * pins the `-p <directory>` selection form.
 *
 * 1. Create a physical project and expose it through a directory link.
 * 2. Resolve the linked directory as the explicit project selection.
 * 3. Assert logical paths use the link and physical paths use `realpath`.
 */
export const test_resolveprojectidentity_preserves_linked_logical_selection =
  (): void => {
    const physicalRoot = TestProject.tmpdir("ttsc-identity-physical-");
    fs.writeFileSync(path.join(physicalRoot, "tsconfig.json"), "{}\n");
    const logicalParent = TestProject.tmpdir("ttsc-identity-logical-");
    const logicalRoot = path.join(logicalParent, "linked-project");
    fs.symlinkSync(
      physicalRoot,
      logicalRoot,
      process.platform === "win32" ? "junction" : "dir",
    );

    const identity = resolveProjectIdentity({
      cwd: logicalParent,
      tsconfig: "linked-project",
    });
    assert.equal(identity.invocationCwd, path.resolve(logicalParent));
    assert.equal(
      identity.logicalConfigPath,
      path.join(logicalRoot, "tsconfig.json"),
    );
    assert.equal(identity.logicalProjectRoot, logicalRoot);
    assert.equal(
      identity.physicalConfigPath,
      fs.realpathSync(path.join(physicalRoot, "tsconfig.json")),
    );
    assert.equal(identity.physicalProjectRoot, fs.realpathSync(physicalRoot));
  };
