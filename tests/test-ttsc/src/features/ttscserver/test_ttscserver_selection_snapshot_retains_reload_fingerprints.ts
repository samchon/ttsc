import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";
import { captureLSPPluginSelectionInputs } from "../../../../../packages/ttsc/src/launcher/internal/ttscserver/captureLSPPluginSelectionInputs";
import { fingerprintInitialLSPProjectInputSnapshot } from "../../../../../packages/ttsc/src/launcher/internal/ttscserver/fingerprintInitialLSPProjectInputSnapshot";
import { initialLSPProjectInputSnapshotIsCurrent } from "../../../../../packages/ttsc/src/launcher/internal/ttscserver/initialLSPProjectInputSnapshotIsCurrent";
import { materializeLSPPluginManifest } from "../../../../../packages/ttsc/src/launcher/internal/ttscserver/materializeLSPPluginManifest";
import { hashHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/hashHostInputPaths";
import { realpathHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a server selection snapshot fingerprints both reload input lanes.
 *
 * The JavaScript launcher selects and builds contributors before the native
 * host registers editor watchers. A current-filesystem baseline created later
 * can therefore bless a selection that is already stale. This test pins the
 * launcher-owned baseline that crosses that startup gap.
 *
 * 1. Capture one exact reload file and one reload directory, prove a child-content
 *    edit leaves immediate topology current, then prove an exact-file edit and
 *    an added directory entry each make the selection stale.
 * 2. Retarget a native exact-entry link (Windows junction, POSIX file symlink) and
 *    a same-topology reload-directory link and prove lexical and physical
 *    identity invalidate the selection.
 * 3. Prove a platform-representable exact-entry link target and (on POSIX only) a
 *    backslash directory name and a representable raw directory-link target
 *    digest to independently framed sha256 values. An actual EILSEQ refusal
 *    must leave the directory unchanged and permit a valid UTF-8 target.
 * 4. Materialize and dispose a manifest larger than a Windows environment block;
 *    frame an empty existing directory and a missing directory independently,
 *    and prove each captured baseline is current. Windows missing-suffix casing
 *    follows the observed directory authority, not a platform-default guess.
 * 5. Carry intermediate links and reachable or missing physical endpoints to the
 *    native host under their own parents, including a representable POSIX raw
 *    link. Verify that the manifest stays outside a POSIX config alias's
 *    physical directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Snapshot operations distinguish child-content edits from reload-file, immediate-topology and link-identity drift and preserve framed raw identities. Selection capture records the raw intermediate link fingerprint independently of its unchanged reached bytes. It carries workspace-only metadata and rejects a witness that moved before capture. Manifest transport carries 8192 inputs and disposes its directory twice safely.
 * @evidence contracts/testing.md#independent-expectations Authored file and directory mutations define whether each snapshot must stay current or become stale; link, raw directory, empty-directory and missing-directory digests use independent sha256 framing (`symlink\0`/`directory\0`, target or native physical path bytes, NUL, `missing\0` or the empty-topology hash). Missing Windows suffix casing uses the supported authority observation without certifying that classifier itself. The test cannot prove agreement with the Go validator or startup host, only with this written framing; the manifest expectation is the literal count 8192 and a size above 64 KiB.
 * @evidence contracts/testing.md#distinguishing-cases Child contents remain current while exact-file edits and immediate topology invalidate. Exact-entry retarget uses a Windows leaf junction or POSIX leaf file symlink: both own link identity, but junction framing has missing content while the POSIX link reaches file bytes. POSIX preserves original different-content and added same-content retargets; Windows empty-directory retarget isolates identity. Native directory-link retarget is mandatory. POSIX raw bytes/backslash names and Windows Unicode junction bytes retain their distinct native input domains. Only an observed EILSEQ creation refusal selects UTF-8 recovery after an unchanged directory/link assertion; other preparation errors fail; manifest contents and repeated disposal are asserted separately.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver entry exercises the owning operations on isolated inputs. A Node child supplies a controlled temporary environment for the manifest boundary case without changing the test runner's environment. No native host, build or consumer installation executes.
 */
export const test_ttscserver_selection_snapshot_retains_reload_fingerprints =
  (): void => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttscserver-selection-snapshot-"),
    );
    const reloadFile = path.join(root, "lint.config.cjs");
    const reloadDirectory = path.join(root, "config-deps");
    const child = path.join(reloadDirectory, "selection.cjs");
    fs.mkdirSync(reloadDirectory, { recursive: true });
    fs.writeFileSync(reloadFile, "module.exports = {};", "utf8");
    fs.writeFileSync(child, "alpha", "utf8");

    try {
      const failures: unknown[] = [];
      const verify = (name: string, run: () => void): void => {
        try {
          run();
        } catch (cause) {
          failures.push(new Error(name, { cause }));
        }
      };
      verify(
        "workspace metadata stays separate from descriptor content",
        () => {
          const selector = path.join(root, "workspace-goenv");
          fs.writeFileSync(selector, "first");
          const witness: PluginBuildEnvironmentWitness.Record = new Map();
          PluginBuildEnvironmentWitness.add(witness, selector);
          const input = {
            deferredHostInputs: [],
            hostInputHashes: {},
            hostInputRealpaths: {},
            hostInputs: [],
            pluginSources: {},
            workspaceInputs: PluginBuildEnvironmentWitness.watchInputs(
              [witness],
              root,
            ),
          };
          const observed = captureLSPPluginSelectionInputs(input);
          assert.deepEqual(observed?.descriptorFiles, {});
          assert.equal(observed?.workspaceFiles?.length, 1);
          const entry = observed?.workspaceFiles?.[0];
          assert.equal(entry?.path, Buffer.from(selector).toString("base64"));
          assert.equal(entry?.kind, "stat");
          assert.equal(entry?.size, "5");
          fs.appendFileSync(selector, " moved");
          assert.equal(captureLSPPluginSelectionInputs(input), undefined);
        },
      );
      verify("ordinary reload content and topology", () => {
        const first = fingerprintInitialLSPProjectInputSnapshot({
          files: [reloadFile],
          globs: [],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
          root,
        });
        assert.equal(initialLSPProjectInputSnapshotIsCurrent(first), true);

        fs.writeFileSync(child, "beta", "utf8");
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(first),
          true,
          "child contents must not change immediate directory topology",
        );

        fs.writeFileSync(reloadFile, "module.exports = { rules: {} };", "utf8");
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(first),
          false,
          "exact reload-file drift must invalidate startup selection",
        );

        const second = fingerprintInitialLSPProjectInputSnapshot({
          files: [reloadFile],
          globs: [],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
          root,
        });
        fs.writeFileSync(path.join(reloadDirectory, "nearer.cjs"), "", "utf8");
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(second),
          false,
          "immediate directory topology drift must invalidate startup selection",
        );
      });

      const existingDirectory = path.join(root, "ExistingDirectory");
      const missingDirectory = path.join(root, "MissingDirectory");
      fs.mkdirSync(existingDirectory);
      const realpath = fs.realpathSync.native ?? fs.realpathSync;
      const parentCaseSensitive =
        process.platform === "win32"
          ? createProjectInputPathIdentityContext().caseSensitive(root)
          : undefined;
      for (const [directory, topology] of [
        [
          existingDirectory,
          createHash("sha256").update(Buffer.alloc(0)).digest("hex"),
        ],
        [
          missingDirectory,
          createHash("sha256").update("missing\0").digest("hex"),
        ],
      ] as const) {
        verify(
          `empty or missing directory frame: ${path.basename(directory)}`,
          () => {
            if (directory === existingDirectory) {
              assert.deepEqual(fs.readdirSync(directory), []);
            } else {
              assert.equal(fs.existsSync(directory), false);
            }
            const identity =
              process.platform === "win32"
                ? Buffer.from(
                    (directory === existingDirectory
                      ? path.resolve(realpath(directory))
                      : path.resolve(
                          realpath(root),
                          parentCaseSensitive === false
                            ? "missingdirectory"
                            : "MissingDirectory",
                        )
                    ).replaceAll("\\", "/"),
                  )
                : directory === existingDirectory
                  ? realpath(Buffer.from(directory), { encoding: "buffer" })
                  : Buffer.concat([
                      realpath(Buffer.from(root), { encoding: "buffer" }),
                      Buffer.from("/MissingDirectory"),
                    ]);
            const expected = createHash("sha256")
              .update(
                Buffer.concat([
                  Buffer.from("directory\0"),
                  identity,
                  Buffer.from([0]),
                  Buffer.from(topology),
                ]),
              )
              .digest("hex");
            const snapshot = fingerprintInitialLSPProjectInputSnapshot({
              files: [],
              globs: [],
              reloadDirectories: [directory],
              root,
            });
            assert.equal(snapshot.reloadDirectoryDigests[directory], expected);
            assert.equal(
              initialLSPProjectInputSnapshotIsCurrent(snapshot),
              true,
            );
          },
        );
      }

      verify("native exact-file link retarget", () => {
        const firstTarget = path.join(root, "first-target.cjs");
        const secondTarget = path.join(root, "second-target.cjs");
        const reloadLink = path.join(root, "reload-link.cjs");
        const linkKind = process.platform === "win32" ? "junction" : "file";
        if (process.platform === "win32") {
          fs.mkdirSync(firstTarget);
          fs.mkdirSync(secondTarget);
        } else {
          fs.writeFileSync(firstTarget, "first", "utf8");
          fs.writeFileSync(secondTarget, "second", "utf8");
        }
        fs.symlinkSync(firstTarget, reloadLink, linkKind);
        const linked = fingerprintInitialLSPProjectInputSnapshot({
          files: [reloadLink],
          globs: [],
          reloadFiles: [reloadLink],
          root,
        });
        assert.equal(initialLSPProjectInputSnapshotIsCurrent(linked), true);
        assert.equal(fs.lstatSync(reloadLink).isSymbolicLink(), true);
        if (process.platform === "win32") {
          assert.throws(() => fs.readFileSync(reloadLink));
          const framed = createHash("sha256")
            .update(
              Buffer.concat([
                Buffer.from("symlink\0"),
                fs.readlinkSync(reloadLink, { encoding: "buffer" }),
                Buffer.from([0]),
                Buffer.from("missing\0"),
              ]),
            )
            .digest("hex");
          assert.equal(
            linked.reloadFileDigests[reloadLink],
            framed,
            "Windows leaf junction is a link frame with unavailable file content",
          );
        }
        fs.rmSync(reloadLink, { recursive: true, force: true });
        fs.symlinkSync(secondTarget, reloadLink, linkKind);
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(linked),
          false,
          "exact reload-file symlink retarget must invalidate startup selection",
        );
        const equalContentTarget = path.join(root, "equal-content-target.cjs");
        if (process.platform === "win32") {
          fs.mkdirSync(equalContentTarget);
          assert.deepEqual(fs.readdirSync(secondTarget), []);
          assert.deepEqual(fs.readdirSync(equalContentTarget), []);
        } else {
          fs.writeFileSync(equalContentTarget, "second", "utf8");
          assert.equal(
            fs.readFileSync(secondTarget, "utf8"),
            fs.readFileSync(equalContentTarget, "utf8"),
          );
        }
        const equalContent = fingerprintInitialLSPProjectInputSnapshot({
          files: [reloadLink],
          globs: [],
          reloadFiles: [reloadLink],
          root,
        });
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(equalContent),
          true,
        );
        fs.rmSync(reloadLink, { recursive: true, force: true });
        fs.symlinkSync(equalContentTarget, reloadLink, linkKind);
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(equalContent),
          false,
          "same-content leaf retarget must change link identity",
        );
      });

      verify("native same-topology directory retarget", () => {
        const firstDirectoryTarget = path.join(root, "first-directory-target");
        const secondDirectoryTarget = path.join(
          root,
          "second-directory-target",
        );
        const reloadDirectoryLink = path.join(root, "reload-directory-link");
        fs.mkdirSync(firstDirectoryTarget);
        fs.mkdirSync(secondDirectoryTarget);
        fs.symlinkSync(
          firstDirectoryTarget,
          reloadDirectoryLink,
          process.platform === "win32" ? "junction" : "dir",
        );
        const linkedDirectory = fingerprintInitialLSPProjectInputSnapshot({
          files: [],
          globs: [],
          reloadDirectories: [reloadDirectoryLink],
          root,
        });
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(linkedDirectory),
          true,
        );
        fs.rmSync(reloadDirectoryLink, { force: true, recursive: true });
        fs.symlinkSync(
          secondDirectoryTarget,
          reloadDirectoryLink,
          process.platform === "win32" ? "junction" : "dir",
        );
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(linkedDirectory),
          false,
          "same-topology reload-directory retarget must invalidate startup selection",
        );
      });

      if (process.platform !== "win32") {
        verifyRawDirectoryIdentity(root, verify);
      }

      verify("native target-byte file framing", () => {
        const unicodeDirectory = path.join(root, "\uD3EC\uD568-target");
        const invalidTarget =
          process.platform === "win32"
            ? Buffer.from(unicodeDirectory)
            : Buffer.from([0xff, 0x78]);
        const invalidLink = path.join(root, "invalid-target-link");
        if (process.platform === "win32") fs.mkdirSync(unicodeDirectory);
        fs.symlinkSync(
          invalidTarget,
          Buffer.from(invalidLink),
          process.platform === "win32" ? "junction" : "file",
        );
        assert.deepEqual(
          fs.readlinkSync(Buffer.from(invalidLink), { encoding: "buffer" }),
          invalidTarget,
        );
        assert.throws(() => fs.readFileSync(invalidLink));
        const rawLinked = fingerprintInitialLSPProjectInputSnapshot({
          files: [invalidLink],
          globs: [],
          reloadFiles: [invalidLink],
          root,
        });
        const expected = createHash("sha256")
          .update(
            Buffer.concat([
              Buffer.from("symlink\0"),
              invalidTarget,
              Buffer.from([0]),
              Buffer.from("missing\0"),
            ]),
          )
          .digest("hex");
        assert.equal(rawLinked.reloadFileDigests[invalidLink], expected);
      });

      verify("large manifest transport and disposal", () => {
        const largeFiles = Array.from({ length: 8_192 }, (_, index) =>
          path.join(
            root,
            "inputs",
            `${index.toString().padStart(5, "0")}.json`,
          ),
        );
        const transport = materializeLSPPluginManifest({
          initialProjectInputs: {
            transport: {
              files: largeFiles,
              globs: [],
              root,
            },
          },
          lspPlugins: [],
          plugins: [],
        });
        const manifestDirectory = path.dirname(transport.path);
        try {
          const body = fs.readFileSync(transport.path, "utf8");
          assert.ok(
            Buffer.byteLength(body) > 64 * 1024,
            "fixture must exceed a practical Windows environment payload",
          );
          const parsed = JSON.parse(body) as {
            initialProjectInputs: {
              transport: { files: string[] };
            };
          };
          assert.equal(
            parsed.initialProjectInputs.transport.files.length,
            8_192,
          );
          assert.deepEqual(
            parsed.initialProjectInputs.transport.files,
            largeFiles,
          );
        } finally {
          transport.dispose();
          transport.dispose();
        }
        assert.equal(fs.existsSync(manifestDirectory), false);
      });
      if (process.platform !== "win32")
        verify("manifest excludes the physical config directory", () => {
          verifyManifestConfigBoundary();
        });
      verify("plugin selection watches every link in the source path", () => {
        const link = path.join(root, "source-link");
        const middleName =
          process.platform === "win32" ? "source-middle" : "source\\middle";
        const middle = path.join(root, middleName);
        const physical = path.join(root, "physical-source");
        const replacement = path.join(root, "replacement-source");
        const source = path.join(link, "nested", "src");
        const kind = process.platform === "win32" ? "junction" : "dir";
        fs.mkdirSync(path.join(physical, "nested", "src"), {
          recursive: true,
        });
        fs.mkdirSync(path.join(replacement, "nested", "src"), {
          recursive: true,
        });
        fs.symlinkSync(physical, middle, kind);
        fs.symlinkSync(middle, link, kind);
        try {
          const descriptorName = "config.cjs";
          const descriptor = path.join(source, descriptorName);
          const actualDirectory = path.join(physical, "nested", "src");
          const actualFile = path.join(actualDirectory, descriptorName);
          const bytes = "module.exports = {};\n";
          fs.writeFileSync(actualFile, bytes);
          const hostInputRealpaths = {
            [source]: fs.realpathSync.native(source),
            [descriptor]: fs.realpathSync.native(descriptor),
          };
          const input = {
            deferredHostInputs: [],
            hostInputHashes: {},
            hostInputRealpaths,
            hostInputs: [source, descriptor],
            pluginSources: {},
          };
          const snapshot = captureLSPPluginSelectionInputs(input);
          assert.ok(snapshot);
          assert.equal(
            snapshot.descriptorFiles[actualDirectory]?.[descriptorName],
            createHash("sha256").update("file\0").update(bytes).digest("hex"),
          );
          for (const entry of [link, middle]) {
            const digest = createHash("sha256")
              .update("symlink\0")
              .update(fs.readlinkSync(entry, { encoding: "buffer" }))
              .update("\0missing\0")
              .digest("hex");
            assert.equal(
              snapshot.descriptorFiles[root]?.[path.basename(entry)],
              digest,
            );
          }
          const missing = path.join(source, "later.cjs");
          const missingInput = {
            ...input,
            hostInputs: [missing],
            hostInputHashes: { [missing]: null },
            hostInputRealpaths: { [missing]: null },
          };
          assert.ok(
            captureLSPPluginSelectionInputs(missingInput)?.descriptorFiles[
              root
            ]?.[middleName],
          );
          fs.writeFileSync(
            path.join(replacement, "nested", "src", "later.cjs"),
            "module.exports = {};\n",
          );
          fs.unlinkSync(middle);
          fs.symlinkSync(replacement, middle, kind);
          assert.equal(captureLSPPluginSelectionInputs(input), undefined);
          assert.equal(
            captureLSPPluginSelectionInputs(missingInput),
            undefined,
          );
        } finally {
          fs.unlinkSync(link);
          fs.unlinkSync(middle);
        }
      });
      verify(
        "plugin selection omits the empty basename of a volume-root endpoint",
        () => {
          const alias = path.join(root, "volume-root-alias");
          fs.symlinkSync(
            path.parse(root).root,
            alias,
            process.platform === "win32" ? "junction" : "dir",
          );
          try {
            const snapshot = captureLSPPluginSelectionInputs({
              deferredHostInputs: [],
              hostInputHashes: hashHostInputPaths([alias]),
              hostInputRealpaths: realpathHostInputPaths([alias]),
              hostInputs: [alias],
              pluginSources: {},
            });
            assert.ok(snapshot?.descriptorFiles[root]?.[path.basename(alias)]);
            for (const files of Object.values(snapshot.descriptorFiles))
              assert.equal(Object.hasOwn(files, ""), false);
          } finally {
            fs.unlinkSync(alias);
          }
        },
      );
      verify(
        "plugin selection watches a dangling final link's external endpoint",
        () => {
          const directory = path.join(root, "unavailable-descriptor-parent");
          const link = path.join(root, "dangling-descriptor");
          fs.symlinkSync(
            directory,
            link,
            process.platform === "win32" ? "junction" : "dir",
          );
          try {
            const input = {
              deferredHostInputs: [],
              hostInputHashes: { [link]: null },
              hostInputRealpaths: { [link]: null },
              hostInputs: [link],
              pluginSources: {},
            };
            const snapshot = captureLSPPluginSelectionInputs(input);
            assert.equal(
              snapshot?.descriptorFiles[root]?.[path.basename(directory)],
              createHash("sha256").update("missing\0").digest("hex"),
            );
            fs.mkdirSync(directory);
            assert.equal(captureLSPPluginSelectionInputs(input), undefined);
          } finally {
            fs.unlinkSync(link);
          }
        },
      );
      if (failures.length !== 0)
        throw new AggregateError(
          failures,
          "Selection snapshot boundary failures",
        );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };

