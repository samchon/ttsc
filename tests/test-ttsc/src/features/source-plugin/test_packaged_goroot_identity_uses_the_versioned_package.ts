import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { packagedGoRootIdentity } from "../../../../../packages/ttsc/src/plugin/internal/source/packagedGoRootIdentity";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the installed Go SDK's identity uses the platform package and
 * VERSION, with bounded reads and a witness that invalidates on replacement. An
 * unrelated Go root must use its own content identity.
 *
 * 1. Describe two installs of one platform package with the same SDK version.
 * 2. Compare their identities and verify the reader only touches two files.
 * 3. Change the version inputs and offer a foreign or unreadable root.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the packaged SDK identity reader over real package manifests and SDK paths. The file reader records and delegates each byte read to Node, and the real witness detects a written version file or manifest.
 * @evidence contracts/testing.md#independent-expectations A published package version and its SDK VERSION identify a shipped SDK independently of installation path. The sibling source file must not be read for an installed SDK, and a foreign root has no package identity.
 * @evidence contracts/testing.md#distinguishing-cases Equivalent paths share an identity, changed package and SDK versions do not, and a wrong root or incomplete manifest yields no package identity. Mutable SDK content hashing has its own tests.
 * @evidence contracts/testing.md#execution-ownership A direct TypeScript unit uses only task-owned directories and the hasher's file-read adapter. It launches no Go process and builds no native artifact.
 */
export function test_packaged_goroot_identity_uses_the_versioned_package(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-packaged-go-"),
  );
  const makePackage = (label: string) => {
    const location = path.join(root, label);
    const manifest = path.join(location, "package.json");
    const sdk = path.join(location, "bin", "go");
    const version = path.join(sdk, "VERSION");
    fs.mkdirSync(path.join(sdk, "src"), { recursive: true });
    fs.writeFileSync(path.join(sdk, "src", "runtime.go"), "package runtime\n");
    const setPackageVersion = (value: string): void => {
      fs.writeFileSync(
        manifest,
        JSON.stringify({
          name: `@ttsc/${process.platform}-${process.arch}`,
          version: value,
        }),
      );
    };
    setPackageVersion("1.2.3");
    fs.writeFileSync(version, "go1.27.0\n");
    return { manifest, sdk, version, setPackageVersion };
  };
  const left = makePackage("left");
  const right = makePackage("right");
  const reads: string[] = [];
  const filesystem = {
    readFile: (file: string): Buffer => {
      reads.push(file);
      return fs.readFileSync(file);
    },
  };
  const witness: PluginBuildEnvironmentWitness.Record = new Map();
  const read = (pkg: typeof left): string | undefined =>
    packagedGoRootIdentity(pkg.manifest, pkg.sdk, filesystem, undefined);
  const first = packagedGoRootIdentity(
    left.manifest,
    left.sdk,
    filesystem,
    witness,
  );
  assert.ok(first);
  assert.deepEqual(reads, [left.manifest, left.version]);
  assert.deepEqual(
    [...witness.keys()],
    [left.sdk, left.manifest, left.version, path.join(left.sdk, "go.env")],
  );
  assert.equal(read(right), first);
  assert.equal(
    packagedGoRootIdentity(left.manifest, right.sdk, filesystem, undefined),
    undefined,
  );
  right.setPackageVersion("1.2.4");
  assert.notEqual(read(right), first);
  right.setPackageVersion("1.2.3");
  fs.writeFileSync(right.version, "go1.27.1\n");
  assert.notEqual(read(right), first);
  fs.writeFileSync(left.manifest, "{}");
  assert.equal(PluginBuildEnvironmentWitness.holds(witness), false);
  assert.equal(read(left), undefined);
}
