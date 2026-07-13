import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  resolveProjectIdentity,
} from "../../internal/project";

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