/** Exercise manifest allocation with a file alias and controlled child temp. */
function verifyManifestConfigBoundary(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttscserver-manifest-config-", "/tmp"),
  );
  const invocation = path.join(root, "invocation");
  const logical = path.join(root, "logical");
  const physical = path.join(root, "physical");
  try {
    for (const dir of [invocation, logical, physical]) fs.mkdirSync(dir);
    const config = path.join(logical, "tsconfig.json");
    fs.writeFileSync(path.join(physical, "custom.json"), "{}");
    fs.symlinkSync(path.join(physical, "custom.json"), config);
    const loader = new URL(
      "../../../../../config/register-unit-loader.mjs",
      import.meta.url,
    );
    const manifestModule = new URL(
      "../../../../../packages/ttsc/src/launcher/internal/ttscserver/materializeLSPPluginManifest.ts",
      import.meta.url,
    );
    const identityModule = new URL(
      "../../../../../packages/ttsc/src/compiler/internal/project/resolveProjectIdentity.ts",
      import.meta.url,
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        loader.href,
        "--input-type=module",
        "--eval",
        `
        import path from "node:path";
        import { materializeLSPPluginManifest } from ${JSON.stringify(manifestModule.href)};
        import { resolveProjectIdentity } from ${JSON.stringify(identityModule.href)};
        const identity = resolveProjectIdentity({ tsconfig: ${JSON.stringify(config)} });
        const parents = [identity.logicalProjectRoot, identity.physicalProjectRoot];
        for (const project of [process.cwd(), identity]) {
          const transport = materializeLSPPluginManifest({}, project);
          try {
            parents.push(path.dirname(path.dirname(transport.path)));
          } finally {
            transport.dispose();
          }
        }
        process.stdout.write(JSON.stringify(parents));
        `,
      ],
      {
        cwd: invocation,
        env: { ...process.env, NODE_OPTIONS: undefined, TMPDIR: physical },
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [
      logical,
      physical,
      physical,
      fs.realpathSync.native("/tmp"),
    ]);
    assert.deepEqual(fs.readdirSync(physical), ["custom.json"]);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}

