import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { buildSourcePlugin } from "../../../../../packages/ttsc/src/plugin/internal/source/buildSourcePlugin";
import { resolveSourceBuildCachePaths } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies cancellation before cache admission and after scratch output.
 *
 * The package-owned static Go inputs are copied into isolated workspace roots;
 * an explicit command relay produces metadata and output without running Go.
 *
 * 1. Cancel while fingerprint bytes are read and after scratch output is written.
 * 2. Verify no cancelled publication, digest admission or active lease survives.
 * 3. Publish and reuse one live control, then join every heartbeat retirement.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes buildSourcePlugin with real source/SDK files, key computation, scratch copies, lock retirement and publication. Cancellation from an actual SDK byte read admits no cache binary; cancellation after authored scratch output removes scratch and prevents final publication. A live control publishes and reuses its binary with only one build invocation.
 * @evidence contracts/testing.md#independent-expectations Cancellation withdraws publication authority, so no final binary or active key generation may remain, and caller digest maps receive no cancelled result. The literal output marker and build counter distinguish successful publication/reuse from a hidden second build; no expected cache key is derived from production.
 * @evidence contracts/testing.md#distinguishing-cases Pre-admission fingerprint cancellation, cancellation with an existing scratch output and live publication followed by reuse cover both late boundaries and recovery. This source unit supplies authored metadata/output through the explicit synchronous command relay; it does not certify Go compilation, native containment or actual cold MCP behavior.
 * @evidence contracts/testing.md#execution-ownership Three private roots own authored source/toolchain inputs and actual cache/lock effects. The relay writes captured metadata and a marker instead of launching Go; actual heartbeat retirement promises are awaited in finally before examining owned paths. Cases collect failures independently. Real installed compiler/MCP integration remains the E2E owner's separate validation.
 */
export async function test_buildsourceplugin_cancellation_refuses_late_artifact_admission(): Promise<void> {
  const failures: unknown[] = [];
  for (const stage of ["fingerprint", "compiled", "live"] as const) {
    try {
      const root = TestProject.tmpdir(`ttsc-source-cancel-${stage}-`);
      // A real workspace boundary gives each case its own managed default
      // cache instead of inheriting an existing installation above os.tmpdir.
      TestProject.copyDirectory(
        path.resolve(
          import.meta.dirname,
          "../../../../../packages/ttsc/testdata/source-cancellation",
        ),
        root,
      );
      const source = path.join(root, "source");
      const sdk = path.join(root, "sdk");
      const go = path.join(
        sdk,
        "bin",
        process.platform === "win32" ? "go.exe" : "go",
      );
      fs.mkdirSync(path.dirname(go), { recursive: true });
      fs.copyFileSync(path.join(root, "tool-input"), go);
      fs.chmodSync(go, 0o755);
      const cancel = new SharedArrayBuffer(4);
      const retirements = new Set<Promise<unknown>>();
      const sourceDigests = new Map<string, string>();
      const env = {
        ...process.env,
        TTSC_GO_BINARY: go,
        TTSC_CACHE_DIR: undefined,
        TTSC_GO_CACHE_DIR: undefined,
        GOCACHE: undefined,
        GOROOT: sdk,
        GOENV: "off",
        GOTOOLCHAIN: "local",
        CGO_ENABLED: "0",
      };
      let reads = 0;
      let builds = 0;
      let scratch: string | undefined;
      const scope: OwnedSynchronousProcess.Scope = {
        cancel,
        retirements,
        launch: (_command, args, options) => {
          let stdout = "";
          if (args[0] === "version")
            stdout = "go version go1.26.0 authored/unit\n";
          else if (args[0] === "env")
            stdout = JSON.stringify({
              GOROOT: sdk,
              GOENV: "off",
              GOTOOLCHAIN: "local",
              CGO_ENABLED: "0",
            });
          else if (args[0] === "mod")
            stdout = JSON.stringify({
              Module: { Path: "example.com/cancellation" },
            });
          else if (args[0] === "build") {
            builds += 1;
            assert.ok(typeof options.cwd === "string");
            scratch = options.cwd;
            const output = args[args.indexOf("-o") + 1];
            assert.ok(output);
            fs.writeFileSync(
              path.join(scratch, output),
              "authored output marker",
            );
            if (stage === "compiled")
              Atomics.store(new Int32Array(cancel), 0, 1);
          } else assert.equal(args[0], "work");
          assert.ok(Array.isArray(options.stdio));
          const stdoutFd = options.stdio[1];
          assert.ok(typeof stdoutFd === "number");
          fs.writeSync(stdoutFd, stdout);
          return {
            pid: 0,
            status: 0,
            signal: null,
            output: [null, Buffer.alloc(0), Buffer.alloc(0)],
            stdout: Buffer.alloc(0),
            stderr: Buffer.alloc(0),
          };
        },
      };
      const build = (): string => buildSourcePlugin({
        source,
        baseDir: root,
        pluginName: "cancellation",
        overlayDirs: [],
        quiet: true,
        env,
        sourceDigests,
        filesystem: {
          readFile: (file) => {
            const bytes = fs.readFileSync(file);
            reads += 1;
            if (stage === "fingerprint")
              Atomics.store(new Int32Array(cancel), 0, 1);
            return bytes;
          },
        },
        ttscVersion: "unit",
        tsgoVersion: "unit",
      });
      try {
        if (stage === "live") {
          const binary = OwnedSynchronousProcess.run(scope, build);
          assert.equal(fs.readFileSync(binary, "utf8"), "authored output marker");
          assert.equal(OwnedSynchronousProcess.run(scope, build), binary);
          assert.equal(builds, 1);
        } else {
          assert.throws(() => OwnedSynchronousProcess.run(scope, build), {
            name: "AbortError",
          });
          assert.equal(sourceDigests.size, 0);
          assert.equal(builds, stage === "compiled" ? 1 : 0);
          if (stage === "fingerprint") assert.ok(reads > 0);
        }
      } finally {
        const settled = await Promise.allSettled(retirements);
        assert.deepEqual(
          settled.filter((result) => result.status === "rejected"),
          [],
        );
      }
      if (scratch !== undefined) assert.equal(fs.existsSync(scratch), false);
      const paths = resolveSourceBuildCachePaths(root, undefined, env);
      if (fs.existsSync(paths.pluginRoot)) {
        const entries = fs.readdirSync(paths.pluginRoot, {
          recursive: true,
          encoding: "utf8",
        });
        assert.equal(
          entries.some((entry) => entry.split(path.sep).includes("current")),
          false,
        );
        if (stage !== "live")
          assert.equal(
            entries.some((entry) => /^plugin(?:\.exe)?$/.test(path.basename(entry))),
            false,
          );
      }
    } catch (error) {
      failures.push(new Error(stage, { cause: error }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "Source cancellation cases failed");
}
