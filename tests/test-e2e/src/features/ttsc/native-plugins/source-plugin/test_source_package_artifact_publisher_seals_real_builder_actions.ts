import { TestProject } from "@ttsc/testing";
import { spawn as spawnProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { CompilerTarget } from "../../../../../../../packages/ttsc/lib/plugin/internal/source/CompilerTarget.js";
import {
  assert,
  copyProject,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies that a source build records and seals Go's actual package actions.
 *
 * 1. Copy the maintained native plugin project and build it with explicit
 *    publisher authority.
 * 2. Require its original emitted behavior and a sealed pack produced before the
 *    scratch source retires.
 * 3. Serve its pack over loopback, then compare an independent consumer's cold,
 *    warm and edited output with actual Go hit receipts, HTTP requests and
 *    process attempts.
 *
 * Packs cover 7.0 builds only: a 7.1 build carries the target tag in GOFLAGS.
 * On a TypeScript 7.1 workspace the publisher build must instead refuse to seal
 * and fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the real ttsc CLI, stock Go source builder, recording helper and release sealer, then downloads the sealed pack into an independent consumer and observes exact JS, actual helper hit/miss counters, HTTP requests and warm-launch process attempts.
 * @evidence contracts/testing.md#independent-expectations The fixture's authored uppercase transform requires PLUGIN; the unchanged consumer must emit the producer's exact bytes, while editing its Go branch must yield [PLUGIN]. The workspace's declared ttsc package version supplies the expected release independently of the sealed pack. Go's recorded full action keys must be complete and include the fixture module.
 * @evidence contracts/testing.md#distinguishing-cases Cold publisher, independent downloaded consumer, warm exact executable with no helper or Go build startup, and changed Go plugin source distinguish package reuse from ordinary fallback or a stale binary. A 7.1 workspace distinguishes the refused seal from a silently unsealed success.
 * @evidence contracts/testing.md#execution-ownership This discoverable E2E entry copies one maintained fixture, uses the prebuilt host-platform helper and SDK, and joins the CLI before the test harness reclaims its tracked root.
 * @evidence contracts/e2e.md#necessary-boundary Direct parser or helper tests cannot prove receipts came from ttsc's actual materialized source workspace before its cleanup.
 * @evidence contracts/e2e.md#shared-execution One cold publisher build supplies output, actiongraph, receipts and sealed pack; one independent consumer downloads the pack, then runs warm and edited cases against the admitted bodies.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Copied publisher and consumer projects have separate plugin, Go object and artifact roots; only package-source provenance is shared. Each synchronous CLI closes before assertions or mutation, and the harness owns both tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage This adds a publisher path without dropping any existing source-plugin corpus case.
 */
export function test_source_package_artifact_publisher_seals_real_builder_actions(): void {
  const root = copyProject("go-source-plugin");
  const recordDir = path.join(root, "publisher records");
  const target = `${process.platform}-${process.arch}`;
  const platform = path.join(
    workspaceRoot,
    "packages",
    `ttsc-${target}`,
    "bin",
  );
  const suffix = process.platform === "win32" ? ".exe" : "";
  const helper = path.join(platform, `ttsc-cache${suffix}`);
  const goBinary = path.join(platform, "go", "bin", `go${suffix}`);
  assert.ok(fs.statSync(helper).isFile());
  assert.ok(fs.statSync(goBinary).isFile());
  const transport = path.join(root, "transport");
  const ready = path.join(root, "transport-port");
  const requests = path.join(transport, "requests");
  fs.mkdirSync(transport);
  const server = spawnProcess(
    process.execPath,
    [
      "-e",
      `
    const fs = require("node:fs");
    const http = require("node:http");
    const path = require("node:path");
    const root = process.argv[1];
    const ready = process.argv[2];
    const requests = process.argv[3];
    let requestCount = 0;
    fs.writeFileSync(requests, "0");
    http.createServer((request, response) => {
      fs.writeFileSync(requests, String(++requestCount));
      const name = new URL(request.url, "http://localhost").pathname.slice(1);
      if (!/^[a-z0-9-]+-[0-9a-f]{64}\\.zip$/.test(name)) {
        response.writeHead(404).end();
        return;
      }
      const stream = fs.createReadStream(path.join(root, name));
      stream.on("error", () => response.writeHead(404).end());
      stream.pipe(response);
    }).listen(0, "127.0.0.1", function () {
      fs.writeFileSync(ready, String(this.address().port));
    });
  `,
      transport,
      ready,
      requests,
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  try {
    const pause = new Int32Array(new SharedArrayBuffer(4));
    for (let attempt = 0; !fs.existsSync(ready) && attempt < 250; attempt++)
      Atomics.wait(pause, 0, 0, 20);
    assert.ok(fs.existsSync(ready), "local pack server must start");
    const packURLBase = `http://127.0.0.1:${fs.readFileSync(ready, "utf8")}`;
    const sourceCommit = "a".repeat(40);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        CGO_ENABLED: "0",
        GOFLAGS: "",
        GOCACHEPROG: "",
        TTSC_GO_BINARY: goBinary,
        TTSC_PACKAGE_ARTIFACT_HELPER: helper,
        TTSC_PACKAGE_ARTIFACT_RECORD_DIR: recordDir,
        TTSC_PACKAGE_ARTIFACT_SOURCE_COMMIT: sourceCommit,
        TTSC_PACKAGE_ARTIFACT_PACK_URL_BASE: packURLBase,
        TTSC_PACKAGE_ARTIFACT_PACK_NAME: "fixture",
        TTSC_CACHE_DIR: path.join(root, "cache"),
        TTSC_GO_CACHE_DIR: path.join(root, "go-objects"),
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    const typescript = (
      createRequire(path.join(workspaceRoot, "package.json"))(
        "typescript/package.json",
      ) as { version: string }
    ).version;
    if (CompilerTarget.lineOf(typescript).line !== "7.0") {
      assert.notEqual(result.status, 0, result.stderr);
      assert.match(
        result.stderr,
        /publisher artifacts require effective CGO_ENABLED=0 and no GOFLAGS/,
      );
      return;
    }
    assert.equal(result.status, 0, result.stderr);
    const publisherOutput = fs.readFileSync(path.join(root, "dist", "main.js"));
    assert.match(publisherOutput.toString("utf8"), /"PLUGIN"/);
    const directories = fs.readdirSync(recordDir);
    assert.equal(directories.length, 1);
    const recorded = path.join(recordDir, directories[0]!);
    const manifestPath = path.join(recorded, "sealed", "manifest.json");
    const raw = fs.readFileSync(manifestPath);
    const digest = crypto.createHash("sha256").update(raw).digest("hex");
    assert.match(result.stderr, new RegExp(`manifest SHA-256 ${digest}`));
    const manifest = JSON.parse(raw.toString("utf8")) as {
      release: string;
      sourceCommit: string;
      packs: {
        sha256: string;
        length: number;
        decodedBytes: number;
        fileCount: number;
      }[];
      actions: { actionID: string; outputID: string; packagePath: string }[];
    };
    assert.equal(manifest.sourceCommit, sourceCommit);
    const packageManifest = JSON.parse(
      fs.readFileSync(
        path.join(workspaceRoot, "packages", "ttsc", "package.json"),
        "utf8",
      ),
    ) as { version?: unknown };
    assert.equal(typeof packageManifest.version, "string");
    assert.equal(manifest.release, packageManifest.version);
    assert.equal(manifest.packs.length, 1);
    assert.ok(manifest.actions.length > 0);
    assert.ok(
      manifest.actions.some((action) =>
        action.packagePath.includes("go-source-plugin"),
      ),
    );
    assert.ok(
      manifest.actions.every(
        (action) =>
          /^[0-9a-f]{64}$/.test(action.actionID) &&
          /^[0-9a-f]{64}$/.test(action.outputID),
      ),
    );
    const pack = manifest.packs[0]!;
    const packPath = path.join(
      recorded,
      "sealed",
      `fixture-${pack.sha256}.zip`,
    );
    assert.equal(fs.statSync(packPath).size, pack.length);
    assert.ok(pack.decodedBytes > pack.length && pack.fileCount > 0);
    fs.copyFileSync(packPath, path.join(transport, path.basename(packPath)));
    const consumer = copyProject("go-source-plugin");
    const consumerCache = path.join(consumer, "cache");
    const consumerEnv = {
      CGO_ENABLED: "0",
      GOFLAGS: "",
      GOCACHEPROG: "",
      TTSC_GO_BINARY: goBinary,
      TTSC_PACKAGE_ARTIFACT_HELPER: helper,
      TTSC_PACKAGE_ARTIFACTS: "1",
      TTSC_PACKAGE_ARTIFACT_MANIFEST: manifestPath,
      TTSC_PACKAGE_ARTIFACT_SHA256: digest,
      TTSC_CACHE_DIR: consumerCache,
      TTSC_GO_CACHE_DIR: path.join(consumer, "go-objects"),
    };
    const runConsumer = (trace?: string) =>
      spawn(ttscBin, ["--cwd", consumer, "--emit"], {
        cwd: consumer,
        env:
          trace === undefined
            ? consumerEnv
            : { ...consumerEnv, TTSC_E2E_TRACE: trace },
      });
    const cold = runConsumer();
    assert.equal(cold.error, undefined);
    assert.equal(cold.signal, null);
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(
      fs.readFileSync(path.join(consumer, "dist", "main.js")),
      publisherOutput,
    );
    assert.match(
      cold.stderr,
      /package artifacts prepared 1 pack\(s\), 1 downloaded/,
    );
    const hits =
      /package artifacts: (\d+) publisher hits, (\d+) local hits, (\d+) misses/.exec(
        cold.stderr,
      );
    assert.ok(hits, cold.stderr);
    assert.ok(
      Number(hits[1]) > 0,
      "consumer must hit actual published Go actions",
    );
    const coldRequests = Number(fs.readFileSync(requests, "utf8"));
    assert.ok(coldRequests > 0, "cold consumer must fetch its pack");
    fs.unlinkSync(path.join(consumer, "dist", "main.js"));
    const warmTrace = TestProject.tmpdir("ttsc-artifact-warm-");
    const warm = runConsumer(warmTrace);
    assert.equal(warm.status, 0, warm.stderr);
    assert.doesNotMatch(
      warm.stderr,
      /building source plugin|package artifacts/,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(consumer, "dist", "main.js")),
      publisherOutput,
    );
    assert.equal(Number(fs.readFileSync(requests, "utf8")), coldRequests);
    const warmAttempts = readTrace(warmTrace)
      .filter((event) => event.event === "process-attempt")
      .map((event) => event.argv ?? []);
    assert.deepEqual(
      warmAttempts.filter((argv) => {
        const name = path.basename(argv[0] ?? "");
        return (
          /^ttsc-cache(?:\.exe)?$/i.test(name) ||
          (/^go(?:\.exe)?$/i.test(name) &&
            ["build", "list", "work"].includes(argv[1] ?? ""))
        );
      }),
      [],
      "warm exact executable must start neither a Go build nor the artifact helper",
    );
    const goFile = path.join(consumer, "go-plugin", "main.go");
    const original = fs.readFileSync(goFile, "utf8");
    const changed = original.replace(
      /(case "go-uppercase":\n)(\s*)value = strings\.ToUpper\(value\)/,
      `$1$2value = "[" + strings.ToUpper(value) + "]"`,
    );
    assert.notEqual(changed, original);
    fs.writeFileSync(goFile, changed);
    const edited = runConsumer();
    assert.equal(edited.status, 0, edited.stderr);
    assert.match(
      edited.stderr,
      /package artifacts prepared 1 pack\(s\), 0 downloaded/,
    );
    assert.match(edited.stderr, /package artifacts: [1-9]\d* publisher hits/);
    assert.match(
      fs.readFileSync(path.join(consumer, "dist", "main.js"), "utf8"),
      /"\[PLUGIN\]"/,
    );
    assert.equal(Number(fs.readFileSync(requests, "utf8")), coldRequests);
  } finally {
    server.kill();
  }
}

interface ITraceEvent {
  event: string;
  argv?: string[];
}

function readTrace(directory: string): ITraceEvent[] {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(directory, name), "utf8")
        .split("\n")
        .filter((line) => line.length !== 0)
        .map((line) => JSON.parse(line) as ITraceEvent),
    );
}
