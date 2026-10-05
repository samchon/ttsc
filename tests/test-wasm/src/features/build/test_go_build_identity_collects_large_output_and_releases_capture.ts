import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const { createInputIdentity } = createRequire(import.meta.url)(
  "../../../../../packages/wasm/build/go-build-cache.cjs",
);

/**
 * Verifies dependency output above the process capture limit remains complete.
 *
 * The existing command seam runs a Node producer against the actual stdout
 * descriptor. No Go compilation or product host is needed to distinguish the
 * transport defect from the cache's source-byte identity.
 *
 * 1. Produce a dependency JSON record larger than 1 MiB and a trailing source.
 * 2. Change that trailing source and require a different input identity.
 * 3. Fail the producer and verify every capture file and descriptor is released.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createInputIdentity with real subprocess stdout writes above 1 MiB, checks both selected source paths and hash invalidation after changing the trailing source, and checks descriptor and temporary-directory cleanup after success and command failure.
 * @evidence contracts/testing.md#independent-expectations Authored dependency records name two literal source files. Changing the latter must change a source-byte cache identity; closed descriptors must reject fstat with EBADF and their capture directories must be absent. No expected hash is computed from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Successful oversized output, a changed trailing source and a nonzero producer exit distinguish complete collection, source invalidation and exceptional resource release. All three metadata command invocations retain their distinct authored JSON values.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit calls the owning synchronous cache operation through its existing execFileSync seam. Node only produces metadata bytes into the actual descriptor; no installed package, Go compiler, WASM artifact or product host is prepared.
 */
export const test_go_build_identity_collects_large_output_and_releases_capture =
  (): void => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-cache-unit-"));
    const captures: { descriptor: number; directory: string }[] = [];
    let fail = false;
    try {
      fs.writeFileSync(path.join(root, "first.go"), "package first\n");
      fs.writeFileSync(path.join(root, "last.go"), "package last\n");
      const command = (_file: string, args: string[], options: any): void => {
        const descriptor = options.stdio[1];
        // The capture directory is observable through the open descriptor's
        // actual child write, without inspecting repository source text.
        const directories = fs
          .readdirSync(os.tmpdir())
          .filter((name) => name.startsWith("ttsc-go-list-"));
        const directory = directories.find((name) => {
          const output = path.join(os.tmpdir(), name, "stdout.json");
          try {
            const stat = fs.statSync(output);
            const opened = fs.fstatSync(descriptor);
            return stat.dev === opened.dev && stat.ino === opened.ino;
          } catch {
            return false;
          }
        });
        assert.ok(directory);
        captures.push({
          descriptor,
          directory: path.join(os.tmpdir(), directory),
        });
        let text: string;
        if (args[0] === "env") text = "{}";
        else if (args.includes("-m")) text = '{"Path":"example.test/no-gomod"}';
        else
          text =
            JSON.stringify({
              Dir: root,
              GoFiles: ["first.go"],
              Doc: "x".repeat(2 ** 20),
            }) +
            "\n" +
            JSON.stringify({ Dir: root, GoFiles: ["last.go"] });
        execFileSync(
          process.execPath,
          [
            "-e",
            "const fs=require('node:fs');fs.writeFileSync(1,fs.readFileSync(0));process.exit(Number(process.argv[1]));",
            fail ? "7" : "0",
          ],
          { ...options, input: text, stdio: ["pipe", descriptor, "inherit"] },
        );
      };
      const options = {
        buildArguments: ["go", "build"],
        cwd: root,
        dependencyPackages: ["./..."],
        environment: {},
        extraFiles: [],
        inputDirectories: [],
        execFileSync: command,
      };
      const initial = createInputIdentity(options);
      assert.ok(
        initial.payload.inputs.some((input: any) => input.path === "first.go"),
      );
      assert.ok(
        initial.payload.inputs.some((input: any) => input.path === "last.go"),
      );
      fs.writeFileSync(path.join(root, "last.go"), "package changed\n");
      assert.notEqual(createInputIdentity(options).hash, initial.hash);
      fail = true;
      assert.throws(
        () => createInputIdentity(options),
        (error: any) => error.status === 7,
      );
      assert.equal(captures.length, 7);
      for (const capture of captures) {
        assert.equal(fs.existsSync(capture.directory), false);
        assert.throws(
          () => fs.fstatSync(capture.descriptor),
          (error: any) => error.code === "EBADF",
        );
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
