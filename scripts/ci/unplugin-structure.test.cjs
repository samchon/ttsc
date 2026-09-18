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
 * `@ttsc/evidence` is a ttsc plugin, so ttsc cannot lint itself with it; this
 * check restates the two rules for `@ttsc/unplugin` and its suite
 * (samchon/ttsc#1386, samchon/ttsc#1387). It follows
 * `packages/evidence/native/singular.go`, `documented.go`, and the TypeScript
 * collector in `typescript.go` for every declaration form it models, and fails
 * closed on the forms it does not, so it can never pass a tree the real rules
 * would reject.
 */
const TREES = [
  path.join("packages", "unplugin", "src"),
  path.join("tests", "test-unplugin", "src"),
];

/** Tags that withdraw a declaration from the public surface (`declaration.go`). */
const HIDING_TAGS = ["@internal", "@hidden", "@ignore"];

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
    if (surface.identities.length > 1) {
      problems.push(
        `${relative}: declares ${surface.identities.length} public identities (${surface.identities.map((identity) => identity.local).join(", ")})`,
      );
      continue;
    }
    if (surface.anonymousDefault) {
      problems.push(`${relative}: anonymous default export`);
      continue;
    }
    const [identity] = surface.identities;
    const base = path.basename(relative, path.extname(relative));
    if (identity === undefined || base === "index") continue;
    const names = identity.addresses.length
      ? identity.addresses
      : [identity.local];
    if (!names.includes(base)) {
      problems.push(
        `${relative}: file name does not match its identity ${names.join(" / ")}`,
      );
    }
  }
  assert.deepEqual(problems, []);
});

/**
 * `evidence/documented` with its default selection (`type`, `function`,
 * `property`): every public unit carries a JSDoc block with content on the
 * first declaration that founds it. Units are exported interfaces, type
 * aliases, functions, variables, and classes (enums found none), the named
 * signatures of an interface or object-literal type alias, and the public
 * methods, properties, and parameter properties of a class. A hiding tag
 * withdraws a unit and everything beneath it.
 */
test("unplugin sources document every public identity and member", () => {
  const problems = [];
  for (const { relative, source } of readSources()) {
    for (const host of documentedHosts(source)) {
      const verdict = documentation(source, host.node);
      if (verdict !== "content") {
        problems.push(
          `${relative}: ${host.identity} has ${verdict === "empty" ? "an empty" : "no"} JSDoc`,
        );
      }
    }
  }
  assert.deepEqual(problems, []);
});

function readSources() {
  return TREES.flatMap((tree) => {
    const files = collectSources(path.join(root, tree));
    assert.ok(files.length > 0, `${tree} holds no TypeScript sources`);
    return files.map((file) => ({
      relative: path.relative(root, file).replaceAll(path.sep, "/"),
      source: ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    }));
  });
}

/** Every source the rules visit: TypeScript files other than declarations. */
function collectSources(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...collectSources(location));
    else if (
      entry.isFile() &&
      /\.[cm]?tsx?$/.test(entry.name) &&
      !/\.d\.[cm]?ts$/.test(entry.name)
    )
      output.push(location);
  }
  return output.sort();
}

/** `collectPublicSurface`: identities in declaration order and their addresses. */
function collectPublicSurface(source) {
  const declared = new Map();
  for (const statement of source.statements) {
    for (const name of topLevelDeclaredNames(statement)) {
      if (!declared.has(name)) declared.set(name, new Set());
    }
  }
  const owned = new Set();
  let anonymousDefault = false;
  const expose = (local, address) => {
    if (!declared.has(local)) return;
    owned.add(local);
    if (address !== "") declared.get(local).add(address);
  };
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      for (const alias of localExportAliases(statement)) {
        expose(alias.local, alias.address);
      }
    } else if (ts.isExportAssignment(statement)) {
      // Any expression but an identifier is anonymous, `export =` included.
      if (!ts.isIdentifier(statement.expression)) anonymousDefault = true;
      else expose(statement.expression.text, "");
    } else if (isSyntacticallyExported(statement)) {
      const names = topLevelDeclaredNames(statement);
      // A named default declaration takes its own name as its address.
      for (const name of names) expose(name, name);
      if (names.length === 0 && isDefaultExported(statement))
        anonymousDefault = true;
    }
  }
  return {
    anonymousDefault,
    identities: [...declared]
      .filter(([local]) => owned.has(local))
      .map(([local, addresses]) => ({
        addresses: [...addresses].sort(),
        local,
      })),
  };
}

