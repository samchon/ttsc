import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";

const PACKAGE_DIR = path.join(
  TestProject.WORKSPACE_ROOT,
  "packages",
  "unplugin",
);

/** The slice of the legacy compiler API this scenario parses output with. */
interface ILegacyParser {
  createSourceFile(
    file: string,
    text: string,
    target: number,
    setParentNodes: boolean,
    kind: number,
  ): ILegacyNode;
  forEachChild(node: ILegacyNode, visit: (child: ILegacyNode) => void): void;
  ScriptKind: { JS: number };
  ScriptTarget: { Latest: number };
  SyntaxKind: Record<string, number>;
}

/** A parsed node, read only through the fields this scenario inspects. */
interface ILegacyNode {
  arguments?: ILegacyNode[];
  expression?: ILegacyNode;
  kind: number;
  moduleSpecifier?: ILegacyNode;
  text?: string;
}

// TypeScript 7 ships no compiler API; the package's own declaration build
// already depends on the legacy one, so the output is parsed with that.
const LEGACY: ILegacyParser = createRequire(
  path.join(PACKAGE_DIR, "package.json"),
)("ts-legacy");

/**
 * Verifies every emitted runtime module keeps its package dependencies external
 * and inlines nothing from the workspace.
 *
 * The build emits one module per source file, so a single file proves nothing
 * about the rest: an import of `ttsc` or of its `ttsc/path-identity` subpath
 * that rollup resolved instead of externalizing would ship a second copy of the
 * host's path identity next to the one the host uses. The check therefore scans
 * the whole `lib` output in both formats. It also pins the stale dev-time
 * externals (`diff-match-patch-es`, `magic-string`) out of the config and the
 * output, and keeps the config free of `rollup-plugin-auto-external` and
 * `rollup-plugin-node-externals`, whose v9 calls the ES2025 `RegExp.escape` and
 * crashes the build on Node 22; the config derives its externals from
 * `package.json` instead.
 *
 * 1. Parse every emitted `.js` and `.mjs` module and collect its bare import
 *    specifiers.
 * 2. Assert each is a Node builtin or a declared, optional, or peer dependency,
 *    and that `ttsc`, `ttsc/path-identity`, and `unplugin` stay external in
 *    both formats.
 * 3. Assert no module carries a virtual shim, `__dirname`, a workspace path, or a
 *    stale external, and that no `_virtual` directory was emitted.
 * 4. Assert the rollup config imports neither externals plugin.
 */
export async function test_package_build_keeps_runtime_dependencies_external(): Promise<void> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  const lib = path.dirname(TestUnpluginRuntime.libPath("index", "js"));
  const outputs = collectRuntimeOutputs(lib);
  assert.ok(outputs.length > 0, "the build emitted no runtime modules");

  const externals = { js: new Set<string>(), mjs: new Set<string>() };
  for (const file of outputs) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(lib, file).replaceAll(path.sep, "/");
    for (const specifier of bareSpecifiers(file, source)) {
      assert.ok(
        isBuiltin(specifier) || declared.has(packageName(specifier)),
        `${relative} imports undeclared ${specifier}`,
      );
      externals[file.endsWith(".mjs") ? "mjs" : "js"].add(specifier);
    }
    assert.doesNotMatch(
      source,
      /_virtual|__dirname|packages\/ttsc|diff-match-patch-es|magic-string/,
      relative,
    );
  }
  for (const format of ["js", "mjs"] as const) {
    for (const dependency of ["ttsc", "ttsc/path-identity", "unplugin"]) {
      assert.ok(
        externals[format].has(dependency),
        `${dependency} must stay external in the .${format} output`,
      );
    }
  }
  assert.equal(fs.existsSync(path.join(lib, "_virtual")), false);

  const rollupConfig = fs.readFileSync(
    path.join(PACKAGE_DIR, "rollup.config.mjs"),
    "utf8",
  );
  for (const staleExternal of ["diff-match-patch-es", "magic-string"]) {
    assert.doesNotMatch(rollupConfig, new RegExp(escapeRegExp(staleExternal)));
  }
  for (const removedPlugin of [
    "rollup-plugin-node-externals",
    "rollup-plugin-auto-external",
  ]) {
    // Match the import statement, not a bare mention: the config comment names
    // these plugins to explain why externals come from package.json instead.
    assert.doesNotMatch(
      rollupConfig,
      new RegExp(`from ["']${escapeRegExp(removedPlugin)}["']`),
      removedPlugin,
    );
  }
}

/** Every emitted `.js` and `.mjs` module below `directory`. */
function collectRuntimeOutputs(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectRuntimeOutputs(location);
    return /\.m?js$/.test(entry.name) ? [location] : [];
  });
}

/**
 * Non-relative specifiers of static imports and re-exports, `require` calls,
 * and dynamic `import()`, read from the parsed module so a specifier inside a
 * comment or a string (such as the Windows broker's embedded child script)
 * neither satisfies nor fails the check.
 */
function bareSpecifiers(file: string, source: string): string[] {
  const kinds = LEGACY.SyntaxKind;
  const output: string[] = [];
  const text = (node: ILegacyNode | undefined): string | undefined =>
    node !== undefined && node.kind === kinds.StringLiteral
      ? node.text
      : undefined;
  const visit = (node: ILegacyNode): void => {
    let specifier: string | undefined;
    if (
      node.kind === kinds.ImportDeclaration ||
      node.kind === kinds.ExportDeclaration
    ) {
      specifier = text(node.moduleSpecifier);
    } else if (
      node.kind === kinds.CallExpression &&
      node.arguments?.length === 1 &&
      node.expression !== undefined &&
      (node.expression.kind === kinds.ImportKeyword ||
        (node.expression.kind === kinds.Identifier &&
          node.expression.text === "require"))
    ) {
      specifier = text(node.arguments[0]);
    }
    if (specifier !== undefined && !specifier.startsWith(".")) {
      output.push(specifier);
    }
    LEGACY.forEachChild(node, visit);
  };
  visit(
    LEGACY.createSourceFile(
      file,
      source,
      LEGACY.ScriptTarget.Latest,
      true,
      LEGACY.ScriptKind.JS,
    ),
  );
  return output;
}

/** The package a bare specifier names, without its subpath. */
function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

/** Escapes all regex meta-characters in `value` for use in `new RegExp(...)`. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
