import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { sanitizeBenchmarkEnvironment } from "../../../../../../benchmarks/evidence/src/sanitizeBenchmarkEnvironment";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { EvidenceProcessOwnership } from "../../../../../utils/src/evidence/EvidenceProcessOwnership";
import type { CompilerArchives } from "../../../batch/CompilerArchives";
import { BackendActivation } from "../../../internal/evidence/BackendActivation";

/**
 * Verifies all staged backend claims demand their generated populations.
 *
 * An installed package reference may silently lose SDK accessors while its
 * Markdown reference still produces errors. The real benchmark materializer,
 * Prisma generator and SDK generator supply the populations this case observes.
 * This is an ordinary feature test, with no coding engine or measured cell.
 *
 * 1. Compile the preparation API once, prepare one workspace and generate its SDK.
 * 2. Require disabled owners to compile before removing any staged marker.
 * 3. Unlock each instruction-owned claim against unacknowledged host inputs.
 * 4. Require named obligations, delivered requirements and published accessors.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual preparation installs packed compiler/lint/unplugin/platform/Evidence artifacts; real owner scripts must pass disabled and fail enabled with named obligations, no empty reference and all generated package accessors.
 * @evidence contracts/testing.md#independent-expectations Unlock order comes from the delivered backend instruction, hosts from static probe inputs, requirement documents from delivered headings and accessor addresses from the real SDK generator's tags, independently of Evidence diagnostics.
 * @evidence contracts/testing.md#distinguishing-cases Disabled positive controls separate broken generation from activation; every enabled claim must owe something, and installed-package claims must owe SDK accessors even when their Markdown reference already reports obligations.
 * @evidence contracts/testing.md#execution-ownership test_e2e_evidence_batch invokes this selected case; an explicit native build applies the benchmark's typia transform, then ordinary Node calls the actual emitted workspace API. This case judges each owning package script without launching a benchmark campaign.
 * @evidence contracts/e2e.md#necessary-boundary The pnpm workspace links, real Prisma/SDK generation and compiler-owned claim populations are the connection previously exercised by test_benchmark_evidence_backend_gates_activate_each_claim; in-process decoded-config tests cannot establish these installed populations.
 * @evidence contracts/e2e.md#shared-execution One native preparation build, generated workspace, installation and plugin cache serve both positive owners and all five staged transitions. The preparation build is necessary because typia's executable host supports explicit builds but not ttsx's required emit-provenance protocol. Its emitted modules link the benchmark's existing dependencies; no dependency install is added for preparation. Optional caller-owned archives avoid repacking when a frozen common set exists.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Generated preparation modules, logs, workspace and native scratch/cache roots belong to one allocation. Its dependency directory link targets the benchmark's existing installation without writing there; recursive cleanup removes the link rather than its target. The run-owned immutable compiler archive generation is physically/content-qualified before preparation and rechecked after its actual child returns; that borrower ends before generation uses the independently installed packages. Unknown closure while borrowing retains both owners. Earlier workspace layers remain intentionally enabled according to the instruction DAG. A null status, signal or spawn error retains inputs and blocks subsequent writes; normal returned results establish only direct command completion. The Windows path-keyed store is admitted only if absent before preparation and removed only after normal completion.
 * @evidence contracts/e2e.md#preserved-coverage Restores the deleted ordinary backend walk's per-claim activation, nonempty-reference, delivered-document and all-published-accessor assertions; adds disabled success controls and per-row failure collection. Other deleted benchmark feature cases and measured campaigns are outside this scenario.
 */
