import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildSingleRootProject } from "../../../../../packages/ttsc/src/launcher/internal/buildSingleRootProject";

/**
 * An occupied overlay name is not storage owned by a single-root build.
 *
 * Both a regular file and a directory occupy the checked-build overlay path.
 * Exclusive acquisition must refuse them before emitting and leave their
 * authored contents intact. This does not inject a partial write failure or
 * certify cleanup of an overlay that the build successfully acquired.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls buildSingleRootProject with checked:true, an owned project and an entry outside its file list. Each occupied overlay must throw EEXIST, retain its entry kind and sentinel bytes, and leave emitDir absent.
 * @evidence contracts/testing.md#independent-expectations Exclusive wx acquisition cannot own an already occupied path. Literal sentinel contents and directory member names are authored independently; the missing absolute compiler path has neither a js nor ts extension and is not a compiler substitute.
 * @evidence contracts/testing.md#distinguishing-cases A regular-file collision contrasts with a directory collision, whose child must also survive. Named observations collect error-code, entry-kind, content and no-emit effects independently. Successful compilation and acquired-overlay partial-write cleanup are outside this collision-only contribution.
 * @evidence contracts/testing.md#execution-ownership This source unit imports the actual operation and uses private filesystem inputs without an installed consumer, fake compiler, foreign replacement or product host. Checked placement reaches exclusive acquisition before project parsing/building; native path-identity preparation may invoke a Windows capability child, so it does not certify all-process-free execution. Finally attempts private-root removal and reports cleanup failure with other observations.
 */
export function test_single_root_build_preserves_occupied_overlay_entries(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-occupied-overlay-"));
  const failures: Error[] = [];
  const observe = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    for (const kind of ["file", "directory"] as const) {
      observe(`${kind} collision input and observations`, () => {
        const projectRoot = path.join(root, kind);
        fs.mkdirSync(projectRoot);
        const tsconfig = path.join(projectRoot, "tsconfig.json");
        const source = path.join(projectRoot, "entry.ts");
        const configBytes =
          '{"compilerOptions":{"module":"commonjs"},"files":["included.ts"]}\n';
        const sourceBytes = "export const entry = 1;\n";
        fs.writeFileSync(tsconfig, configBytes);
        fs.writeFileSync(source, sourceBytes);
        fs.writeFileSync(
          path.join(projectRoot, "included.ts"),
          "export const included = 2;\n",
        );
        const overlay = path.join(
          projectRoot,
          ".ttsx-entry.occupied.tsconfig.json",
        );
        const sentinelBytes = "existing overlay owner\n";
        const sentinel =
          kind === "file" ? overlay : path.join(overlay, "keep.txt");
        if (kind === "directory") fs.mkdirSync(overlay);
        fs.writeFileSync(sentinel, sentinelBytes);
        const emitDir = path.join(projectRoot, "emit");
        const binary = path.join(projectRoot, "missing-native-compiler");
        assert.equal(path.isAbsolute(binary), true);
        assert.equal(fs.existsSync(binary), false);
        assert.equal(fs.existsSync(emitDir), false);
        observe(`${kind} collision refuses exclusive acquisition`, () => {
          assert.throws(
            () =>
              buildSingleRootProject({
                source,
                tsconfig,
                projectRoot,
                key: "occupied",
                emitDir,
                checked: true,
                role: "entry",
                options: { binary },
              }),
            { code: "EEXIST" },
          );
        });
        observe(`${kind} occupied entry kind survives`, () => {
          const stat = fs.lstatSync(overlay);
          assert.equal(stat.isFile(), kind === "file");
          assert.equal(stat.isDirectory(), kind === "directory");
        });
        observe(`${kind} sentinel bytes survive`, () => {
          assert.equal(fs.readFileSync(sentinel, "utf8"), sentinelBytes);
          if (kind === "directory")
            assert.deepEqual(fs.readdirSync(overlay), ["keep.txt"]);
        });
        observe(`${kind} owned project inputs survive`, () => {
          assert.equal(fs.readFileSync(tsconfig, "utf8"), configBytes);
          assert.equal(fs.readFileSync(source, "utf8"), sourceBytes);
        });
        observe(`${kind} collision produces no emit directory`, () => {
          assert.equal(fs.existsSync(emitDir), false);
        });
      });
    }
  } finally {
    observe("private root cleanup", () => {
      fs.rmSync(root, { recursive: true, force: true });
    });
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "occupied overlay observations failed");
}
