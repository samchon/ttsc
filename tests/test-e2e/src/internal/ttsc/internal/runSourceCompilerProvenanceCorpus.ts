import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EmitOwnershipIndex } from "../../../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { runBuild } from "../../../../../../packages/ttsc/src/compiler/internal/build/runBuild";
import { runSingleFileEmit } from "../../../../../../packages/ttsc/src/compiler/internal/runSingleFileEmit";

/**
 * Verifies source-internal emission and provenance on the caller's compiler
 * root.
 *
 * Five genuinely different JSX modes each emit the authored TypeScript and
 * JavaScript JSX sources together. Two positional emitter calls additionally
 * consume react-native ownership through the same source-internal SDK. This
 * child uses the source unit loader because the ordinary E2E loader cannot
 * initialize the SDK's CommonJS recorder path constants. It receives the
 * already tracked compiler workspace; it allocates no project or installation.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source runBuild invokes the selected native producer. Each mode requires successful emission, the two literal writer suffixes and marker/layout text, actual emittedSources associations, and unique EmitOwnershipIndex lookup. The declaration input must have no JavaScript owner. Two actual runSingleFileEmit calls return the distinct react-native JSX markers and restore their private output lifetimes.
 * @evidence contracts/testing.md#independent-expectations Authored JSX markers and mode semantics specify outputs before emission: preserve writes JSX suffixes; react-native retains JSX in JavaScript suffixes; react lowers createElement; automatic modes name their respective runtime modules. Exact expected source/output coordinates do not come from filename prediction or returned provenance. The declaration-only input independently has no JavaScript writer.
 * @evidence contracts/testing.md#distinguishing-cases Both tsx and jsx inputs coexist in every Program. Last JSX occurrence and response-file selection distinguish effective modes. React-native's retained JSX contrasts with preserve's suffix and react's lowering. A declaration has no owner; native ambiguity and full public CLI admission remain separate and are not certified here.
 * @evidence contracts/testing.md#execution-ownership One child calls this export through the source unit loader and runs five synchronous runBuild and two synchronous runSingleFileEmit operations. It collects every independently runnable case before throwing the aggregate. These seven owning emit operations do not claim seven underlying native processes or Programs; configuration and provenance observations also belong to the real producer path.
 * @evidence contracts/e2e.md#necessary-boundary Native-written JavaScript must connect through source BuildExecution and the source external-provenance adapter's emittedSources relation to actual ownership lookup and positional return. Portable enum and synthetic ledger units cannot establish this connection. This source-artifact boundary does not certify the installed launcher or installed Windows watch population.
 * @evidence contracts/e2e.md#shared-execution All modes and positional calls share the caller's canonical project and selected executable in one child. Different effective JSX modes genuinely change emitted syntax or suffix; both source languages share each producing invocation. Two positional calls cover the consumer operation for each source language rather than repeating all five modes through that operation. No contributor build or dependency installation is performed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Static inputs live outside the baseline src include. lstat ENOENT alone establishes lexical absence, so dangling links cannot be acquired as missing inputs. Exclusive writes are recorded only after success; release checks regular-file identity and the authored bytes. Each mode receives an empty owned regular output directory; cleanup refuses replaced links. Exact config bytes are restored and only successfully staged inputs/output directories are removed in finally. Configured noEmit, declaration, maps and incremental products are explicitly disabled for this provenance phase. Actual synchronous operations finish before cleanup; SDK positional temporary directories remain the SDK's responsibility.
 * @evidence contracts/e2e.md#preserved-coverage The five-mode two-language producer matrix and react-native positional connection add real source-artifact evidence. The source unit owns enum/probe admission cases. Installed watch failures, public CLI forwarding, native alias ambiguity, outside-fileset diagnostics and POSIX transport stay with their original owners until independently verified; this helper does not remove or weaken them.
 */
