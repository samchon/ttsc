import assert from "node:assert/strict";
import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SourceNativeRetirement } from "../../../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { GoSourceInputs } from "../../../../../../../packages/ttsc/src/plugin/internal/source/GoSourceInputs";
import { SourcePackageArtifacts } from "../../../../../../../packages/ttsc/src/plugin/internal/source/SourcePackageArtifacts";

/**
 * Verifies a cold selector chooses only a graph-matching admitted pack.
 *
 * 1. Create three authenticated candidate packs, admitting only the package in a
 *    real tiny Go module.
 * 2. Ask the source selector to prepare the module and execute stock Go with its
 *    selected cache program.
 * 3. Check disabled, caller-owned cache program, untrusted manifest and
 *    CGO-enabled fallbacks.
 *
 * @evidence contracts/testing.md#behavioral-verification The production selector probes a shipped native helper and stock Go package graph, prepares one already admitted body, and passes its actual GOCACHEPROG to a successful Go build.
 * @evidence contracts/testing.md#independent-expectations The authored module import path selects the shared candidate, while an unrelated package path must remain absent; an externally computed SHA-256 authenticates the manifest, and explicit caller controls prescribe fallback.
 * @evidence contracts/testing.md#distinguishing-cases Matching, unrelated and same-path/different-module-role packs distinguish graph selection; disabled backend, caller program precedence, digest mismatch and CGO=1 preserve separate decisions without network access.
 * @evidence contracts/testing.md#execution-ownership This E2E entry owns a private module/cache/manifest tree and uses prebuilt host-platform Go and helper executables. Synchronous children settle before the owned tree is deleted.
 * @evidence contracts/e2e.md#necessary-boundary A direct unit call cannot establish that the prebuilt helper, Go tuple query, package graph, preparation mode and stock Go client agree across process boundaries.
 * @evidence contracts/e2e.md#shared-execution One prebuilt helper and tiny module serve all choices; no duplicate product host or per-case native build is started.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The temporary module and artifact root are owned by this entry, the inherited environment is copied for each decision, and all child processes join before recursive cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The entry adds a new selector connection and changes no existing scenario or assertion.
 */