function topLevelDeclaredNames(statement) {
  if (
    (ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
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
  if (!ts.isObjectBindingPattern(name) && !ts.isArrayBindingPattern(name))
    return [];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? bindingNames(element.name) : [],
  );
}

/** Local `export { … }` lists; `default` names no address. */
function localExportAliases(statement) {
  if (
    statement.moduleSpecifier !== undefined ||
    statement.exportClause === undefined ||
    !ts.isNamedExports(statement.exportClause)
  ) {
    return [];
  }
  return statement.exportClause.elements.map((element) => {
    const address = element.name.text;
    return {
      address: address === "default" ? "" : address,
      local: (element.propertyName ?? element.name).text,
      typeOnly: statement.isTypeOnly || element.isTypeOnly,
    };
  });
}

/**
 * `collectTypeScriptStatements` for the forms these trees can hold. A unit is
 * judged on the first declaration that founds it, and a hidden unit withdraws
 * its members with it.
 */
function documentedHosts(source) {
  const exports = new Map();
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      for (const alias of localExportAliases(statement)) {
        if (!exports.has(alias.local)) exports.set(alias.local, []);
        if (alias.address !== "") exports.get(alias.local).push(alias);
      }
    } else if (
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals &&
      ts.isIdentifier(statement.expression)
    ) {
      const local = statement.expression.text;
      if (!exports.has(local)) exports.set(local, []);
      exports.get(local).push({ address: local, typeOnly: false });
    }
  }
  const classes = new Set(
    source.statements
      .filter((statement) => ts.isClassDeclaration(statement) && statement.name)
      .map((statement) => statement.name.text),
  );
  /** Public names of one declaration: its own export plus local aliases. */
  const targets = (statement, local, allowTypeOnly) => {
    const names = new Map();
    if (isSyntacticallyExported(statement))
      names.set(local, { address: local, typeOnly: false });
    for (const alias of exports.get(local) ?? []) {
      if (alias.typeOnly && !allowTypeOnly) continue;
      const current = names.get(alias.address);
      if (current === undefined || (current.typeOnly && !alias.typeOnly))
        names.set(alias.address, alias);
    }
    return [...names.values()];
  };
  const units = new Map();
  const add = (identity, node, hidden) => {
    const current = units.get(identity);
    if (current === undefined || node.pos < current.node.pos) {
      units.set(identity, { hidden, identity, node });
    }
  };
  for (const statement of source.statements) {
    if (ts.isModuleDeclaration(statement)) {
      // The collector recurses into namespaces with implicit exports, type-only
      // projections, and function-merged static sides; this check does not
      // model that, so it refuses to judge a tree that has one.
      throw new Error(
        `${source.fileName}: namespaces are not modeled; extend this check before adding one`,
      );
    }
    const local = statement.name?.text;
    if (ts.isInterfaceDeclaration(statement)) {
      const names = targets(statement, local, true);
      if (names.length === 0) continue;
      if (classes.has(local)) {
        throw new Error(
          `${source.fileName}: a class-merged interface is not modeled; extend this check before adding one`,
        );
      }
      const hidden = hidingTag(source, statement);
      for (const name of names) {
        add(name.address, statement, hidden);
        signatureMembers(source, statement.members, name.address, hidden, add);
      }
    } else if (ts.isTypeAliasDeclaration(statement)) {
      const hidden = hidingTag(source, statement);
      for (const name of targets(statement, local, true)) {
        add(name.address, statement, hidden);
        if (ts.isTypeLiteralNode(statement.type)) {
          signatureMembers(
            source,
            statement.type.members,
            name.address,
            hidden,
            add,
          );
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && local !== undefined) {
      const hidden = hidingTag(source, statement);
      for (const name of targets(statement, local, false)) {
        add(name.address, statement, hidden);
      }
    } else if (ts.isVariableStatement(statement)) {
      // The leading JSDoc of a variable attaches to the statement wrapper.
      const hidden = hidingTag(source, statement);
      for (const declaration of statement.declarationList.declarations) {
        const own = hidden || hidingTag(source, declaration);
        for (const binding of bindingNames(declaration.name)) {
          for (const name of targets(statement, binding, false)) {
            add(name.address, statement, own);
          }
        }
      }
    } else if (ts.isClassDeclaration(statement) && local !== undefined) {
      const hidden = hidingTag(source, statement);
      for (const name of targets(statement, local, true)) {
        add(name.address, statement, hidden);
        // A type-only export exposes no class value to walk members from.
        if (!name.typeOnly) {
          classMembers(source, statement, name.address, hidden, add);
        }
      }
    }
  }
  return [...units.values()].filter((unit) => unit.hidden === "");
}

/** `collectPropertyMembers`: named property and method signatures. */
function signatureMembers(source, members, owner, hidden, add) {
  for (const member of members) {
    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member))
      continue;
    const name = memberName(member.name);
    if (name === "") continue;
    add(`${owner}.${name}`, member, hidden || hidingTag(source, member));
  }
}