function verifyRawDirectoryIdentity(
  root: string,
  verify: (name: string, run: () => void) => void,
): void {
  const topology = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
  verify("POSIX backslash directory identity", () => {
    const backslashDirectory = path.join(root, String.raw`back\slash`);
    fs.mkdirSync(backslashDirectory);
    const backslashSnapshot = fingerprintInitialLSPProjectInputSnapshot({
      files: [],
      globs: [],
      reloadDirectories: [backslashDirectory],
      root,
    });
    const expectedBackslash = createHash("sha256")
      .update(
        Buffer.concat([
          Buffer.from("directory\0"),
          Buffer.from(backslashDirectory),
          Buffer.from([0]),
          Buffer.from(topology),
        ]),
      )
      .digest("hex");
    assert.equal(
      backslashSnapshot.reloadDirectoryDigests[backslashDirectory],
      expectedBackslash,
      "POSIX backslash filename was rewritten as a path separator",
    );
  });

  verify("POSIX raw directory identity", () => {
    const rawTarget = Buffer.concat([
      Buffer.from(root),
      Buffer.from(path.sep),
      Buffer.from([0xff, 0x2d, 0x64, 0x69, 0x72]),
    ]);
    const rawLink = path.join(root, "raw-directory-link");
    const before = fs
      .readdirSync(root, { encoding: "buffer" })
      .sort(Buffer.compare);
    let target: Buffer;
    try {
      fs.mkdirSync(rawTarget);
      target = rawTarget;
    } catch (error) {
      // POSIX path syntax alone does not promise arbitrary filename bytes.
      // APFS rejects invalid UTF-8 at creation; observe that boundary without
      // masking permission, space, or unrelated fixture failures.
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "EILSEQ");
      assert.deepEqual(
        fs.readdirSync(root, { encoding: "buffer" }).sort(Buffer.compare),
        before,
      );
      assert.equal(fs.existsSync(rawLink), false);
      target = Buffer.from(path.join(root, "\uC720\uD6A8-directory"));
      fs.mkdirSync(target);
      console.log(
        "raw directory capability: invalid UTF-8 refused; verifying UTF-8 recovery",
      );
    }
    fs.symlinkSync(target, Buffer.from(rawLink), "dir");
    const rawSnapshot = fingerprintInitialLSPProjectInputSnapshot({
      files: [],
      globs: [],
      reloadDirectories: [rawLink],
      root,
    });
    const expectedRaw = createHash("sha256")
      .update(
        Buffer.concat([
          Buffer.from("directory\0"),
          (fs.realpathSync.native ?? fs.realpathSync)(Buffer.from(rawLink), {
            encoding: "buffer",
          }),
          Buffer.from([0]),
          Buffer.from(topology),
        ]),
      )
      .digest("hex");
    assert.equal(
      rawSnapshot.reloadDirectoryDigests[rawLink],
      expectedRaw,
      "physical directory identity lost the native target bytes",
    );
    assert.equal(initialLSPProjectInputSnapshotIsCurrent(rawSnapshot), true);
    if (!target.equals(rawTarget)) return;
    const middle = Buffer.concat([rawTarget, Buffer.from("/middle")]);
    const first = path.join(root, "raw-descriptor-first");
    const second = path.join(root, "raw-descriptor-second");
    const alias = path.join(root, "raw-descriptor-alias");
    const contents = "module.exports = {};";
    fs.writeFileSync(first, contents);
    fs.writeFileSync(second, contents);
    fs.symlinkSync(first, middle, "file");
    fs.symlinkSync(middle, alias, "file");
    const input = {
      deferredHostInputs: [],
      hostInputHashes: {},
      hostInputRealpaths: { [alias]: first },
      hostInputs: [alias],
      pluginSources: {},
    };
    const selection = captureLSPPluginSelectionInputs(input);
    const expectedMiddle = createHash("sha256")
      .update("symlink\0")
      .update(first)
      .update("\0file\0")
      .update(contents)
      .digest("hex");
    assert.deepEqual(selection?.rawDescriptorFiles, {
      [middle.toString("base64")]: expectedMiddle,
    });
    fs.unlinkSync(middle);
    fs.symlinkSync(second, middle, "file");
    assert.equal(fs.readFileSync(alias, "utf8"), contents);
    assert.equal(captureLSPPluginSelectionInputs(input), undefined);
    fs.unlinkSync(alias);
    fs.unlinkSync(middle);

    const rawFirst = Buffer.concat([rawTarget, Buffer.from([0x2f, 0xff])]);
    const rawSecond = Buffer.concat([rawTarget, Buffer.from([0x2f, 0xfe])]);
    fs.writeFileSync(rawFirst, contents);
    fs.writeFileSync(rawSecond, contents);
    fs.symlinkSync(rawFirst, alias, "file");
    const rawInput = {
      ...input,
      hostInputHashes: hashHostInputPaths([alias]),
      hostInputRealpaths: realpathHostInputPaths([alias]),
    };
    const initialSelection = captureLSPPluginSelectionInputs(rawInput);
    assert.deepEqual(initialSelection?.rawDescriptorFiles, {
      [rawFirst.toString("base64")]: createHash("sha256")
        .update("file\0")
        .update(contents)
        .digest("hex"),
    });
    const beforeLossyTarget = fs.realpathSync.native(alias);
    fs.unlinkSync(alias);
    fs.symlinkSync(rawSecond, alias, "file");
    assert.equal(fs.realpathSync.native(alias), beforeLossyTarget);
    assert.deepEqual(hashHostInputPaths([alias]), rawInput.hostInputHashes);
    assert.equal(captureLSPPluginSelectionInputs(rawInput), undefined);
    fs.unlinkSync(alias);
  });
}
