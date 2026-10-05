import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "ts-legacy";

import { privateRuntimeRootDir } from "../../../../../packages/ttsc/src/compiler/internal/build/privateRuntimeRootDir";
import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../../../../packages/ttsc/src/compiler/internal/readEffectiveCompilerOptions";
import { createFilesystemPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createFilesystemPathIdentityContext";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies runtime source-root metadata before any project build executes.
 *
 * The private authored operation is extracted as an AST declaration and bound
 * to its actual option reader and filesystem identity owner. A separate null
 * reader seam exercises only the documented rejected-response outcome; it does
 * not manufacture a compiler rejection or certify emitted artifacts.
 *
 * 1. Resolve configured, explicit-reset, overridden and absent roots with the real
 *    reader.
 * 2. Verify the unreadable-reader fallback separately from a readable missing
 *    value.
 * 3. Preserve physical directory identity and the project's config metadata.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the exact private resolveRuntimeSourceRoot declaration from prepareExecution with actual readProjectConfig, readEffectiveCompilerOptions, privateRuntimeRootDir and filesystem identity resolution; a separately bound null-return reader verifies the rejected-reader branch only, without a compiler build.
 * @evidence contracts/testing.md#independent-expectations Literal rootDir null clears the configured root and selects the physical native volume root for ordinary projects; explicit path values select their physical directories, absent ordinary rootDir selects the volume root while composite true retains the project directory, and a wholly unreadable reader retains declared config. Expectations use independently named native realpath directories, not the option projection or extracted function.
 * @evidence contracts/testing.md#distinguishing-cases Configured src, CLI null reset, CLI other override, CLI normalized other/../src spelling, absent config root and an explicitly unreadable reader distinguish valid null/missing values from whole-reader failure. A readable reader returning undefined against a declared root verifies that missing effective metadata cannot revive stale config; config bytes and project metadata remain unchanged.
 * @evidence contracts/testing.md#execution-ownership Source unit discovered under ttsx-runtime extracts one authored private declaration with ts-legacy and executes it through a call-local binding; TestProject owns temporary real directories and process-exit cleanup. No prepareExecution build, launcher, native compiler, response-file expansion or emitted-artifact success is claimed.
 */
export function test_runtime_source_root_preserves_explicit_compiler_resets(): void {
  const source = fs.readFileSync(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/ttsc/src/launcher/internal/prepareExecution.ts",
    ),
    "utf8",
  );
  const parsed = ts.createSourceFile(
    "prepareExecution.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = parsed.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "resolveRuntimeSourceRoot",
  );
  assert.ok(declaration, "authored runtime source-root operation must exist");
  const javascript = ts.transpileModule(declaration.getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  type RootOperation = (
    project: ReturnType<typeof readProjectConfig>,
    options: { passthrough: readonly string[] },
  ) => string;
  const bind = (reader: typeof readEffectiveCompilerOptions): RootOperation =>
    new Function(
      "readEffectiveCompilerOptions",
      "createFilesystemPathIdentityContext",
      "privateRuntimeRootDir",
      "path",
      javascript + "\nreturn resolveRuntimeSourceRoot;",
    )(
      reader,
      createFilesystemPathIdentityContext,
      privateRuntimeRootDir,
      path,
    ) as RootOperation;
  const resolveRoot = bind(readEffectiveCompilerOptions);
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-runtime-root-reset-"),
  );
  for (const directory of ["src", "other"])
    fs.mkdirSync(path.join(root, directory));
  fs.writeFileSync(path.join(root, "src/main.ts"), "export const value = 1;\n");
  const config = path.join(root, "tsconfig.json");
  const bytes = JSON.stringify({
    compilerOptions: { rootDir: "src" },
    files: ["src/main.ts"],
  });
  fs.writeFileSync(config, bytes);
  const project = readProjectConfig({ cwd: root, tsconfig: config });
  const metadata = JSON.stringify(project.compilerOptions);
  const volumeRoot = fs.realpathSync.native(path.parse(root).root);
  const failures: Error[] = [];
  const check = (name: string, operation: () => void) => {
    try {
      operation();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  for (const [flags, expected] of [
    [[], fs.realpathSync.native(path.join(root, "src"))],
    [["--rootDir", "null"], volumeRoot],
    [["--rootDir", "other"], fs.realpathSync.native(path.join(root, "other"))],
    [
      ["--rootDir", "other/../src"],
      fs.realpathSync.native(path.join(root, "src")),
    ],
  ] as [string[], string][])
    check(flags.join(" ") || "configured", () =>
      assert.equal(resolveRoot(project, { passthrough: flags }), expected),
    );
  check("unreadable reader preserves provisional config", () =>
    assert.equal(
      bind(() => null)(project, { passthrough: [] }),
      fs.realpathSync.native(path.join(root, "src")),
    ),
  );
  check("readable missing effective value does not revive config", () =>
    assert.equal(
      bind(() => () => undefined)(project, { passthrough: [] }),
      volumeRoot,
    ),
  );
  check("absent configured root", () => {
    const absentConfig = path.join(root, "absent.json");
    fs.writeFileSync(
      absentConfig,
      JSON.stringify({ compilerOptions: {}, files: ["src/main.ts"] }),
    );
    const absent = readProjectConfig({ cwd: root, tsconfig: absentConfig });
    assert.equal(resolveRoot(absent, { passthrough: [] }), volumeRoot);
  });
  check("composite absent root retains project coordinate", () => {
    const config = path.join(root, "composite.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { composite: true },
        files: ["src/main.ts"],
      }),
    );
    const composite = readProjectConfig({ cwd: root, tsconfig: config });
    assert.equal(resolveRoot(composite, { passthrough: [] }), root);
    assert.equal(
      resolveRoot(composite, { passthrough: ["--rootDir", "other"] }),
      fs.realpathSync.native(path.join(root, "other")),
    );
  });
  check("nonmutation", () => {
    assert.equal(fs.readFileSync(config, "utf8"), bytes);
    assert.equal(JSON.stringify(project.compilerOptions), metadata);
  });
  if (failures.length)
    throw new AggregateError(failures, "runtime source-root metadata failed");
}
