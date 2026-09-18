const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..", "..");
// TypeScript 7 ships no classic compiler API. The unplugin package already
// depends on the legacy compiler for its declaration build, so this check
// parses with the same one.
const ts = createRequire(
  path.join(root, "packages", "unplugin", "package.json"),
)("ts-legacy");

/**
 * The trees held to the structure `@ttsc/evidence` enforces on its users.
 *
 * Ttsc hosts that lint, so it cannot run it on itself; this check restates the
 * two rules for `@ttsc/unplugin` and its suite (samchon/ttsc#1386,
 * samchon/ttsc#1387), mirroring `packages/evidence/native/singular.go`,
 * `documented.go`, and the TypeScript collector in `typescript.go`.
 */
const TREES = [
  path.join("packages", "unplugin", "src"),
  path.join("tests", "test-unplugin", "src"),
];

/**
 * `evidence/singular`: a file declares at most one public identity and takes
 * one of its exported names. Ownership is declaration ownership, so a barrel
 * owns nothing, an `index` file is exempt from the name rule, and an anonymous
 * default export has no name to take.
 */
test("unplugin sources declare one public identity named after the file", () => {
  const problems = [];
  for (const { relative, source } of readSources()) {
    const surface = collectPublicSurface(source);
    if (surface.anonymousDefault) {
      problems.push(`${relative}: anonymous default export`);
    }
    if (surface.identities.length > 1) {
      problems.push(
        `${relative}: declares ${surface.identities.length} public identities (${surface.identities.map((identity) => identity.local).join(", ")})`,
      );
    }
    const base = path.basename(relative, ".ts");
    const [identity] = surface.identities;
    if (
      surface.identities.length === 1 &&
      base !== "index" &&
      !identity.names.includes(base)
    ) {
      problems.push(
        `${relative}: file name does not match its identity ${identity.names.join(" / ")}`,
      );
    }
  }
  assert.deepEqual(problems, []);
});

/**
 * `evidence/documented` with its default selection (`type`, `function`,
 * `property`): every public identity, judged by the declaration that founds it,
 * and every public member it publishes carry a JSDoc block with content.
 * Members are the named property and method signatures of an interface or an
 * object-literal type alias, the public properties, methods, and parameter
 * properties of a class, and the exported declarations of a namespace.
 */
test("unplugin sources document every public identity and member", () => {
  const problems = [];
  for (const { relative, source } of readSources()) {
    for (const identity of collectPublicSurface(source).identities) {
      const founder = identity.declarations[0];
      if (!hasJsDoc(source, founder)) {
        problems.push(`${relative}: ${identity.local} has no JSDoc`);
      }
      for (const declaration of identity.declarations) {
        for (const member of publicMembers(declaration)) {
          if (!hasJsDoc(source, member.node)) {
            problems.push(
              `${relative}: ${identity.local}.${member.name} has no JSDoc`,
            );
          }
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

function readSources() {
  return TREES.flatMap((tree) =>
    collectSources(path.join(root, tree)).map((file) => ({
      relative: path.relative(root, file).replaceAll(path.sep, "/"),
      source: ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      ),
    })),
  );
}

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

/** Reduce one file to the identities it declares and the names it exports. */
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
  const expose = (local, name) => {
    if (!declarations.has(local)) return;
    if (!exposed.has(local)) exposed.set(local, new Set());
    // `default` names no identity: a file whose only exposure is
    // `export default x` is still the file of `x`.
    if (name !== "default") exposed.get(local).add(name);
  };
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      // A module specifier re-exposes another file's identity; a list naming
      // an import binding does too, one step removed.
      if (statement.moduleSpecifier !== undefined) continue;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          expose(
            (element.propertyName ?? element.name).text,
            element.name.text,
          );
        }
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      if (ts.isIdentifier(statement.expression)) {
        expose(statement.expression.text, "default");
      } else if (!statement.isExportEquals) {
        anonymousDefault = true;
      }
      continue;
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    const names = declaredNames(statement);
    if (names.length === 0) {
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword))
        anonymousDefault = true;
      continue;
    }
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
    for (const name of names) expose(name, isDefault ? "default" : name);
  }
  return {
    anonymousDefault,
    identities: [...exposed].map(([local, names]) => ({
      declarations: declarations.get(local),
      local,
      names: names.size === 0 ? [local] : [...names],
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
    return statement.declarationList.declarations.flatMap((declaration) =>
      bindingNames(declaration.name),
    );
  }
  return [];
}

function bindingNames(name) {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  );
}

/** Members a declaration publishes, as the evidence collector selects them. */
function publicMembers(declaration) {
  const named = (member) =>
    member.name !== undefined &&
    (ts.isIdentifier(member.name) ||
      ts.isStringLiteral(member.name) ||
      ts.isNumericLiteral(member.name));
  const signatures = (members) =>
    members
      .filter(
        (member) =>
          (ts.isPropertySignature(member) || ts.isMethodSignature(member)) &&
          named(member),
      )
      .map((member) => ({ name: member.name.text, node: member }));
  if (ts.isInterfaceDeclaration(declaration)) {
    return signatures(declaration.members);
  }
  if (
    ts.isTypeAliasDeclaration(declaration) &&
    ts.isTypeLiteralNode(declaration.type)
  ) {
    return signatures(declaration.type.members);
  }
  if (ts.isClassDeclaration(declaration)) {
    const output = [];
    for (const member of declaration.members) {
      if (ts.isConstructorDeclaration(member)) {
        for (const parameter of member.parameters) {
          const flags = ts.getCombinedModifierFlags(parameter);
          const property =
            flags &
            (ts.ModifierFlags.Public |
              ts.ModifierFlags.Private |
              ts.ModifierFlags.Protected |
              ts.ModifierFlags.Readonly);
          if (
            property &&
            !(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected))
          ) {
            output.push({ name: parameter.name.getText(), node: parameter });
          }
        }
        continue;
      }
      if (!ts.isMethodDeclaration(member) && !ts.isPropertyDeclaration(member))
        continue;
      if (ts.isPrivateIdentifier(member.name) || !named(member)) continue;
      const flags = ts.getCombinedModifierFlags(member);
      if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected))
        continue;
      if (flags & ts.ModifierFlags.Accessor) continue;
      output.push({ name: member.name.text, node: member });
    }
    return output;
  }
  if (ts.isModuleDeclaration(declaration) && declaration.body) {
    const output = [];
    for (const statement of declaration.body.statements ?? []) {
      if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
      for (const name of declaredNames(statement)) {
        output.push({ name, node: statement });
        for (const member of publicMembers(statement)) {
          output.push({ name: `${name}.${member.name}`, node: member.node });
        }
      }
    }
    return output;
  }
  return [];
}

function hasModifier(node, kind) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)
  );
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
