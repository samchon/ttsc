import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { computeCacheKey } from "../../../../../packages/ttsc/src/plugin/internal/source/computeCacheKey";
import { ensureExecutableGoToolchain } from "../../../../../packages/ttsc/src/plugin/internal/source/ensureExecutableGoToolchain";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies SDK byte-reading reuse follows the actual selected file manifest.
 *
 * 1. Read independently authored SDK files cold, then reuse unchanged inputs.
 * 2. Repeat actual tool permission repair without changing its established mode.
 * 3. Edit, add, rename and delete selected files, checking reads and key changes.
 *
 * @evidence contracts/testing.md#behavioral-verification Official computeCacheKey executes the SDK identity owner with a real readFile counter. Unchanged SDK files read zero bytes again; each of four manifest changes rereads content and changes the key. Repeated actual permission repair also preserves established reuse.
 * @evidence contracts/testing.md#independent-expectations Literal alpha/bravo contents and authored added/renamed/removed paths distinguish unchanged and changed inputs. The adapter counts actual filesystem reads, independently of key construction; no expected digest is computed by production code.
 * @evidence contracts/testing.md#distinguishing-cases Cold and warm identity, repeated tool permission repair, content edit, file addition, path rename and deletion retain the original distinctions. This unit does not claim a POSIX permission transition on Windows or certify compiler execution.
 * @evidence contracts/testing.md#execution-ownership The source operations use explicit env.GOROOT and no goBinary; the plugin has no replace directives, so no Go metadata, compiler, native observer or build starts. The read adapter performs actual fs.readFileSync and finally removes only this invocation's allocated tree. Canonical publication owns builder call order and actual compiler connection separately.
 */
export function test_computecachekey_reuses_goroot_reads_across_owned_manifest_changes(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-goroot-read-reuse-")),
  );
  try {
    const fixture = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "test", "fixtures", "unit", "computecachekey_reuses_goroot_reads_across_owned_manifest_changes");
    TestProject.copyDirectory(path.join(fixture, "inputs-1"), root);
    for (const relative of ["plugin/main.go", "go-root/src/fmt/print.go", "go-root/src/runtime/runtime.go"])
      fs.renameSync(path.join(root, `${relative}.txt`), path.join(root, relative));
    const plugin = path.join(root, "plugin");
    const sdk = path.join(root, "go-root");
    const sourceFile = path.join(sdk, "src", "fmt", "print.go");
    const go = path.join(
      sdk,
      "bin",
      process.platform === "win32" ? "go.exe" : "go",
    );
    const authored = new Map([
      [path.join(plugin, "go.mod"), "module example.com/plugin\n\ngo 1.26\n"],
      [path.join(plugin, "main.go"), "package main\n"],
      [path.join(sdk, "VERSION"), "go1.26.0\n"],
      [path.join(sdk, "go.env"), "GOTOOLCHAIN=auto\n"],
      [sourceFile, 'package fmt\nconst marker = "alpha"\n'],
      [path.join(sdk, "src", "runtime", "runtime.go"), "package runtime\n"],
      [path.join(sdk, "pkg", "tool", "linux_amd64", "compile"), "compile\n"],
      [go, "authored tool bytes; never executed\n"],
    ]);
    for (const [file, bytes] of authored) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!file.endsWith(".go") && file !== path.join(plugin, "go.mod")) fs.writeFileSync(file, bytes);
      assert.equal(fs.readFileSync(file, "utf8"), bytes);
    }
    // Establish permission repair's final state before the cold reading. A
    // repeated repair must not dirty the SDK manifest it has already repaired.
    ensureExecutableGoToolchain(go, true);
    let reads = 0;
    const key = (): string =>
      computeCacheKey({
        dir: plugin,
        entry: ".",
        env: { GOROOT: sdk },
        filesystem: {
          readFile: (file) => {
            const relative = path.relative(sdk, path.resolve(file));
            if (
              relative !== "" &&
              relative !== ".." &&
              !relative.startsWith(`..${path.sep}`) &&
              !path.isAbsolute(relative)
            )
              reads++;
            return fs.readFileSync(file);
          },
        },
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
    const failures: unknown[] = [];
    const verify = (name: string, run: () => void): void => {
      try {
        run();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };
    let previous: string | undefined;
    verify("cold SDK reading", () => {
      previous = key();
      assert.ok(reads > 0, "cold SDK identity must read selected bytes");
    });
    verify("unchanged warm SDK", () => {
      reads = 0;
      assert.ok(previous, "cold key prerequisite");
      assert.equal(key(), previous);
      assert.equal(reads, 0);
    });
    verify("repeated real permission repair", () => {
      ensureExecutableGoToolchain(go, true);
      reads = 0;
      assert.ok(previous, "cold key prerequisite");
      assert.equal(key(), previous);
      assert.equal(
        reads,
        0,
        "unchanged repaired tool modes must preserve SDK reuse",
      );
    });
    const added = path.join(sdk, "src", "fmt", "added.go");
    const renamed = path.join(sdk, "src", "fmt", "renamed.go");
    for (const [name, mutate] of [
      [
        "content edit",
        () => {
          fs.copyFileSync(path.join(fixture, "inputs-2", "go-root", "src", "fmt", "print.go.txt"), sourceFile);
          assert.equal(fs.readFileSync(sourceFile, "utf8"), 'package fmt\nconst marker = "bravo"\n');
        },
      ],
      ["file addition", () => {
        fs.copyFileSync(path.join(fixture, "inputs-3", "go-root", "src", "fmt", "added.go.txt"), added);
        assert.equal(fs.readFileSync(added, "utf8"), "package fmt\n");
      }],
      ["file rename", () => fs.renameSync(added, renamed)],
      ["file deletion", () => fs.unlinkSync(renamed)],
    ] as const) {
      verify(name, () => {
        mutate();
        reads = 0;
        const current = key();
        assert.ok(previous, "previous successful key prerequisite");
        assert.notEqual(current, previous, `${name} must change the key`);
        assert.ok(reads > 0, `${name} must reread selected SDK bytes`);
        previous = current;
      });
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "SDK manifest read-reuse matrix failed",
      );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