export function test_source_package_artifacts_selects_only_matching_admitted_packs(): void {
  const repository = path.resolve(import.meta.dirname, "../../../../../../..");
  const target = `${process.platform}-${process.arch}`;
  const platform = path.join(repository, "packages", `ttsc-${target}`, "bin");
  const suffix = process.platform === "win32" ? ".exe" : "";
  const helper = path.join(platform, `ttsc-cache${suffix}`);
  const goBinary = path.join(platform, "go", "bin", `go${suffix}`);
  assert.ok(
    fs.statSync(helper).isFile(),
    "platform package must ship a native cache helper",
  );
  assert.ok(
    fs.statSync(goBinary).isFile(),
    "platform package must ship the selected Go compiler",
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-package-selector-"));
  try {
    const module = path.join(root, "source with spaces");
    fs.mkdirSync(module);
    fs.writeFileSync(
      path.join(module, "go.mod"),
      "module example.org/ttsc-package-selector\n\ngo 1.26\n",
    );
    fs.writeFileSync(
      path.join(module, "tiny.go"),
      'package tiny\nfunc Value() string { return "selected" }\n',
    );
    const sha = (bytes: Buffer | string): string =>
      crypto.createHash("sha256").update(bytes).digest("hex");
    const body = Buffer.from("publisher body for selector");
    const unrelated = Buffer.from("unrelated publisher body");
    const variant = Buffer.from("same package path in another module role");
    const artifacts = path.join(root, "package artifacts");
    const manifestPath = path.join(root, "manifest.json");
    const sharedPackSHA = "c".repeat(64);
    const otherPackSHA = "d".repeat(64);
    const variantPackSHA = "e".repeat(64);
    const admitted = path.join(
      artifacts,
      "base",
      "packs",
      `shared-${sharedPackSHA}`,
    );
    fs.mkdirSync(path.join(admitted, "bodies"), { recursive: true });
    fs.writeFileSync(path.join(admitted, ".complete"), `${sharedPackSHA}\n`);
    fs.writeFileSync(path.join(admitted, "bodies", sha(body)), body);
    const env = GoSourceInputs.goBuildEnv(goBinary, undefined, {
      ...process.env,
      CGO_ENABLED: "0",
      GOFLAGS: "",
      TTSC_PACKAGE_ARTIFACTS: "1",
      TTSC_PACKAGE_ARTIFACT_HELPER: helper,
      TTSC_PACKAGE_ARTIFACT_MANIFEST: manifestPath,
    });
    const tuple = JSON.parse(
      cp.execFileSync(helper, ["-tuple", "-go", goBinary], {
        env,
        encoding: "utf8",
      }),
    );
    const action = (
      actionID: string,
      output: Buffer,
      pack: string,
      packagePath: string,
    ) => ({
      actionID,
      outputID: sha(output),
      bodySHA256: sha(output),
      bodyLength: output.length,
      pack,
      kind: "archive",
      packagePath,
      modulePath: packagePath,
      moduleVersion: "",
      moduleRole: "main",
      selectedSourceSHA256: "e".repeat(64),
      commandSHA256: "f".repeat(64),
      directInputs: [],
    });
    const manifest = {
      schema: 1,
      release: "0.32.1",
      sourceCommit: "a".repeat(40),
      tuple,
      graphSHA256: "b".repeat(64),
      packs: [
        {
          name: "shared",
          url: "https://example.org/shared.zip",
          sha256: sharedPackSHA,
          length: 100,
          decodedBytes: body.length,
          fileCount: 1,
        },
        {
          name: "other",
          url: "https://example.org/other.zip",
          sha256: otherPackSHA,
          length: 100,
          decodedBytes: unrelated.length,
          fileCount: 1,
        },
        {
          name: "variant",
          url: "https://example.org/variant.zip",
          sha256: variantPackSHA,
          length: 100,
          decodedBytes: variant.length,
          fileCount: 1,
        },
      ],
      actions: [
        action(
          "1".repeat(64),
          body,
          "shared",
          "example.org/ttsc-package-selector",
        ),
        action("2".repeat(64), unrelated, "other", "example.org/unrelated"),
        {
          ...action(
            "3".repeat(64),
            variant,
            "variant",
            "example.org/ttsc-package-selector",
          ),
          moduleRole: "dependency",
          moduleVersion: "v1.2.3",
        },
      ],
    };
    const raw = JSON.stringify(manifest);
    fs.writeFileSync(manifestPath, raw);
    env.TTSC_PACKAGE_ARTIFACT_SHA256 = sha(raw);
    const choose = (effective: NodeJS.ProcessEnv) =>
      SourceNativeRetirement.run(
        SourceNativeRetirement.createScope("package-selector-e2e"),
        () =>
          SourcePackageArtifacts.prepare({
            artifactRoot: artifacts,
            cwd: module,
            entry: ".",
            env: effective,
            goBinary,
            pluginName: "tiny",
            ttscVersion: "0.32.1",
          }),
      );
    const selected = choose(env);
    assert.equal(selected.reason, "selected");
    assert.deepEqual(selected.receipt?.selectedPacks, ["shared"]);
    assert.equal(selected.receipt?.requests, 0);
    assert.ok(selected.env.GOCACHEPROG?.includes(helper));
    const built = path.join(root, "tiny.a");
    cp.execFileSync(goBinary, ["build", "-trimpath", "-o", built, "."], {
      cwd: module,
      env: {
        ...selected.env,
        GOCACHE: path.join(root, "empty go cache"),
        GOPROXY: "off",
        GOTOOLCHAIN: "local",
      },
      stdio: "pipe",
    });
    assert.ok(fs.statSync(built).size > 0);
    assert.ok(selected.usageReceiptPath);
    const usage = JSON.parse(
      fs.readFileSync(selected.usageReceiptPath, "utf8"),
    ) as {
      gets: number;
      baseHits: number;
      misses: number;
      puts: number;
    };
    assert.ok(usage.gets > 0 && usage.misses > 0 && usage.puts > 0);
    assert.equal(
      usage.baseHits,
      0,
      "the authored selector body has no matching real Go action",
    );
    SourcePackageArtifacts.reportUsage(selected, "tiny", true);
    assert.equal(fs.existsSync(selected.usageReceiptPath), false);
    assert.equal(
      choose({ ...env, TTSC_PACKAGE_ARTIFACTS: "0" }).reason,
      "disabled",
    );
    assert.equal(
      choose({ ...env, GOCACHEPROG: "caller helper" }).reason,
      "caller-gocacheprog",
    );
    assert.equal(
      choose({ ...env, TTSC_PACKAGE_ARTIFACT_SHA256: "0".repeat(64) }).reason,
      "manifest-untrusted",
    );
    const cgo = { ...env, CGO_ENABLED: "1" };
    assert.equal(choose(cgo).reason, "go-tuple-unsupported");
    assert.equal(cgo.CGO_ENABLED, "1");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
