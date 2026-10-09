import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  captureNativeLintProducer,
  decodeNativeLintGoSelection,
  linkNativeLintPackage,
  selectNativeLintSourceFiles,
} from "../../../../utils/src/NativeLintProducer";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the native lint producer capture preserves exact bytes and refuses a
 * moved or foreign source.
 *
 * The capture helper snapshots the authored lint package, so it must copy
 * exactly the authored files, sign a sorted manifest, exclude only the
 * unit-test declarations proven unused by package selection, and refuse a
 * source that changes during the copy.
 *
 * 1. Capture an authored package and require exact file bytes, a signed sorted
 *    manifest, the installation link and the excluded cache boundary.
 * 2. Select source files from package metadata and require unit-test declarations
 *    excluded while embedded ones are kept, and incomplete, empty, escaping and
 *    forged selections refused.
 * 3. Corrupt the copy, edit the source during capture, add an unaccounted source
 *    link, change the package identity and reuse a destination, requiring each
 *    to be refused.
 * 4. Decode successful Go selection with download progress on stderr, and
 *    refuse failed or signaled processes and malformed or truncated metadata.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the owning snapshot capture against authored file fixtures, requiring exact bytes, a signed sorted manifest and the real installation link; corrupt, moved, foreign or occupied inputs refuse publication or reuse. The real subprocess-result decoder accepts successful metadata with progress stderr and refuses launch, status, signal and authored malformed/truncated metadata failures.
 * @evidence contracts/testing.md#independent-expectations Literal distinct file contents and independently calculated SHA-256 values establish the copied population and manifest signature; authored terminal observations and package records establish decoder outcomes independently of its output, with literal diagnostic retention and refusal contracts.
 * @evidence contracts/testing.md#distinguishing-cases Compares regular and nested-cache assets with root cache boundaries, positive copy with corrupt or changed input, owned with foreign installations, selected with embedded tests, and same-target with conflicting links. Successful selection with progress stderr contrasts with empty stderr, error/nonzero/absent status/signal termination and malformed/truncated/empty metadata.
 * @evidence contracts/testing.md#execution-ownership The named utility unit exercises the real filesystem-copy owner with an explicit copier boundary and the maintained Go-result decoder with authored process observations, without building Go, mocking process execution, spawning product CLIs or replacing filesystem globals; TestProject owns all temporary fixture roots.
 */