export function runSourceCompilerProvenanceCorpus(
  suppliedRoot: string,
  binary: string,
): void {
  const root = fs.realpathSync.native(suppliedRoot);
  assert.equal(fs.statSync(binary).isFile(), true);
  const configPath = path.join(root, "tsconfig.json");
  const baseline = fs.readFileSync(configPath);
  const inputs = path.join(root, "provenance-inputs");
  const emitDir = path.join(root, ".source-provenance-output");
  const staged = [
    ["view.tsx", "src/provenance-view.tsx"],
    ["peer.jsx", "src/provenance-peer.jsx"],
    ["env.d.ts", "src/provenance-env.d.ts"],
    ["react.rsp", "provenance-react.rsp"],
    ["auto.rsp", "provenance-auto.rsp"],
  ] as const;
  const created: Array<{ filename: string; bytes: Buffer }> = [];
  let ownsEmitDir = false;
  let sourceOwnershipProved = true;
  const inputEntryAbsent = (filename: string): boolean => {
    try {
      fs.lstatSync(filename);
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      throw error;
    }
  };
  const failures: Error[] = [];
  const receipts: Array<{ name: string; passed: boolean; error?: string }> = [];
  assert.equal(
    inputEntryAbsent(emitDir),
    true,
    "owned output must start absent",
  );
  for (const [, destination] of staged)
    assert.equal(
      inputEntryAbsent(path.join(root, destination)),
      true,
      `owned input must start absent: ${destination}`,
    );
  const observe = (name: string, action: () => void): void => {
    try {
      action();
      receipts.push({ name, passed: true });
    } catch (cause) {
      failures.push(new Error(name, { cause }));
      receipts.push({
        name,
        passed: false,
        error:
          cause instanceof Error
            ? (cause.stack ?? cause.message)
            : String(cause),
      });
    }
  };
  const select = (): void => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          allowJs: true,
          checkJs: true,
          noEmit: false,
          declaration: false,
          declarationMap: false,
          emitDeclarationOnly: false,
          sourceMap: false,
          incremental: false,
          composite: false,
          rootDir: "src",
          outDir: ".source-provenance-output",
        },
        files: [
          "src/provenance-view.tsx",
          "src/provenance-peer.jsx",
          "src/provenance-env.d.ts",
        ],
        include: [],
      }),
    );
  };
  try {
    for (const [source, destination] of staged) {
      const target = path.join(root, destination);
      const bytes = fs.readFileSync(path.join(inputs, source));
      fs.writeFileSync(target, bytes, { flag: "wx" });
      created.push({ filename: target, bytes });
    }
    const sources = [
      ["src/provenance-view.tsx", "provenance-view", "tsx-owned"],
      ["src/provenance-peer.jsx", "provenance-peer", "jsx-owned"],
    ] as const;
    for (const [mode, argv, extension, layout] of [
      ["preserve", ["--jsx", "react", "--jsx", "preserve"], "jsx", "retained"],
      ["react", ["@provenance-react.rsp"], "js", "classic"],
      ["react-native", ["--JsX", "react-native"], "js", "retained"],
      [
        "react-jsx",
        ["--jsx", "react", "@provenance-auto.rsp"],
        "js",
        "automatic",
      ],
      [
        "react-jsxdev",
        ["--jsx", "react-jsx", "--jsx", "react-jsxdev"],
        "js",
        "development",
      ],
    ] as const) {
      if (!sourceOwnershipProved) break;
      observe(`source native producer / ${mode}`, () => {
        try {
          if (ownsEmitDir) {
            assert.equal(fs.lstatSync(emitDir).isDirectory(), true);
            fs.rmSync(emitDir, { recursive: true, force: true });
            ownsEmitDir = false;
          }
          assert.equal(inputEntryAbsent(emitDir), true);
          fs.mkdirSync(emitDir);
          ownsEmitDir = true;
          select();
        } catch (error) {
          sourceOwnershipProved = false;
          throw error;
        }
        const result = runBuild({
          cwd: root,
          tsconfig: configPath,
          binary,
          plugins: false,
          emit: true,
          forceEmitProvenance: true,
          isolateOutputsTo: emitDir,
          outDir: emitDir,
          passthrough: argv,
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.notEqual(result.emittedSources, undefined);
        const outputFiles = EmitOwnershipIndex.listOutputs(emitDir);
        assert.deepEqual([...outputFiles].sort(), [
          `provenance-peer.${extension}`,
          `provenance-view.${extension}`,
        ]);
        const index = new EmitOwnershipIndex({
          emitDir,
          rootDir: path.join(root, "src"),
          outputs: outputFiles,
          emittedSources: result.emittedSources,
          emittedSourceProofFailures: result.emittedSourceProofFailures,
        });
        for (const [source, stem, marker] of sources) {
          const physicalSource = fs.realpathSync.native(
            path.join(root, source),
          );
          const expectedOutput = path.join(emitDir, `${stem}.${extension}`);
          assert.equal(
            index.find(physicalSource),
            fs.realpathSync.native(expectedOutput),
          );
          const ownerEntries = Object.entries(
            result.emittedSources ?? {},
          ).filter(
            ([writer]) =>
              fs.realpathSync.native(writer) ===
              fs.realpathSync.native(expectedOutput),
          );
          assert.equal(ownerEntries.length, 1);
          assert.deepEqual(ownerEntries[0]![1], [physicalSource]);
          const text = fs.readFileSync(expectedOutput, "utf8");
          assert.equal(text.includes(marker), true);
          if (layout === "retained") assert.match(text, /<div>/);
          if (layout === "classic") {
            assert.match(text, /React\.createElement/);
            assert.doesNotMatch(text, /<div>/);
          }
          if (layout === "automatic") {
            assert.match(text, /react\/jsx-runtime/);
            assert.doesNotMatch(text, /react\/jsx-dev-runtime|<div>/);
          }
          if (layout === "development") {
            assert.match(text, /react\/jsx-dev-runtime/);
            assert.doesNotMatch(text, /<div>/);
          }
        }
        assert.equal(
          index.find(
            fs.realpathSync.native(path.join(root, "src/provenance-env.d.ts")),
          ),
          null,
        );
      });
    }
    for (const [source, , marker] of sources) {
      if (!sourceOwnershipProved) break;
      observe(`source positional react-native / ${source}`, () => {
        try {
          select();
        } catch (error) {
          sourceOwnershipProved = false;
          throw error;
        }
        const text = runSingleFileEmit({
          cwd: root,
          tsconfig: configPath,
          binary,
          plugins: false,
          file: source,
          passthrough: ["--jsx", "react-native"],
        });
        assert.equal(text.includes(marker), true);
        assert.match(text, /<div>/);
        const otherMarker = marker === "tsx-owned" ? "jsx-owned" : "tsx-owned";
        assert.equal(text.includes(otherMarker), false);
      });
    }
  } finally {
    observe("restore canonical config bytes", () => {
      fs.writeFileSync(configPath, baseline);
      assert.deepEqual(fs.readFileSync(configPath), baseline);
    });
    for (const { filename, bytes } of created)
      observe(
        `release staged source-artifact input / ${path.relative(root, filename)}`,
        () => {
          assert.equal(fs.lstatSync(filename).isFile(), true);
          assert.deepEqual(fs.readFileSync(filename), bytes);
          fs.rmSync(filename, { force: true });
          assert.equal(inputEntryAbsent(filename), true);
        },
      );
    observe("release source-artifact output directory", () => {
      if (ownsEmitDir) {
        assert.equal(fs.lstatSync(emitDir).isDirectory(), true);
        fs.rmSync(emitDir, { recursive: true, force: true });
        ownsEmitDir = false;
      }
      assert.equal(inputEntryAbsent(emitDir), true);
    });
    process.stdout.write(
      JSON.stringify({ sourceArtifactReceipts: receipts }) + "\n",
    );
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "source compiler provenance corpus failed",
    );
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [, , root, binary] = process.argv;
  if (root === undefined || binary === undefined)
    throw new Error(
      "Source compiler corpus requires canonical root and tsgo binary",
    );
  runSourceCompilerProvenanceCorpus(root, binary);
}