export async function case_evidence_backend_claims_activate_after_generation(
  artifacts?: {
    toolchain: { name: string; archive: string }[];
    artifact: { name: string; archive: string };
  },
  compilerArchives?: CompilerArchives.Owner,
): Promise<{ observations: unknown[]; passedClaims: string[] }> {
  const repository = TestProject.WORKSPACE_ROOT;
  const root = TestProject.tmpdir("ttsc-backend-activation-");
  const rootIdentity = fs.statSync(root, { bigint: true });
  const rootNativePath = fs.realpathSync.native(root);
  const fixture = path.resolve(
    import.meta.dirname,
    "../../../../fixtures/evidence/backend-activation",
  );
  const workspace = path.join(root, "prepared/workspace");
  const logs = path.join(root, "logs");
  fs.mkdirSync(logs);
  const cache = path.join(root, "plugin-cache");
  const environment: NodeJS.ProcessEnv = {
    ...sanitizeBenchmarkEnvironment(process.env),
    TTSC_CACHE_DIR: cache,
    GOCACHE: path.join(root, "go-cache"),
    GOTMPDIR: path.join(root, "go-tmp"),
  };
  for (const name of Object.keys(environment))
    if (
      name.startsWith("npm_package_") ||
      name.startsWith("npm_lifecycle_") ||
      name.toUpperCase() === "INIT_CWD"
    )
      delete environment[name];
  fs.mkdirSync(environment.GOTMPDIR!);
  let borrowed: CompilerArchives.Borrow | undefined;
  const ownership = EvidenceProcessOwnership.create((reason) => {
    TestProject.retainTemporaryDirectory(root, reason);
    borrowed?.retain(reason);
  });
  ownership.registerCache(root, cache);
  const virtualStore =
    process.platform === "win32"
      ? path.join(
          path.parse(workspace).root,
          ".ttsc-vstore",
          crypto
            .createHash("sha256")
            .update(workspace.toLowerCase())
            .digest("hex")
            .slice(0, 12),
        )
      : undefined;
  if (virtualStore)
    assert.equal(
      fs.existsSync(virtualStore),
      false,
      "A test must not adopt an existing virtual store",
    );
  const failures: unknown[] = [];
  const observations: unknown[] = [];
  const passedClaims: string[] = [];
  let sequence = 0;
  const run = (cwd: string, arguments_: string[], label: string) => {
    ownership.assertAvailable(root);
    const prefix = path.join(logs, `${++sequence}-${label}`);
    let stdout: number | undefined;
    let stderr: number | undefined;
    let result;
    const started = Date.now();
    try {
      stdout = fs.openSync(prefix + ".stdout", "wx");
      stderr = fs.openSync(prefix + ".stderr", "wx");
      result = E2eProcessTrace.spawnSync(process.execPath, arguments_, {
        cwd,
        env: environment,
        stdio: ["ignore", stdout, stderr],
        windowsHide: true,
        timeout: 1_800_000,
      });
    } catch (error) {
      ownership.retain(root, error);
      throw error;
    } finally {
      if (stdout !== undefined) fs.closeSync(stdout);
      if (stderr !== undefined) fs.closeSync(stderr);
    }
    const stdoutText = fs.readFileSync(prefix + ".stdout", "utf8");
    const stderrText = fs.readFileSync(prefix + ".stderr", "utf8");
    const output = stdoutText + stderrText;
    observations.push({
      label,
      cwd,
      arguments: arguments_,
      status: result.status,
      signal: result.signal,
      error: result.error && String(result.error),
      elapsedMs: Date.now() - started,
      stdout: stdoutText,
      stderr: stderrText,
      output,
    });
    fs.writeFileSync(
      path.join(logs, "observations.json"),
      JSON.stringify(observations, null, 2),
    );
    if (result.error || result.status === null || result.signal !== null)
      ownership.retain(
        root,
        result.error ?? new Error("Unknown child closure: " + label),
      );
    assert.equal(result.error, undefined, output);
    assert.equal(result.signal, null, output);
    assert.notEqual(result.status, null, output);
    return { status: result.status, output };
  };
  const script = (directory: string, name: string, label: string) => {
    assert.ok(
      process.env.npm_execpath,
      "The E2E runner must be launched through pnpm",
    );
    return run(directory, [process.env.npm_execpath, "run", name], label);
  };
  try {
    if (!artifacts && compilerArchives) borrowed = compilerArchives.borrow();
    const preparation = path.join(root, "preparation");
    const compiled = run(
      path.join(repository, "benchmarks/evidence"),
      [
        path.join(repository, "packages/ttsc/lib/launcher/ttsc.js"),
        "--project",
        path.join(repository, "benchmarks/evidence/tsconfig.json"),
        "--noEmit",
        "false",
        "--outDir",
        preparation,
        "--declaration",
        "false",
        "--sourceMap",
        "false",
      ],
      "build-preparation",
    );
    assert.equal(compiled.status, 0, compiled.output);
    // The emitted CommonJS modules resolve their existing dependencies through
    // this owned directory link. Node ignores the junction type on POSIX.
    fs.symlinkSync(
      path.join(repository, "benchmarks/evidence/node_modules"),
      path.join(preparation, "node_modules"),
      "junction",
    );
    const request = path.join(root, "request.json");
    const result = path.join(root, "prepared.json");
    fs.writeFileSync(
      request,
      JSON.stringify({
        repository,
        root,
        result,
        preparation,
        ...artifacts,
        borrowedCompilerArchives: borrowed?.artifacts,
      }),
    );
    const prepared = run(
      repository,
      [path.join(fixture, "prepare.cjs"), request],
      "prepare",
    );
    assert.equal(prepared.status, 0, prepared.output);
    for (const artifact of borrowed?.artifacts ?? []) {
      const delivered = path.join(
        workspace,
        ".benchmark-deps",
        path.basename(artifact.archive),
      );
      const started = performance.now();
      const hash = crypto.createHash("sha256");
      let bytes = 0;
      for await (const chunk of fs.createReadStream(delivered)) {
        bytes += chunk.length;
        hash.update(chunk);
      }
      const sha256 = hash.digest("hex");
      assert.equal(sha256, artifact.sha256, artifact.name + " delivered bytes");
      assert.notEqual(
        fs.realpathSync.native(delivered),
        artifact.physical,
        "Backend preparation must own its distinct archive delivery",
      );
      observations.push({
        borrowedCompilerArchive: artifact.name,
        archive: artifact.archive,
        delivered,
        sha256,
        streamedBytes: bytes,
        elapsedMs: performance.now() - started,
      });
    }
    borrowed?.assertAvailable();
    borrowed?.release();
    borrowed = undefined;
    assert.equal(
      JSON.parse(fs.readFileSync(result, "utf8")).workspace,
      workspace,
    );
    const backend = path.join(workspace, "packages/backend");
    fs.copyFileSync(
      path.join(backend, ".env.example"),
      path.join(backend, ".env"),
    );
    for (const name of ["build:prisma", "build:sdk"]) {
      const built = script(backend, name, name.replace(":", "-"));
      assert.equal(built.status, 0, built.output);
    }
    const instruction = fs.readFileSync(
      path.join(workspace, ".agents/skills/evidence/backend.md"),
      "utf8",
    );
    const claims = BackendActivation.claims(workspace, instruction);
    const published = BackendActivation.accessors(
      path.join(workspace, "packages/api/src/functional"),
    );
    const requirements = BackendActivation.requirements(workspace);
    observations.push({
      claims: claims.map((claim) => ({
        ...claim,
        disabledConfiguration: fs.readFileSync(claim.file, "utf8"),
      })),
      expectedPublishedAccessors: published,
      expectedRequirementDocuments: requirements,
      instruction,
    });
    BackendActivation.stripCitations(path.join(backend, "test/features"));
    const owners = new Map(
      claims.map((claim) => [claim.directory + "\0" + claim.script, claim]),
    );
    for (const owner of owners.values()) {
      try {
        const disabled = script(
          owner.directory,
          owner.script,
          "disabled-" +
            path.basename(owner.directory) +
            "-" +
            owner.script.replace(":", "-"),
        );
        assert.equal(disabled.status, 0, disabled.output);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const claim of claims) {
      try {
        ownership.assertAvailable(root);
        if (claim.name === "schema-models")
          fs.appendFileSync(
            path.join(backend, "prisma/schema/main.prisma"),
            "\n" + fs.readFileSync(path.join(fixture, "probe.prisma"), "utf8"),
          );
        else if (
          claim.name === "dto-types" ||
          claim.name === "dto-properties"
        ) {
          const structures = path.join(
            workspace,
            "packages/api/src/structures",
          );
          fs.copyFileSync(
            path.join(fixture, "IBenchmarkProbe.ts"),
            path.join(structures, "IBenchmarkProbe.ts"),
          );
          const barrel = path.join(structures, "index.ts");
          if (!fs.readFileSync(barrel, "utf8").includes("./IBenchmarkProbe"))
            fs.appendFileSync(barrel, '\nexport * from "./IBenchmarkProbe";\n');
        } else
          assert.ok(
            ["api-operations", "backend-tests"].includes(claim.name),
            "Missing host layer for " + claim.name,
          );
        BackendActivation.unlock(claim);
        const hostLayer =
          claim.name === "schema-models"
            ? path.join(backend, "prisma/schema/main.prisma")
            : claim.name === "dto-types" || claim.name === "dto-properties"
              ? path.join(
                  workspace,
                  "packages/api/src/structures/IBenchmarkProbe.ts",
                )
              : claim.name === "api-operations"
                ? path.join(backend, "src/controllers/HealthController.ts")
                : path.join(
                    backend,
                    "test/features/api/health/test_api_health.ts",
                  );
        observations.push({
          claim: claim.name,
          configuration: claim.file,
          enabledConfiguration: fs.readFileSync(claim.file, "utf8"),
          hostLayer,
          hostSource: fs.readFileSync(hostLayer, "utf8"),
          expectedPublishedAccessors: claim.throughPackage ? published : [],
        });
        const prisma = script(backend, "build:prisma", claim.name + "-prisma");
        assert.equal(prisma.status, 0, prisma.output);
        const activated = script(claim.directory, claim.script, claim.name);
        assert.notEqual(activated.status, 0, activated.output);
        const obligations = BackendActivation.obligations(
          activated.output,
          claim.name,
        );
        const targets = new Set(
          obligations.map((obligation) => obligation.target),
        );
        const documents = [...targets]
          .map((target) => target.split("#")[0]!)
          .filter((target) => target.endsWith(".md"));
        if (documents.length) {
          for (const document of requirements)
            assert.ok(
              documents.some(
                (target) =>
                  target === document ||
                  target.endsWith("/" + path.posix.basename(document)),
              ),
              claim.name + " did not reach " + document,
            );
          for (const document of documents)
            assert.ok(
              requirements.some((target) =>
                document.endsWith(path.posix.basename(target)),
              ),
              "Undelivered requirement " + document,
            );
        }
        if (claim.throughPackage)
          for (const accessor of published)
            assert.ok(
              targets.has(accessor),
              claim.name + " did not demand generated accessor " + accessor,
            );
        passedClaims.push(claim.name);
      } catch (error) {
        failures.push(
          new Error("Backend activation claim " + claim.name, { cause: error }),
        );
      }
    }
  } catch (error) {
    failures.push(error);
  }
  try {
    ownership.assertAvailable(root);
    borrowed?.assertAvailable();
    borrowed?.release();
    if (virtualStore && fs.existsSync(virtualStore)) {
      assert.equal(
        fs.realpathSync.native(virtualStore),
        path.join(
          fs.realpathSync.native(path.dirname(virtualStore)),
          path.basename(virtualStore),
        ),
      );
      assert.equal(fs.lstatSync(virtualStore).isSymbolicLink(), false);
      fs.rmSync(virtualStore, { recursive: true, force: true });
      assert.equal(fs.existsSync(virtualStore), false);
    }
    assert.equal(fs.realpathSync.native(root), rootNativePath);
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    const currentIdentity = fs.statSync(root, { bigint: true });
    assert.equal(currentIdentity.dev, rootIdentity.dev);
    assert.equal(currentIdentity.ino, rootIdentity.ino);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  } catch (error) {
    failures.push(error);
    ownership.retain(root, error);
  }
  if (failures.length) {
    throw new AggregateError(failures, "Backend staged activation failures", {
      cause: observations,
    });
  }
  return { observations, passedClaims };
}