export function test_native_lint_producer_snapshot_preserves_bytes_and_refuses_moved_capture(): void {
  const seed = () => {
    const sourceRoot = TestProject.tmpdir("ttsc-lint-snapshot-input-");
    const destinationRoot = TestProject.tmpdir("ttsc-lint-snapshot-copy-");
    const files = {
      "package.json": '{"name":"@ttsc/lint","main":"lib/index.js"}\n',
      "go.mod": "module example.test/lint\n\ngo 1.26\n",
      "plugin/main.go": "package main\n//go:embed assets/data.txt\n",
      "plugin/assets/data.txt": "embedded\n",
      "lib/index.js": "module.exports = { native: true };\n",
      "src/createTtscPlugin.ts": "export const descriptor = 'authored';\n",
      "plugin/.cache/embedded.txt":
        "nested asset is not an installation cache\n",
    };
    for (const [name, contents] of Object.entries(files)) {
      const target = path.join(sourceRoot, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
    fs.mkdirSync(path.join(sourceRoot, "node_modules"));
    fs.mkdirSync(path.join(sourceRoot, ".cache"));
    fs.writeFileSync(path.join(sourceRoot, ".cache", "unrelated"), "cache");
    return { sourceRoot, destinationRoot, files };
  };
  const fixture = seed();
  const result = captureNativeLintProducer(fixture);
  const manifestBytes = fs.readFileSync(result.manifestPath);
  const manifest = JSON.parse(manifestBytes.toString());
  assert.equal(
    result.manifestSha256,
    crypto.createHash("sha256").update(manifestBytes).digest("hex"),
  );
  assert.equal(result.sourceRoot, fs.realpathSync.native(fixture.sourceRoot));
  assert.deepEqual(
    manifest.files.map((file: { name: string }) => file.name),
    Object.keys(fixture.files).sort(),
  );
  for (const [name, contents] of Object.entries(fixture.files)) {
    assert.equal(
      fs.readFileSync(path.join(result.packageRoot, name), "utf8"),
      contents,
    );
    assert.equal(
      manifest.files.find((file: { name: string }) => file.name === name)
        .sha256,
      crypto.createHash("sha256").update(contents).digest("hex"),
    );
  }
  assert.equal(fs.existsSync(path.join(result.packageRoot, ".cache")), false);
  assert.equal(
    fs.realpathSync.native(path.join(result.packageRoot, "node_modules")),
    fs.realpathSync.native(path.join(fixture.sourceRoot, "node_modules")),
  );
  assert.equal(Object.isFrozen(result), true);
  const linkRoot = TestProject.tmpdir("ttsc-lint-snapshot-link-");
  const packageLink = path.join(linkRoot, "lint");
  linkNativeLintPackage(result.packageRoot, packageLink);
  linkNativeLintPackage(result.packageRoot, packageLink);
  assert.equal(
    fs.realpathSync.native(packageLink),
    fs.realpathSync.native(result.packageRoot),
  );
  assert.throws(
    () => linkNativeLintPackage(fixture.sourceRoot, packageLink),
    /Existing native lint package link does not identify the requested producer/,
  );
  const occupied = path.join(linkRoot, "occupied");
  fs.mkdirSync(occupied);
  assert.throws(
    () => linkNativeLintPackage(result.packageRoot, occupied),
    /Existing native lint package link does not identify the requested producer/,
  );

  const selected = seed();
  fs.writeFileSync(
    path.join(selected.sourceRoot, "plugin", "semantic_test.go"),
    "package main\n",
  );
  fs.writeFileSync(
    path.join(selected.sourceRoot, "plugin", "embedded_test.go"),
    "embedded Go declaration\n",
  );
  const records = [
    {
      Dir: path.join(selected.sourceRoot, "plugin"),
      GoFiles: ["main.go"],
      TestGoFiles: ["semantic_test.go", "embedded_test.go"],
      EmbedFiles: ["embedded_test.go", "assets/data.txt"],
    },
  ];
  const selection = selectNativeLintSourceFiles(selected.sourceRoot, records);
  assert.deepEqual(selection.excludedGoTestFiles, ["plugin/semantic_test.go"]);
  const observation = {
    error: undefined,
    status: 0,
    signal: null,
    stdout: records.map((record) => JSON.stringify(record)).join("\n"),
    stderr: "go: downloading example.test/dependency v1.0.0\n",
  } as const;
  assert.deepEqual(decodeNativeLintGoSelection(observation), records);
  assert.deepEqual(
    decodeNativeLintGoSelection({ ...observation, stderr: "" }),
    records,
  );
  assert.deepEqual(
    selectNativeLintSourceFiles(
      selected.sourceRoot,
      decodeNativeLintGoSelection(observation),
    ),
    selection,
  );
  for (const failure of [
    { status: 1 },
    { status: null },
    { signal: "SIGTERM" as const },
    { error: new Error("spawn unavailable") },
  ])
    assert.throws(
      () => decodeNativeLintGoSelection({ ...observation, ...failure }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("Go selection failed") &&
        error.message.includes(observation.stderr),
    );
  for (const stdout of ["not JSON", "}", '{"Dir":}', "{"])
    assert.throws(() =>
      decodeNativeLintGoSelection({ ...observation, stdout }),
    );
  assert.throws(
    () =>
      selectNativeLintSourceFiles(
        selected.sourceRoot,
        decodeNativeLintGoSelection({ ...observation, stdout: " \n" }),
      ),
    /selection has no packages/,
  );
  const selectedResult = captureNativeLintProducer({ ...selected, selection });
  assert.equal(
    fs.existsSync(
      path.join(selectedResult.packageRoot, "plugin", "semantic_test.go"),
    ),
    false,
  );
  assert.equal(
    fs.readFileSync(
      path.join(selectedResult.packageRoot, "plugin", "embedded_test.go"),
      "utf8",
    ),
    "embedded Go declaration\n",
  );
  for (const invalid of [
    { ...records[0]!, Incomplete: true },
    { ...records[0]!, Error: { Err: "invalid embed pattern" } },
    { ...records[0]!, InvalidGoFiles: ["broken.go"] },
    { ...records[0]!, DepsErrors: [{ Err: "unresolved" }] },
  ])
    assert.throws(
      () => selectNativeLintSourceFiles(selected.sourceRoot, [invalid]),
      /selection is incomplete/,
    );
  assert.throws(
    () => selectNativeLintSourceFiles(selected.sourceRoot, []),
    /selection has no packages/,
  );
  assert.throws(
    () =>
      selectNativeLintSourceFiles(selected.sourceRoot, [
        { Dir: path.dirname(selected.sourceRoot) },
      ]),
    /selection escapes its package/,
  );
  assert.throws(
    () =>
      selectNativeLintSourceFiles(selected.sourceRoot, [
        { ...records[0]!, TestGoFiles: ["../foreign.go"] },
      ]),
    /invalid source name/,
  );
  const forged = seed();
  assert.throws(
    () =>
      captureNativeLintProducer({
        ...forged,
        selection: {
          metadata: [{ Dir: forged.sourceRoot, GoFiles: ["go.mod"] }],
          excludedGoTestFiles: ["go.mod"],
        },
      }),
    /selection proof does not match/,
  );

  for (const moved of [false, true]) {
    const input = seed();
    let changed = false;
    assert.throws(
      () =>
        captureNativeLintProducer({
          ...input,
          copyFile: (source, target) => {
            fs.copyFileSync(source, target);
            if (!changed) {
              fs.appendFileSync(moved ? source : target, "different bytes");
              changed = true;
            }
          },
        }),
      {
        message:
          "Native lint producer changed during capture or its copied bytes differ",
      },
    );
  }
  const linked = seed();
  const outside = TestProject.tmpdir("ttsc-lint-snapshot-external-");
  fs.symlinkSync(
    outside,
    path.join(linked.sourceRoot, "unexpected"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(
    () => captureNativeLintProducer(linked),
    /unaccounted source link/,
  );
  const wrong = seed();
  fs.writeFileSync(
    path.join(wrong.sourceRoot, "package.json"),
    '{"name":"another-package"}',
  );
  assert.throws(() => captureNativeLintProducer(wrong), {
    message:
      "Native lint producer capture requires the authored @ttsc/lint package",
  });
  assert.throws(() => captureNativeLintProducer(fixture), {
    message: "Native lint producer capture requires an empty destination",
  });
}
