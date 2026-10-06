import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { BatchWorkspace } from "./BatchWorkspace";
import type { createLoaderPoolWorker } from "./LoaderPoolWorker";

/** Shared authored descriptor inputs and actual resident protocol assertions. */
export namespace MetroResidentBoundary {
  /**
   * Create the existing descriptor failure, mixed lint and runtime-input
   * population.
   *
   * @evidence contracts/testing.md#behavioral-verification Create the existing descriptor failure, mixed lint and runtime-input population.
   * @evidence contracts/testing.md#independent-expectations Literal fixture modules and original byte snapshots define the expected selection and recovery states.
   * @evidence contracts/testing.md#distinguishing-cases Fresh owned directory admission, typed/MJS changes, JSON contributor logging and runtime resolution populations retain distinct authored inputs.
   * @evidence contracts/testing.md#execution-ownership This maintained helper is called by the original full Metro callback and the separate local-only resident diagnostic entry; it starts no compiler or worker itself.
   * @evidence contracts/e2e.md#necessary-boundary The descriptor failures and runtime import/config population must be authored before the resident runs; generating the same bytes for both consumers prevents a local synthetic descriptor from passing the real loader differently.
   * @evidence contracts/e2e.md#shared-execution File copies and original config hashes are setup costs. One created population serves all failure, mixed-lint and runtime-input commands in the chosen resident; this operation creates no compiler or extra subprocess.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The freshly absent descriptor-process-flow directory owns all generated children and byte snapshots. The enclosing consumer must join its worker before restoring or removing this population.
   * @evidence contracts/e2e.md#preserved-coverage The helper retains every original descriptor/lint/runtime authored input; full Metro still independently owns prior public API/cache/control scenarios, and the local subset cannot certify them.
   */
  export function createDescriptorInputs(
    workspace: BatchWorkspace.Workspace,
    nativeSource: string,
    publicSource: string,
  ) {
    const descriptorFailureRoot = path.join(
      workspace.root,
      "descriptor-process-flow",
    );
    assert.equal(fs.existsSync(descriptorFailureRoot), false);
    fs.cpSync(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "tests/test-e2e/fixtures/ttsc/descriptor-process-corpus",
      ),
      descriptorFailureRoot,
      { recursive: true },
    );
    const lintDescriptorRoot = path.join(descriptorFailureRoot, "lint-flow");
    fs.cpSync(
      path.join(workspace.root, "descriptors/lint-flow"),
      lintDescriptorRoot,
      { recursive: true },
    );
    const lintAlpha = nativeSource;
    const lintBeta = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/lint/plugin",
    );
    for (const filename of [
      "typed-selection.ts",
      "module-selection.mjs",
      "logging-contributor.cjs",
    ]) {
      const file = path.join(lintDescriptorRoot, filename);
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replace('"__LINT_ALPHA_SOURCE__"', JSON.stringify(lintAlpha)),
      );
    }
    const loggingPackage = path.join(
      lintDescriptorRoot,
      "node_modules/logging-contributor",
    );
    fs.mkdirSync(loggingPackage, { recursive: true });
    fs.writeFileSync(
      path.join(loggingPackage, "package.json"),
      '{"main":"index.cjs"}\n',
    );
    fs.copyFileSync(
      path.join(lintDescriptorRoot, "logging-contributor.cjs"),
      path.join(loggingPackage, "index.cjs"),
    );
    fs.writeFileSync(
      path.join(lintDescriptorRoot, "lint.config.json"),
      JSON.stringify({ plugins: { demo: "logging-contributor" } }),
    );
    const lintDescriptorBytes = new Map(
      ["lint.config.ts", "typed-selection.ts", "module-selection.mjs"].map(
        (name) => [
          path.join(lintDescriptorRoot, name),
          fs.readFileSync(path.join(lintDescriptorRoot, name)),
        ],
      ),
    );
    const descriptorRuntimeRoot = path.join(
      descriptorFailureRoot,
      "runtime-inputs",
    );
    const runtimeDescriptor = path.join(descriptorRuntimeRoot, "descriptor");
    const runtimeDescriptorConfig = path.join(
      runtimeDescriptor,
      "tsconfig.json",
    );
    const runtimeSelection = path.join(runtimeDescriptor, "selection.mjs");
    const runtimeNear = path.join(descriptorRuntimeRoot, "near/node_modules");
    const runtimeFar = path.join(descriptorRuntimeRoot, "far/node_modules");
    const runtimeProbe = path.join(runtimeFar, "descriptor-probe");
    const runtimeOrphan = path.join(
      descriptorRuntimeRoot,
      "orphan/node_modules/orphan-source",
    );
    const runtimeRefresh = path.join(
      descriptorRuntimeRoot,
      "refresh/node_modules/config-refresh",
    );
    for (const directory of [
      runtimeDescriptor,
      path.join(runtimeNear, "descriptor-probe"),
      runtimeProbe,
      runtimeOrphan,
      runtimeRefresh,
    ])
      fs.mkdirSync(directory, { recursive: true });
    for (const directory of [runtimeDescriptor, runtimeOrphan, runtimeRefresh])
      fs.writeFileSync(
        path.join(directory, "package.json"),
        '{"private":true,"type":"module"}\n',
      );
    fs.writeFileSync(
      runtimeDescriptorConfig,
      JSON.stringify({
        compilerOptions: {
          allowJs: true,
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
          target: "es2022",
        },
        include: ["*.ts", "*.mjs"],
      }),
    );
    fs.writeFileSync(
      runtimeSelection,
      `export const source = ${JSON.stringify(publicSource)};\n`,
    );
    fs.writeFileSync(
      path.join(runtimeDescriptor, "explicit.tsx"),
      'export const explicit = "explicit";\n',
    );
    fs.writeFileSync(
      path.join(runtimeProbe, "package.json"),
      '{"main":"entry"}\n',
    );
    fs.writeFileSync(path.join(runtimeProbe, "entry.json"), '"probe"\n');
    fs.writeFileSync(
      path.join(runtimeOrphan, "selection.ts"),
      'export const orphan = "orphan";\n',
    );
    const runtimeRefreshConfig = path.join(runtimeRefresh, "tsconfig.json");
    fs.writeFileSync(
      path.join(runtimeRefresh, "selection.tsx"),
      'function factory() { return "configured"; }\nexport const value = <probe />;\n',
    );
    fs.writeFileSync(
      path.join(runtimeRefresh, "seed.ts"),
      [
        'import { writeFileSync } from "node:fs";',
        'import { createRequire } from "node:module";',
        `writeFileSync(${JSON.stringify(runtimeRefreshConfig)}, ${JSON.stringify(JSON.stringify({ compilerOptions: { jsx: "react", jsxFactory: "factory", module: "nodenext", moduleResolution: "nodenext", target: "es2022" }, include: ["*.ts", "*.tsx"] }))});`,
        'export const seed = "seed";',
        'export const { value } = createRequire(import.meta.url)("./selection.tsx");',
        "",
      ].join("\n"),
    );
    const runtimeDescriptorEntry = path.join(runtimeDescriptor, "index.ts");
    fs.writeFileSync(
      runtimeDescriptorEntry,
      [
        'import { createRequire } from "node:module";',
        'import { source } from "./selection";',
        'import { explicit } from "./explicit.js?descriptor-input";',
        `import { orphan } from ${JSON.stringify(pathToFileURL(path.join(runtimeOrphan, "selection.ts")).href)};`,
        `import { seed, value } from ${JSON.stringify(pathToFileURL(path.join(runtimeRefresh, "seed.ts")).href)};`,
        "const require = createRequire(import.meta.url);",
        'if (require("descriptor-probe") !== "probe" || orphan !== "orphan" || explicit !== "explicit") throw new Error("descriptor probe failed");',
        'if (seed !== "seed" || value !== "configured") throw new Error("descriptor config refresh failed");',
        'export default () => ({ name: "ttsx-inputs", source, capabilities: { projectContextArgs: true } });',
        "",
      ].join("\n"),
    );
    const runtimeInputConfig = path.join(
      descriptorRuntimeRoot,
      "tsconfig.json",
    );
    fs.writeFileSync(
      runtimeInputConfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: runtimeDescriptorEntry }] },
      }),
    );
    const runtimeDescriptorConfigHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(runtimeDescriptorConfig))
      .digest("hex");
    return {
      descriptorFailureRoot,
      lintDescriptorRoot,
      lintAlpha,
      lintBeta,
      lintDescriptorBytes,
      runtimeInputConfig,
      runtimeNear,
      runtimeFar,
      runtimeSelection,
      runtimeDescriptor,
      runtimeOrphan,
      runtimeRefresh,
      runtimeDescriptorConfig,
      runtimeDescriptorConfigHash,
      runtimeProbe,
      runtimeRefreshConfig,
    };
  }

  /**
   * Observe public native preparation and two graph-proof captures through the
   * same resident.
   *
   * @evidence contracts/testing.md#behavioral-verification Observe public native preparation and two graph-proof captures through the same resident.
   * @evidence contracts/testing.md#independent-expectations The Program log must not advance during public prepare; the actual graph helper independently expects two native captures, served authored output and unchanged declaration bytes.
   * @evidence contracts/testing.md#distinguishing-cases Preparation failure/child closure and the intentional first external declaration refusal remain errors or rejected generations, never fabricated readiness or proof.
   * @evidence contracts/testing.md#execution-ownership The caller supplies its pre-start Program tick and owns this worker; one additional prepare call precedes the unchanged 120-second graph delivery.
   * @evidence contracts/e2e.md#necessary-boundary A real public native prepare result and resident graph command distinguish installation readiness from native Program/proof publication; helper-returned expected binaries cannot replace either.
   * @evidence contracts/e2e.md#shared-execution The same resident installs the sources once before its graph command. Capture reload/admission is still real additional work, and graph proof still owns two native captures rather than an extra warmup transform.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The supplied worker owns the readiness promise and terminal close. Its fresh graph publication namespace refuses first-capture reuse and reset schedules disposal without certifying backend closure.
   * @evidence contracts/e2e.md#preserved-coverage The original two-Program refusal/served-source/unchanged-declaration assertions remain in the real graph helper; full Metro retains separate initial-adapter sharing and later repair/restart scopes.
   */
  export async function observeGraphProof(
    worker: ReturnType<typeof createLoaderPoolWorker>,
    workspace: BatchWorkspace.Workspace,
    beforePreparation: number,
    publicApiFailures: unknown[],
  ): Promise<void> {
    const preparation = await worker.ready;
    assert.ok(
      preparation,
      "the first resident owns native installation readiness",
    );
    assert.ok(
      preparation.binaries.length > 0,
      "public prepare returned actual native binaries",
    );
    assert.equal(
      fs.existsSync(workspace.programRunLog)
        ? fs.statSync(workspace.programRunLog).size
        : 0,
      beforePreparation,
      "native preparation does not acquire a Program",
    );
    console.log("Resident native preparation", JSON.stringify(preparation));
    const graphProof = await worker.request("", undefined, undefined, {
      api: TestUnpluginRuntime.libUrl("api"),
      session: path.join(
        workspace.cache,
        "graph-proof-refusal",
        path.basename(workspace.root),
      ),
      programRunLog: workspace.programRunLog,
    });
    try {
      assert.equal(graphProof.error, undefined, graphProof.error);
      assert.deepEqual(graphProof.value, {
        proofRead: true,
        nativePrograms: 2,
        served: true,
      });
    } catch (error) {
      publicApiFailures.push(
        new Error("outside-walk graph proof publication refusal", {
          cause: error,
        }),
      );
    }
  }

  /**
   * Assert descriptorFlow and runtime-input replies from their actual existing
   * worker invocations.
   *
   * @evidence contracts/testing.md#behavioral-verification Assert descriptorFlow and runtime-input replies from their actual existing worker invocations.
   * @evidence contracts/testing.md#independent-expectations Literal failure reasons, contributor names, immutable original modules, runtime resolved paths and independently hashed original config bytes define the oracles.
   * @evidence contracts/testing.md#distinguishing-cases Counterfeit/missing/body/context errors, helper-only selection changes, namespace collision, failed config logs and evaluation-time absent input proof retain their separate assertions.
   * @evidence contracts/testing.md#execution-ownership Both consumers submit these same two descriptorFlow protocol commands; no direct private evaluator substitutes for the resident reply.
   * @evidence contracts/e2e.md#necessary-boundary Actual descriptorFlow line responses bind contributor choices, errors and observed runtime input paths to the same native loader invocation; ordinary normalization units cannot certify that transport.
   * @evidence contracts/e2e.md#shared-execution One resident handles the original mixed-lint command and runtime-input command against the shared authored population. Typed helper edits perform real evaluator work rather than zero-cost fixture transitions.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The command retains original typed/MJS input snapshots and requires the child to restore them. Runtime-created configs remain unproved where evaluation observed their absence; caller-owned worker close bounds cleanup.
   * @evidence contracts/e2e.md#preserved-coverage All original descriptor reason rows, contributor tuples, collisions, failed logs and runtime discovery/config-absence assertions are moved intact to this function; unrelated full-pool transitions remain selected separately.
   */
  export async function observeDescriptors(
    worker: ReturnType<typeof createLoaderPoolWorker>,
    workspace: BatchWorkspace.Workspace,
    inputs: ReturnType<typeof createDescriptorInputs>,
    publicApiFailures: unknown[],
  ): Promise<void> {
    const {
      descriptorFailureRoot,
      lintDescriptorRoot,
      lintAlpha,
      lintBeta,
      lintDescriptorBytes,
      runtimeInputConfig,
      runtimeNear,
      runtimeFar,
      runtimeSelection,
      runtimeDescriptor,
      runtimeOrphan,
      runtimeRefresh,
      runtimeDescriptorConfig,
      runtimeDescriptorConfigHash,
      runtimeProbe,
      runtimeRefreshConfig,
    } = inputs;
    const descriptorReply = await worker.request("", undefined, {
      root: descriptorFailureRoot,
      api: path.join(
        TestProject.WORKSPACE_ROOT,
        "packages/ttsc/lib/plugin/internal/load/loadProjectPlugins.js",
      ),
      binary: TestProject.NATIVE_BINARY,
      tsgo: TestProject.TSGO_BINARY,
      lint: {
        root: lintDescriptorRoot,
        factory: path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/lint/lib/index.js",
        ),
        ttsx: TestProject.TTSX_BIN,
        alpha: lintAlpha,
        beta: lintBeta,
      },
    });
    assert.equal(descriptorReply.error, undefined);
    const descriptorRecords = descriptorReply.value as {
      name: string;
      failed: boolean;
      message?: string;
      contributors?: { name: string; source: string }[];
    }[];
    assert.deepEqual(
      descriptorRecords.map((record) => record.name),
      [
        "factory",
        "module",
        "counterfeit",
        "counterfeit-missing",
        "mutated-missing",
        "late-candidate-race",
        "directory-candidate-race",
        "context",
        "body",
        "lint-initial",
        "lint-module-edit",
        "lint-typed-edit",
        "lint-typed-collision",
        "lint-typed-failure",
        "lint-json-log",
      ],
    );
    for (const [name, contributors] of [
      ["lint-initial", [{ name: "alpha", source: lintAlpha }]],
      [
        "lint-module-edit",
        [
          { name: "beta", source: lintBeta },
          { name: "alpha", source: lintAlpha },
        ],
      ],
      ["lint-typed-edit", [{ name: "beta", source: lintBeta }]],
      ["lint-json-log", [{ name: "demo", source: lintAlpha }]],
    ] as const) {
      const observed = descriptorRecords.find((row) => row.name === name);
      assert.equal(observed?.failed, false, name + ": " + observed?.message);
      assert.deepEqual(
        observed?.contributors,
        contributors,
        "actual helper-only re-evaluation and JSON package selection: " + name,
      );
    }
    const lintCollision = descriptorRecords.find(
      (row) => row.name === "lint-typed-collision",
    );
    assert.equal(lintCollision?.failed, true);
    assert.equal(lintCollision?.contributors, undefined);
    assert.ok(
      lintCollision?.message?.includes(
        path.join(lintDescriptorRoot, "lint.config.ts"),
      ),
    );
    assert.match(
      lintCollision?.message ?? "",
      /"react-hooks", "react_hooks" all normalize to "react_hooks"/,
    );
    assert.match(
      lintCollision?.message ?? "",
      /contributor namespaces collide/,
    );
    const lintFailure = descriptorRecords.find(
      (row) => row.name === "lint-typed-failure",
    );
    assert.equal(lintFailure?.failed, true);
    assert.equal(
      lintFailure?.contributors,
      undefined,
      "failed typed evaluation must not publish contributor JSON",
    );
    assert.match(lintFailure?.message ?? "", /intentional config failure/);
    assert.match(
      lintFailure?.message ?? "",
      /evaluation failed with exit code/,
    );
    for (const [file, bytes] of lintDescriptorBytes)
      assert.deepEqual(
        fs.readFileSync(file),
        bytes,
        "the retained worker restores its typed/MJS config epoch before adapter admission",
      );
    assert.equal(
      fs.existsSync(path.join(descriptorFailureRoot, "forbidden-fallback.txt")),
      false,
    );
    for (const [name, reason] of [
      ["factory", /factory-env:effective/],
      ["module", /module-initialization:loaded/],
      ["counterfeit", /user-assigned loader code/],
      ["counterfeit-missing", /Cannot find module '\.\/phantom'/],
      ["mutated-missing", /Cannot find module '\.\/phantom'/],
      ["late-candidate-race", /Cannot find module '\.\/late-candidate'/],
      [
        "directory-candidate-race",
        /Cannot find module '\.\/directory-candidate'/,
      ],
      ["context", /absent-context-only/],
      ["body", /failed with exit code 1\ndescriptor-module-body-failed/],
    ] as const) {
      try {
        const record = descriptorRecords.find((entry) => entry.name === name);
        assert.equal(record?.failed, true);
        assert.match(record?.message ?? "", reason);
        if (name !== "context" && name !== "body")
          assert.equal(
            fs.readFileSync(
              path.join(descriptorFailureRoot, name + "-runs.txt"),
              "utf8",
            ),
            "run\n",
          );
      } catch (cause) {
        publicApiFailures.push(
          new Error("descriptor failure state: " + name, { cause }),
        );
      }
    }
    assert.equal(
      fs.readFileSync(
        path.join(descriptorFailureRoot, "late-candidate.ts"),
        "utf8",
      ),
      "export const value = 1;\n",
    );
    assert.equal(
      fs
        .statSync(path.join(descriptorFailureRoot, "directory-candidate.ts"))
        .isDirectory(),
      true,
    );
    const runtimeInputReply = await worker.request("", undefined, {
      root: descriptorFailureRoot,
      api: path.join(
        TestProject.WORKSPACE_ROOT,
        "packages/ttsc/lib/plugin/internal/load/loadProjectPlugins.js",
      ),
      binary: TestProject.NATIVE_BINARY,
      tsgo: TestProject.TSGO_BINARY,
      runtimeInputs: {
        config: runtimeInputConfig,
        cache: path.join(workspace.cache, "descriptor-runtime-inputs"),
        nodePath: [runtimeNear, runtimeFar].join(path.delimiter),
      },
    });
    assert.equal(runtimeInputReply.error, undefined);
    const runtimeInputs = runtimeInputReply.value as {
      hostInputs: string[];
      hostInputHashes: Record<string, string | null>;
    };
    const canonicalRuntimeSelection = fs.realpathSync(runtimeSelection);
    assert.equal(
      runtimeInputs.hostInputs.includes(canonicalRuntimeSelection),
      true,
    );
    const sameRuntimeFile = (left: string, right: string): boolean => {
      try {
        const a = fs.statSync(left),
          b = fs.statSync(right);
        return a.ino === 0 || b.ino === 0
          ? fs.realpathSync(left) === fs.realpathSync(right)
          : a.dev === b.dev && a.ino === b.ino;
      } catch {
        return false;
      }
    };
    assert.equal(
      runtimeInputs.hostInputs.some((input) =>
        sameRuntimeFile(input, runtimeDescriptorConfig),
      ),
      true,
    );
    for (const absent of [
      canonicalRuntimeSelection.slice(
        0,
        -path.extname(canonicalRuntimeSelection).length,
      ) + ".mts",
      path.join(runtimeDescriptor, "explicit.ts"),
    ]) {
      assert.equal(
        runtimeInputs.hostInputs.includes(absent),
        true,
        JSON.stringify(runtimeInputs),
      );
      assert.equal(runtimeInputs.hostInputHashes[absent], null);
    }
    for (const [directory, basename] of [
      [runtimeProbe, "entry.js"],
      [runtimeOrphan, "tsconfig.json"],
    ] as const) {
      const absent = runtimeInputs.hostInputs.find(
        (input) =>
          path.basename(input) === basename &&
          sameRuntimeFile(path.dirname(input), directory),
      );
      assert.ok(absent, JSON.stringify(runtimeInputs));
      assert.equal(runtimeInputs.hostInputHashes[absent], null);
    }
    const appearedConfig = runtimeInputs.hostInputs.find((input) =>
      sameRuntimeFile(input, runtimeRefreshConfig),
    );
    assert.ok(appearedConfig, JSON.stringify(runtimeInputs));
    assert.equal(
      Object.hasOwn(runtimeInputs.hostInputHashes, appearedConfig),
      false,
      "a config created during evaluation remains unproved",
    );
    assert.equal(
      Object.entries(runtimeInputs.hostInputHashes).some(
        ([input, hash]) =>
          hash === runtimeDescriptorConfigHash &&
          sameRuntimeFile(input, runtimeDescriptorConfig),
      ),
      true,
    );
  }

  /**
   * Check the joined resident stderr markers for real descriptor and mixed lint
   * evaluations.
   *
   * @evidence contracts/testing.md#behavioral-verification Check the joined resident stderr markers for real descriptor and mixed lint evaluations.
   * @evidence contracts/testing.md#independent-expectations Literal marker text and exact three healthy or one package/failure log counts distinguish forwarding from synthesized records.
   * @evidence contracts/testing.md#distinguishing-cases Actual stdout routing, ambient-env rejection and joined stderr must retain every original positive and negative log marker.
   * @evidence contracts/testing.md#execution-ownership The caller joins worker close and then invokes this same assertion owner on full and local paths; a blocked body still exposes missing markers.
   * @evidence contracts/e2e.md#necessary-boundary Joined real stderr must retain the original descriptor stdout-forwarding marker and lint evaluator/package/failure logs; matching normalized reply data alone cannot prove channel routing.
   * @evidence contracts/e2e.md#shared-execution The assertion consumes the existing resident stderr once after its same graph/descriptor commands. It starts no logger, evaluator or new worker to recreate a missing marker.
   * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The caller joins the worker before comparing exact log counts. When an earlier delivery blocks descriptor execution, a missing marker remains a propagated failure rather than an exemption.
   * @evidence contracts/e2e.md#preserved-coverage Full and local callers retain the original exact three healthy log repetitions and one package/failure repetition, alongside the negative ambient-context marker.
   */
  export function assertDiagnostics(
    worker: ReturnType<typeof createLoaderPoolWorker>,
  ): void {
    assert.match(worker.diagnostics(), /DESCRIPTOR_STDOUT_MARKER loaded/);
    assert.equal(
      /factory-env:ambient|absent-ambient/.test(worker.diagnostics()),
      false,
    );
    const lintStderr = worker.diagnostics();
    for (const marker of [
      "loading executable lint config",
      "executable lint config warning",
      "loading mjs lint config",
    ])
      assert.equal(
        lintStderr.split(marker).length - 1,
        3,
        "each changed healthy graph retains its real evaluator log: " + marker,
      );
    for (const marker of [
      "loading JSON contributor",
      "JSON contributor warning",
      "failed config stdout",
      "failed config stderr",
    ])
      assert.equal(
        lintStderr.split(marker).length - 1,
        1,
        "real package/failure logs survive only on the joined stderr channel: " +
          marker,
      );
  }
  /**
   * Select the existing six adapter roots and declaration-checking policy.
   *
   * @evidence contracts/testing.md#behavioral-verification The full and local consumers give their actual compiler config these same six roots and skipLibCheck=false before native installation or capture.
   * @evidence contracts/testing.md#independent-expectations Authored bundle/map/console/metadata/membership roots retain their existing consumer roles; imported declarations remain real native inputs.
   * @evidence contracts/testing.md#distinguishing-cases Runtime-only wasm/playground roots retain separate owners and are not silently added to this adapter Program; no contributor or plugin declaration is removed.
   * @evidence contracts/testing.md#execution-ownership Both real resident callers borrow this config mutation before their existing config write; this helper starts no compiler and proves no resulting output by itself.
   */
  export function selectAdapterProgram(config: {
    include?: string[];
    compilerOptions: { skipLibCheck?: boolean };
  }): void {
    config.include = [
      "src/bundle.ts",
      "src/map.ts",
      "src/pool-routing/map.ts",
      "src/console.d.ts",
      "src/metadata-population.ts",
      "src/pooled-membership.d.ts",
    ];
    config.compilerOptions.skipLibCheck = false;
  }
}
