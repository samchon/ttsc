import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  fs,
  path,
  resolveProjectIdentity,
} from "../../internal/project-unit";

/**
 * Verifies file-based config discovery walks the caller's logical path instead
 * of physicalizing the source file first.
 *
 * Runtime and single-file APIs locate a config from the requested source. When
 * that source is reached through a link, discovery must retain the linked
 * tsconfig spelling while separately resolving the Program's physical paths.
 *
 * 1. Create a linked project containing a config and one source file.
 * 2. Discover from the source path relative to the linked root.
 * 3. Assert the selected config stays logical and the Program config is real.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveProjectIdentity from a source reached through a directory link and compares logicalConfigPath with physicalConfigPath, detecting discovery that physicalizes the source before selecting its config.
 * @evidence contracts/testing.md#independent-expectations The independently created link and underlying project define distinct authored paths; Node realpath supplies the physical-path oracle while the requested link spelling supplies the logical expectation.
 * @evidence contracts/testing.md#distinguishing-cases A source-relative request through a link differs from preserves_linked_logical_selection, which explicitly selects the linked directory; keeps_explicit_root_separate owns the unlinked explicit-root channel.
 * @evidence contracts/testing.md#execution-ownership A unit test calling resolveProjectIdentity directly with a source file path relative to a linked cwd in private temp directories with a real symlink or junction; no compiler artifact, installed consumer or CLI host is prepared.
 */
export const test_resolveprojectidentity_discovers_config_through_logical_file_path =
  (): void => {
    const physicalRoot = TestProject.tmpdir("ttsc-identity-file-physical-");
    fs.mkdirSync(path.join(physicalRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(physicalRoot, "tsconfig.json"), "{}\n");
    fs.writeFileSync(path.join(physicalRoot, "src", "main.ts"), "export {};\n");
    const logicalParent = TestProject.tmpdir("ttsc-identity-file-logical-");
    const logicalRoot = path.join(logicalParent, "linked-project");
    fs.symlinkSync(
      physicalRoot,
      logicalRoot,
      process.platform === "win32" ? "junction" : "dir",
    );

    const identity = resolveProjectIdentity({
      cwd: logicalRoot,
      file: "src/main.ts",
    });
    assert.equal(
      identity.logicalConfigPath,
      path.join(logicalRoot, "tsconfig.json"),
    );
    assert.equal(
      identity.physicalConfigPath,
      fs.realpathSync(path.join(physicalRoot, "tsconfig.json")),
    );
  };
