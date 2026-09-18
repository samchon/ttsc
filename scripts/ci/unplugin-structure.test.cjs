const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const sourceRoot = path.join(root, "packages", "unplugin", "src");
// TypeScript 7 ships no classic compiler API. The unplugin package already
// depends on the legacy compiler for its declaration build, so this check
// parses with the same one.
const ts = createRequire(
  path.join(root, "packages", "unplugin", "package.json"),
)("ts-legacy");

/**
 * The structure rules ttsc's own `@ttsc/evidence` enforces on its users,
 * applied to `@ttsc/unplugin` itself (samchon/ttsc#1386).
 *
 * `evidence/singular`: a file declares at most one public identity and takes
 * its name. Ownership is declaration ownership. A barrel that only re-exports
 * owns nothing, an `index` file is exempt from the name rule, and an anonymous
 * default export has no name to take. `evidence/documented`: every exported
 * declaration carries a non-empty JSDoc block.
 */
test("unplugin sources declare one documented public identity per file", () => {
  const problems = [];
  const files = collectSources(sourceRoot);
  assert.ok(files.length > 0, "the unplugin source tree must not be empty");
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const surface = collectPublicSurface(source);
    if (surface.anonymousDefault) {
      problems.push(`${relative}: anonymous default export`);
    }
    if (surface.identities.length > 1) {
      problems.push(
        `${relative}: declares ${surface.identities.length} public identities (${surface.identities.map((identity) => identity.name).join(", ")})`,
      );
    }
    const base = path.basename(file, ".ts");
    if (
      surface.identities.length === 1 &&
      base !== "index" &&
      surface.identities[0].name !== base
    ) {
      problems.push(
        `${relative}: file name does not match its identity ${surface.identities[0].name}`,
      );
    }
    for (const identity of surface.identities) {
      if (!identity.declarations.some((node) => hasJsDoc(source, node))) {
        problems.push(`${relative}: ${identity.name} has no JSDoc`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

function collectSources(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...collectSources(location));
    else if (entry.isFile() && entry.name.endsWith(".ts"))
      output.push(location);
  }
  return output.sort();
}

/** Reduce one file to the identities it declares and exposes. */
function collectPublicSurface(source) {
  const declarations = new Map();
  for (const statement of source.statements) {
    for (const name of declaredNames(statement)) {
      if (!declarations.has(name)) declarations.set(name, []);
      declarations.get(name).push(statement);
    }
  }
  const exposed = new Map();
  let anonymousDefault = false;
  const expose = (name) => {
    if (declarations.has(name)) exposed.set(name, declarations.get(name));
  };
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      // A module specifier re-exposes another file's identity; a local list
      // naming an import binding does too, one step removed.
      if (statement.moduleSpecifier !== undefined) continue;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          expose((element.propertyName ?? element.name).text);
        }
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      if (ts.isIdentifier(statement.expression)) {
        const name = statement.expression.text;
        if (declarations.has(name)) expose(name);
        continue;
      }
      anonymousDefault = true;
      continue;
    }
    const modifiers = ts.canHaveModifiers(statement)
      ? (ts.getModifiers(statement) ?? [])
      : [];
    if (
      !modifiers.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      continue;
    }
    const names = declaredNames(statement);
    if (names.length === 0) anonymousDefault = true;
    for (const name of names) expose(name);
  }
  return {
    anonymousDefault,
    identities: [...exposed].map(([name, nodes]) => ({
      declarations: nodes,
      name,
    })),
  };
}

function declaredNames(statement) {
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)) &&
    statement.name !== undefined &&
    ts.isIdentifier(statement.name)
  ) {
    return [statement.name.text];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations
      .filter((declaration) => ts.isIdentifier(declaration.name))
      .map((declaration) => declaration.name.text);
  }
  return [];
}

/** Whether a declaration carries a JSDoc block with any content. */
function hasJsDoc(source, node) {
  const text = source.getFullText();
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  return ranges.some((range) => {
    const comment = text.slice(range.pos, range.end);
    if (!comment.startsWith("/**")) return false;
    const body = comment
      .slice(3, -2)
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*?\s?/, "").trim())
      .join("")
      .trim();
    return body.length !== 0;
  });
}
