import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PrivateCompilerOutput } from "../../../../../packages/ttsc/src/compiler/internal/PrivateCompilerOutput";
import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { TsgoArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/TsgoArguments";
import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies private API destinations retain original artifact identity.
 *
 * Separate declarations, bundled siblings and incremental metadata cannot be
 * folded into one JavaScript directory. Source-map paths must still name the
 * authored source after the private files disappear.
 *
 * 1. Resolve configured separate outputs and create actual private artifacts.
 * 2. Read translated JavaScript, maps and state and check original coordinates.
 * 3. Contrast bundled output, omitted outDir and deep inferred incremental state.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual PrivateCompilerOutput.create/read and shared TsgoArguments direct/native phase composers, asserting returned artifact keys, map source resolution, translated incremental paths and recovery-only state exclusion. A selected __proto__ metadata key must survive as an enumerable own property while the returned record retains its ordinary object prototype.
 * @evidence contracts/testing.md#independent-expectations Authored project paths establish output identities independently of the destination helper. Resolving returned map sources from the original map directory must recover the authored source; literal bundled sibling and inferred state names follow the pinned native compiler's output contract, including preserved unknown/uppercase suffixes and removed compound declaration suffixes.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts separate declarations, inline and external maps, native raw file-URL sources containing literal percent escapes and spaces, remote URLs, explicit arbitrary-extension and inferred incremental paths, JSON/unknown/uppercase/compound declaration config suffixes, a deep rootDir, absent incremental settings, omitted outDir and bundled JavaScript/declaration siblings. Windows drive and UNC output coordinates must retain the native absolute file-URL source spelling without accessing either simulated destination. A configured outDir without rootDir keeps its config-relative artifact mapping and receives no injected rootDir argument; source-adjacent emission does request root pinning. Diagnostic-only state is excluded while successful metadata remains returnable; unrelated source text is preserved.
 * @evidence contracts/testing.md#execution-ownership This discoverable source unit reads and writes an owned fixture tree and calls the actual portable destination and artifact operations. It resolves the actual build context with plugins disabled and process.execPath as an unused binary, installs nothing and starts no compiler or product host; finally removes its own tree.
 */
export function test_api_output_destinations_preserve_artifact_identity(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          rootDir: "src",
          outDir: "lib",
          declarationDir: "types",
          declaration: true,
          sourceMap: true,
          incremental: true,
          tsBuildInfoFile: "cache/state.map",
        },
        files: ["src/main.ts"],
      }),
      "src/main.ts": "export const value = 42;\n",
    }),
  );
  const key = (file: string): string => file.split(path.sep).join("/");
  try {
    const project = readProjectConfig({ cwd: root });
    const directory = path.join(root, "private");
    const layout = PrivateCompilerOutput.create(project, directory);
    const destinations = layout.destinations;
    assert.equal(layout.pinInferredRootDir, false);
    const privateOptions = {
      emit: true,
      privateOutputDestinations: destinations,
    };
    const execution = BuildExecution.resolveExecutionContext({
      cwd: root,
      plugins: false,
      binary: process.execPath,
    });
    assert.deepEqual(
      JSON.parse(TsgoArguments.createNativeTsgoArgs(privateOptions)!).slice(-2),
      ["--tsBuildInfoFile", destinations.diagnosticsTsBuildInfoFile],
    );
    assert.deepEqual(
      JSON.parse(
        TsgoArguments.createNativeBuildTsgoArgs(execution, privateOptions)!,
      ).slice(-2),
      ["--tsBuildInfoFile", destinations.tsBuildInfoFile],
    );
    const source = path.join(root, "src/main.ts");
    assert.ok(destinations.outDir);
    assert.ok(destinations.declarationDir);
    assert.ok(destinations.tsBuildInfoFile);
    const js = path.join(destinations.outDir, "main.js");
    const declaration = path.join(destinations.declarationDir, "main.d.ts");
    const map = (file: string): string =>
      JSON.stringify({
        version: 3,
        file: path.basename(file),
        sources: [key(path.relative(path.dirname(file), source))],
        names: [],
        mappings: "AAAA",
      });
    for (const [file, text] of [
      [js, "export const value = 42;\n//# sourceMappingURL=main.js.map\n"],
      [js + ".map", map(js)],
      [declaration, "export declare const value = 42;\n"],
      [declaration + ".map", map(declaration)],
      [
        destinations.tsBuildInfoFile,
        JSON.stringify({
          fileNames: [
            "lib.es5.d.ts",
            key(
              path.relative(path.dirname(destinations.tsBuildInfoFile), source),
            ),
          ],
          options: {
            outDir: key(
              path.relative(
                path.dirname(destinations.tsBuildInfoFile),
                destinations.outDir,
              ),
            ),
          },
        }),
      ],
    ] as const) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    const output = PrivateCompilerOutput.read(
      project,
      directory,
      layout.originalPath,
      destinations.tsBuildInfoFile,
      destinations.diagnosticsTsBuildInfoFile,
    );
    assert.deepEqual(Object.keys(output).sort(), [
      "cache/state.map",
      "lib/main.js",
      "lib/main.js.map",
      "types/main.d.ts",
      "types/main.d.ts.map",
    ]);
    assert.equal(
      output["lib/main.js"],
      "export const value = 42;\n//# sourceMappingURL=main.js.map\n",
    );
    for (const file of ["lib/main.js.map", "types/main.d.ts.map"]) {
      const parsed = JSON.parse(output[file]!);
      assert.equal(
        path.resolve(root, path.dirname(file), parsed.sources[0]),
        source,
      );
      assert.equal(parsed.mappings, "AAAA");
    }
    const literalSource = path.join(root, "src/literal%23 space.ts");
    const nativeFileUrl =
      "file://" +
      (/^[A-Za-z]:/.test(literalSource) ? "/" : "") +
      key(literalSource);
    fs.writeFileSync(
      js + ".map",
      JSON.stringify({
        version: 3,
        sources: [nativeFileUrl, "https://example.test/authored.ts"],
        names: [],
        mappings: "AAAA",
      }),
    );
    const urlMap = JSON.parse(
      PrivateCompilerOutput.read(
        project,
        directory,
        layout.originalPath,
        destinations.tsBuildInfoFile,
        destinations.diagnosticsTsBuildInfoFile,
      )["lib/main.js.map"]!,
    );
    assert.equal(path.resolve(root, "lib", urlMap.sources[0]), literalSource);
    assert.equal(urlMap.sources[1], "https://example.test/authored.ts");
    if (process.platform === "win32") {
      const otherDrive = path.parse(root).root.toUpperCase().startsWith("Z:")
        ? "Y:"
        : "Z:";
      const crossVolumeSources = [
        path.join(otherDrive + path.sep, "original-output"),
        "\\\\map-server\\map-share\\original-output",
      ].map((outDir, index) => {
        const privateRoot = path.join(
          root,
          "private cross-volume",
          String(index),
        );
        const selected = PrivateCompilerOutput.create(
          {
            ...project,
            compilerOptions: {
              ...project.compilerOptions,
              outDir,
              declarationDir: undefined,
              incremental: false,
              tsBuildInfoFile: undefined,
            },
          },
          privateRoot,
        );
        const file = path.join(selected.destinations.outDir!, "main.js.map");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          file,
          JSON.stringify({
            version: 3,
            sources: [nativeFileUrl],
            names: [],
            mappings: "AAAA",
          }),
        );
        const captured = PrivateCompilerOutput.read(
          project,
          privateRoot,
          selected.originalPath,
        );
        return JSON.parse(captured[key(path.join(outDir, "main.js.map"))]!)
          .sources[0];
      });
      assert.deepEqual(crossVolumeSources, [nativeFileUrl, nativeFileUrl]);
    }
    const state = JSON.parse(output["cache/state.map"]!);
    assert.equal(state.fileNames[0], "lib.es5.d.ts");
    assert.equal(path.resolve(root, "cache", state.fileNames[1]), source);
    assert.equal(
      path.resolve(root, "cache", state.options.outDir),
      path.join(root, "lib"),
    );
    fs.mkdirSync(path.dirname(destinations.diagnosticsTsBuildInfoFile!), {
      recursive: true,
    });
    fs.writeFileSync(
      destinations.diagnosticsTsBuildInfoFile!,
      "recovery-only state",
    );
    const withRecovery = PrivateCompilerOutput.read(
      project,
      directory,
      layout.originalPath,
      destinations.tsBuildInfoFile,
      destinations.diagnosticsTsBuildInfoFile,
    );
    assert.deepEqual(
      Object.keys(withRecovery).sort(),
      Object.keys(output).sort(),
    );
    assert.equal(withRecovery["cache/state.map"], output["cache/state.map"]);
    assert.deepEqual(
      TsgoArguments.isolatedTsgoOutputArgs(privateOptions, true).slice(-2),
      ["--tsBuildInfoFile", destinations.diagnosticsTsBuildInfoFile],
    );
    const literal =
      "const literal = `sourceMappingURL=data:application/json;base64,not-a-map\n//# sourceMappingURL=data:application/json;base64,not-a-map\n`;\n";
    fs.writeFileSync(
      js,
      literal +
        "//# sourceMappingURL=data:application/json;base64," +
        Buffer.from(map(js)).toString("base64") +
        "\n",
    );
    const inline = PrivateCompilerOutput.read(
      project,
      directory,
      layout.originalPath,
      destinations.tsBuildInfoFile,
      destinations.diagnosticsTsBuildInfoFile,
    )["lib/main.js"]!;
    assert.ok(inline.startsWith(literal));
    const parsedInline = JSON.parse(
      Buffer.from(
        inline
          .slice(
            inline.lastIndexOf(
              "//# sourceMappingURL=data:application/json;base64,",
            ) + "//# sourceMappingURL=data:application/json;base64,".length,
          )
          .trim(),
        "base64",
      ).toString(),
    );
    assert.equal(path.resolve(root, "lib", parsedInline.sources[0]), source);
    const bundle = PrivateCompilerOutput.create(
      {
        ...project,
        compilerOptions: {
          ...project.compilerOptions,
          outFile: path.join(root, "bundle/app.js"),
        },
      },
      path.join(root, "private bundle"),
    );
    assert.ok(bundle.destinations.outFile);
    assert.equal(
      bundle.originalPath(bundle.destinations.outFile),
      path.join(root, "bundle/app.js"),
    );
    assert.equal(
      bundle.originalPath(
        bundle.destinations.outFile.replace(/\.js$/, ".d.ts.map"),
      ),
      path.join(root, "bundle/app.d.ts.map"),
    );
    const deep = PrivateCompilerOutput.create(
      {
        ...project,
        compilerOptions: {
          ...project.compilerOptions,
          rootDir: path.join(root, "src/deep/inside"),
          tsBuildInfoFile: undefined,
        },
      },
      path.join(root, "private deep"),
    );
    assert.ok(deep.destinations.tsBuildInfoFile);
    assert.equal(
      deep.originalPath(deep.destinations.tsBuildInfoFile),
      path.resolve(root, "lib/../../../tsconfig.tsbuildinfo"),
    );
    const configSuffixes = [
      ["tsconfig.json", "tsconfig.tsbuildinfo"],
      ["custom.conf", "custom.conf.tsbuildinfo"],
      ["custom.d.ts", "custom.tsbuildinfo"],
      ["custom.d.mts", "custom.tsbuildinfo"],
      ["custom.d.cts", "custom.tsbuildinfo"],
      ["custom.JSON", "custom.JSON.tsbuildinfo"],
    ] as const;
    assert.deepEqual(
      configSuffixes.map(([config]) => {
        const selected = PrivateCompilerOutput.create(
          {
            ...project,
            path: path.join(root, config),
            compilerOptions: {
              ...project.compilerOptions,
              rootDir: root,
              tsBuildInfoFile: undefined,
            },
          },
          path.join(root, "private suffix", config),
        );
        return selected.originalPath(selected.destinations.tsBuildInfoFile!);
      }),
      configSuffixes.map(([, expected]) => path.join(root, "lib", expected)),
    );
    const plain = PrivateCompilerOutput.create(
      {
        ...project,
        compilerOptions: { plugins: [], rootDir: path.join(root, "src") },
      },
      path.join(root, "private plain"),
    );
    assert.equal(plain.destinations.tsBuildInfoFile, undefined);
    assert.equal(plain.pinInferredRootDir, true);
    assert.equal(
      plain.originalPath(path.join(plain.destinations.outDir!, "main.js")),
      path.join(root, "src/main.js"),
    );
    assert.deepEqual(TsgoArguments.isolatedTsgoOutputArgs(privateOptions), [
      "--outDir",
      destinations.outDir,
      "--declarationDir",
      destinations.declarationDir,
      "--outFile",
      "null",
      "--tsBuildInfoFile",
      destinations.tsBuildInfoFile,
    ]);
    fs.writeFileSync(
      path.join(root, "inferred.json"),
      JSON.stringify({
        compilerOptions: { outDir: "lib" },
        files: ["src/main.ts"],
      }),
    );
    const inferredExecution = BuildExecution.resolveExecutionContext({
      cwd: root,
      tsconfig: "inferred.json",
      plugins: false,
      binary: process.execPath,
    });
    const inferred = PrivateCompilerOutput.create(
      inferredExecution.project,
      path.join(root, "private inferred"),
    );
    assert.equal(inferred.pinInferredRootDir, false);
    assert.equal(
      inferred.originalPath(
        path.join(inferred.destinations.outDir!, "src/main.js"),
      ),
      path.join(root, "lib/src/main.js"),
    );
    assert.equal(
      TsgoArguments.createTsgoBuildArgs(
        inferredExecution,
        {
          emit: true,
          outDir: inferred.destinations.outDir!,
          privateOutputDestinations: inferred.destinations,
          pinInferredRootDir: inferred.pinInferredRootDir,
        },
        { listEmittedFiles: false },
      ).includes("--rootDir"),
      false,
    );
    const reservedDirectory = path.join(root, "private reserved key");
    const reserved = PrivateCompilerOutput.create(
      {
        ...project,
        compilerOptions: {
          ...project.compilerOptions,
          tsBuildInfoFile: path.join(root, "__proto__"),
        },
      },
      reservedDirectory,
    );
    fs.mkdirSync(path.dirname(reserved.destinations.tsBuildInfoFile!), {
      recursive: true,
    });
    fs.writeFileSync(
      reserved.destinations.tsBuildInfoFile!,
      '{"version":"selected-state"}',
    );
    const reservedOutput = PrivateCompilerOutput.read(
      project,
      reservedDirectory,
      reserved.originalPath,
      reserved.destinations.tsBuildInfoFile,
    );
    assert.equal(Object.getPrototypeOf(reservedOutput), Object.prototype);
    assert.deepEqual(Object.keys(reservedOutput), ["__proto__"]);
    assert.equal(reservedOutput["__proto__"], '{"version":"selected-state"}');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
