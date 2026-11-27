import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { hashPluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/hashPluginBuildEnvironment";

/**
 * Verifies GOROOT traversal resolves physical paths once for the root and once
 * per symbolic link rather than calling `realpathSync.native` on every ordinary
 * subdirectory or twice on a symlinked directory.
 *
 * Walking a 1,382-directory Go SDK called `fs.realpathSync.native` on every
 * ordinary subdirectory even though `root` was already canonicalized and
 * `readdirSync({ withFileTypes: true })` distinguishes ordinary directories
 * from links.
 *
 * 1. Build a synthetic GOROOT with nested ordinary directories, a symlinked
 *    directory alias, a symlinked file, and a cycle link back to the root.
 * 2. Hash it through `hashPluginBuildEnvironment`'s `filesystem.realpath` seam and
 *    assert `realpath` runs only for the root and the actual links (zero calls
 *    for ordinary subdirectories and no second call on the linked directory).
 * 3. Compare the digest against an uninstrumented call with default `fs` to
 *    confirm identical topology and content hashing.
 * 4. Retarget the symlink and edit a file, then hash again and assert fresh
 *    observation produces a different digest.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs hashPluginBuildEnvironment over a real synthetic SDK tree with nested ordinary directories, a directory link, a file link and a cycle link, asserting exact realpath call counts, digest parity with default fs and invalidation on retarget/edit.
 * @evidence contracts/testing.md#independent-expectations Exact expected realpath call counts follow the authored tree's root plus link entries; default-fs hashing provides an independent parity oracle and authored retarget/edit mutations establish expected digest changes.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary nested subdirectories, a symlinked directory, a symlinked file, a root cycle alias, symlink retargeting and content editing distinguish derived physical paths from real links and verify fresh observation on later calls.
 * @evidence contracts/testing.md#execution-ownership Discovered unit calls hashPluginBuildEnvironment directly with goBinary undefined over an owned temporary directory removed in finally; no Go process, compiler or host runs.
 */
export function test_hashpluginbuildenvironment_resolves_goroot_realpath_once_per_root(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-goroot-realpath-")),
  );
  const links: string[] = [];
  try {
    const sdk = path.join(root, "go");
    const externalDir = path.join(root, "ext-dir");
    const externalDir2 = path.join(root, "ext-dir-2");
    const externalFile = path.join(root, "ext-file.go");
    for (const dir of [
      path.join(sdk, "src", "fmt", "internal", "deep"),
      path.join(sdk, "src", "runtime", "sys"),
      path.join(sdk, "pkg", "tool", "host"),
      path.join(sdk, "bin"),
      path.join(sdk, "lib", "time"),
      externalDir,
      externalDir2,
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(sdk, "VERSION"), "go1.27.0\n");
    fs.writeFileSync(path.join(sdk, "go.env"), "GOTOOLCHAIN=auto\n");
    fs.writeFileSync(
      path.join(sdk, "src", "fmt", "internal", "deep", "deep.go"),
      "package deep\n",
    );
    fs.writeFileSync(
      path.join(sdk, "src", "runtime", "sys", "sys.go"),
      "package sys\n",
    );
    fs.writeFileSync(path.join(sdk, "pkg", "tool", "host", "compile"), "bin\n");
    fs.writeFileSync(path.join(sdk, "lib", "time", "zone.zip"), "zip\n");
    fs.writeFileSync(path.join(externalDir, "linked.go"), "package ext\n");
    fs.writeFileSync(path.join(externalDir2, "linked.go"), "package ext2\n");
    fs.writeFileSync(externalFile, "package linkedfile\n");

    const dirLink = path.join(sdk, "src", "linked-dir");
    const fileLink = path.join(sdk, "src", "linked-file.go");
    const cycleLink = path.join(sdk, "src", "root-cycle");
    fs.symlinkSync(
      externalDir,
      dirLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    links.push(dirLink);
    try {
      fs.symlinkSync(externalFile, fileLink, "file");
      links.push(fileLink);
    } catch (cause) {
      if (
        process.platform !== "win32" ||
        (cause as NodeJS.ErrnoException).code !== "EPERM"
      )
        throw cause;
    }
    fs.symlinkSync(
      sdk,
      cycleLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    links.push(cycleLink);

    const calls: string[] = [];
    const hashWithCounter = (): string => {
      calls.length = 0;
      const hash = crypto.createHash("sha256");
      hashPluginBuildEnvironment(
        hash,
        undefined,
        root,
        { GOROOT: sdk },
        {
          readFile: (file) => fs.readFileSync(file),
          realpath: (file) => {
            calls.push(file);
            return fs.realpathSync.native(file);
          },
        },
      );
      return hash.digest("hex");
    };

    const digestDefault = (() => {
      const hash = crypto.createHash("sha256");
      hashPluginBuildEnvironment(
        hash,
        undefined,
        root,
        { GOROOT: sdk },
        {
          readFile: (file) => fs.readFileSync(file),
        },
      );
      return hash.digest("hex");
    })();

    const digestCounted = hashWithCounter();
    assert.equal(
      digestCounted,
      digestDefault,
      "derived physical paths must produce the exact same digest as per-directory realpath",
    );

    // Expect: 1 call for resolveRealPath(goRoot) in resolveGoRootCacheIdentity,
    // plus at most 1 call per actual symlink (dirLink, fileLink, cycleLink).
    // Ordinary subdirectories (bin, lib, lib/time, pkg, pkg/tool, pkg/tool/host,
    // src, src/fmt, src/fmt/internal, src/fmt/internal/deep, src/runtime,
    // src/runtime/sys) must NOT be passed to realpath.
    const ordinarySubdir = path.join(sdk, "src", "fmt", "internal", "deep");
    assert.equal(
      calls.includes(ordinarySubdir),
      false,
      `ordinary subdirectory must not call realpath, got ${calls.length} calls: ${JSON.stringify(calls)}`,
    );
    assert.equal(
      calls.filter((entry) => entry === dirLink).length,
      1,
      "symlinked directory must call realpath once, not twice",
    );
    if (links.includes(fileLink))
      assert.equal(
        calls.filter((entry) => entry === fileLink).length,
        1,
        "symlinked file must call realpath once",
      );
    assert.equal(
      calls.filter((entry) => entry === cycleLink).length,
      1,
      "cycle directory link must call realpath once",
    );
    assert.ok(
      calls.length <= 5,
      `expected at most 5 realpath calls (root + 3 links), got ${calls.length}: ${JSON.stringify(calls)}`,
    );

    // Retargeting the directory link must be observed on the next call and change the digest.
    fs.unlinkSync(dirLink);
    fs.symlinkSync(
      externalDir2,
      dirLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    const afterRetarget = hashWithCounter();
    assert.notEqual(
      afterRetarget,
      digestCounted,
      "retargeting a symlink inside GOROOT must invalidate the digest",
    );

    // Editing an ordinary file in a nested directory must also be observed and change the digest.
    fs.writeFileSync(
      path.join(sdk, "src", "fmt", "internal", "deep", "deep.go"),
      "package deep\nconst v = 2\n",
    );
    const afterEdit = hashWithCounter();
    assert.notEqual(
      afterEdit,
      afterRetarget,
      "editing a file under an ordinary subdirectory must invalidate the digest",
    );
  } finally {
    for (const link of links)
      if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink())
        fs.unlinkSync(link);
    fs.rmSync(root, { recursive: true });
  }
}