/** `collectClassMembers`: public methods, properties, and parameter properties. */
function classMembers(source, statement, owner, hidden, add) {
  for (const member of statement.members) {
    if (ts.isConstructorDeclaration(member)) {
      const constructorHidden = hidden || hidingTag(source, member);
      for (const parameter of member.parameters) {
        if (!isParameterProperty(parameter) || !isPublic(parameter)) continue;
        const name = memberName(parameter.name);
        if (name === "") continue;
        add(
          `${owner}.${name}`,
          parameter,
          constructorHidden || hidingTag(source, parameter),
        );
      }
      continue;
    }
    if (!isPublic(member)) continue;
    if (
      !ts.isMethodDeclaration(member) &&
      !(
        ts.isPropertyDeclaration(member) &&
        !(ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Accessor)
      )
    )
      continue;
    const name = memberName(member.name);
    if (name === "") continue;
    add(`${owner}.${name}`, member, hidden || hidingTag(source, member));
  }
}

/** `declarationName`: identifiers and string or numeric literals only. */
function memberName(name) {
  return name !== undefined &&
    (ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNumericLiteral(name))
    ? name.text
    : "";
}

/** `ModifierFlagsParameterPropertyModifier`: accessibility, readonly, override. */
function isParameterProperty(parameter) {
  return (
    (ts.getCombinedModifierFlags(parameter) &
      (ts.ModifierFlags.AccessibilityModifier |
        ts.ModifierFlags.Readonly |
        ts.ModifierFlags.Override)) !==
    0
  );
}

function isPublic(node) {
  return (
    (ts.getCombinedModifierFlags(node) &
      (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) ===
    0
  );
}

function isSyntacticallyExported(node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;
}

function isDefaultExported(node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Default) !== 0;
}

/** JSDoc blocks the parser attached to a node, as `Node.JSDoc` returns them. */
function attachedDocs(source, node) {
  const text = source.getFullText();
  return (node.jsDoc ?? []).map((doc) => text.slice(doc.pos, doc.end));
}

/** `commentHidingTag`: a hiding tag that opens its own line. */
function hidingTag(source, node) {
  for (const doc of attachedDocs(source, node)) {
    let fence;
    for (const raw of commentLines(doc)) {
      // `commentFence`: a fence closes only with its own marker, at least as
      // long, and nothing after it.
      const marker = /^(`{3,}|~{3,})(.*)$/.exec(raw);
      if (marker !== null) {
        if (fence === undefined) fence = marker[1];
        else if (
          marker[1][0] === fence[0] &&
          marker[1].length >= fence.length &&
          marker[2].trim() === ""
        )
          fence = undefined;
        continue;
      }
      if (fence !== undefined) continue;
      const tag = HIDING_TAGS.find(
        (candidate) => raw === candidate || raw.startsWith(`${candidate} `),
      );
      if (tag !== undefined) return tag;
    }
  }
  return "";
}

/** `jsdocHasContent` over every attached block: content, empty, or missing. */
function documentation(source, node) {
  const docs = attachedDocs(source, node);
  if (docs.some((doc) => commentLines(doc).some((line) => line !== "")))
    return "content";
  return docs.length === 0 ? "missing" : "empty";
}

function commentLines(comment) {
  return comment
    .trim()
    .replace(/^\/\*\*?/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.trim().replace(/^\*/, "").trim());
}
