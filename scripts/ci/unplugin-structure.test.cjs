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
 * first declaration that founds it. A unit is one symbol kind at one address:
 * exported interfaces, type aliases, functions, variables, and classes (enums
 * found none), the named signatures of an interface or object-literal type
 * alias, and the public methods, properties, and parameter properties of a
 * class, instance members through `prototype`. A hiding tag on any declaration
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

/**
 * Local `export { … }` lists. `default` names no address of its own; it is a
 * default binding of the local instead (`collectDefaultExportBindings`).
 */
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
 * `collectLocalExportNames`: the public names each local takes through export
 * lists and default bindings. A default binding alone publishes the local's own
 * name; beside other aliases it makes one of them a value identity, so a
 * type-only alias no longer withholds the class members behind it.
 */
function localExportNames(source) {
  const exports = new Map();
  const defaults = new Map();
  const push = (local, entry) => {
    if (!exports.has(local)) exports.set(local, []);
    exports.get(local).push(entry);
  };
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      for (const alias of localExportAliases(statement)) {
        if (alias.address !== "") push(alias.local, { ...alias });
        else {
          const previous = defaults.get(alias.local);
          defaults.set(alias.local, {
            typeOnly: alias.typeOnly && (previous?.typeOnly ?? true),
          });
        }
      }
    } else if (
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals &&
      ts.isIdentifier(statement.expression)
    ) {
      defaults.set(statement.expression.text, { typeOnly: false });
    }
  }
  for (const [local, binding] of defaults) {
    const aliases = exports.get(local);
    if (aliases === undefined) {
      push(local, { address: local, local, typeOnly: binding.typeOnly });
    } else if (!binding.typeOnly) {
      let selected = 0;
      aliases.forEach((alias, index) => {
        const current = aliases[selected];
        if (
          (current.typeOnly && !alias.typeOnly) ||
          (current.typeOnly === alias.typeOnly &&
            alias.address < current.address)
        )
          selected = index;
      });
      aliases[selected] = { ...aliases[selected], typeOnly: false };
    }
  }
  return exports;
}

/**
 * `collectTypeScriptStatements` for the forms these trees can hold. A unit is
 * one `(symbol, address)` pair, judged on the first declaration that founds it,
 * and any declaration carrying a hiding tag withdraws the whole unit and
 * everything beneath it.
 */
function documentedHosts(source) {
  const exports = localExportNames(source);
  const classes = new Set();
  // `collectHiddenDeclarationNames`: a tag on any same-named statement hides
  // every declaration of that name.
  const hiddenNames = new Map();
  for (const statement of source.statements) {
    const name =
      !ts.isVariableStatement(statement) &&
      statement.name !== undefined &&
      ts.isIdentifier(statement.name)
        ? statement.name.text
        : undefined;
    if (name === undefined) continue;
    if (ts.isClassDeclaration(statement)) classes.add(name);
    const tag = hidingTag(source, statement);
    if (tag !== "" && !hiddenNames.has(name)) hiddenNames.set(name, tag);
  }
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
  const add = (symbol, identity, node, hidden) => {
    const key = `${symbol}:${identity}`;
    const current = units.get(key);
    if (current === undefined) {
      units.set(key, { hidden, identity, node, symbol });
      return;
    }
    if (hidden !== "" && current.hidden === "") current.hidden = hidden;
    if (node.pos < current.node.pos) current.node = node;
  };
  for (const statement of source.statements) {
    if (ts.isModuleDeclaration(statement)) {
      // The collector recurses into namespaces and ambient module blocks with
      // implicit exports, type-only projections, and function-merged static
      // sides; this check does not model that, so it refuses to judge them.
      throw new Error(
        `${source.fileName}: namespace and module blocks are not modeled; extend this check before adding one`,
      );
    }
    const local = statement.name?.text;
    const hidden = () => hiddenNames.get(local) ?? hidingTag(source, statement);
    if (ts.isInterfaceDeclaration(statement)) {
      const names = targets(statement, local, true);
      if (names.length === 0) continue;
      if (classes.has(local)) {
        throw new Error(
          `${source.fileName}: a class-merged interface is not modeled; extend this check before adding one`,
        );
      }
      for (const name of names) {
        add("type", name.address, statement, hidden());
        signatureMembers(
          source,
          statement.members,
          name.address,
          hidden(),
          add,
        );
      }
    } else if (ts.isTypeAliasDeclaration(statement)) {
      for (const name of targets(statement, local, true)) {
        add("type", name.address, statement, hidden());
        if (ts.isTypeLiteralNode(statement.type)) {
          signatureMembers(
            source,
            statement.type.members,
            name.address,
            hidden(),
            add,
          );
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && local !== undefined) {
      for (const name of targets(statement, local, false)) {
        add("function", name.address, statement, hidden());
      }
    } else if (ts.isVariableStatement(statement)) {
      // The leading JSDoc of a variable attaches to the statement wrapper.
      const statementHidden = hidingTag(source, statement);
      const constant =
        (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
      for (const declaration of statement.declarationList.declarations) {
        const symbol =
          constant &&
          ts.isIdentifier(declaration.name) &&
          isFunctionValue(declaration.initializer)
            ? "function"
            : "property";
        const own = statementHidden || hidingTag(source, declaration);
        for (const binding of bindingNames(declaration.name)) {
          for (const name of targets(statement, binding, false)) {
            add(symbol, name.address, statement, own);
          }
        }
      }
    } else if (ts.isClassDeclaration(statement) && local !== undefined) {
      for (const name of targets(statement, local, true)) {
        add("type", name.address, statement, hidden());
        // A type-only export exposes no class value to walk members from.
        if (!name.typeOnly) {
          classMembers(source, statement, name.address, hidden(), add);
        }
      }
    }
  }
  return [...units.values()].filter((unit) => unit.hidden === "");
}

/** `collectPropertyMembers`: named property and method signatures. */
function signatureMembers(source, members, owner, hidden, add) {
  for (const member of members) {
    const symbol = ts.isMethodSignature(member)
      ? "function"
      : ts.isPropertySignature(member)
        ? memberSymbol(undefined, member.type)
        : undefined;
    const name = memberName(member.name);
    if (symbol === undefined || name === "") continue;
    add(
      symbol,
      `${owner}.${name}`,
      member,
      hidden || hidingTag(source, member),
    );
  }
}

/**
 * `collectClassMembers`: public methods, properties, and parameter properties,
 * addressed through `prototype` unless static (`addClassMemberUnit`). A hiding
 * tag on any constructor overload hides every parameter property
 * (`constructorHidingTag`).
 */
function classMembers(source, statement, owner, hidden, add) {
  const constructorHidden =
    hidden ||
    statement.members
      .filter(ts.isConstructorDeclaration)
      .map((member) => hidingTag(source, member))
      .find((tag) => tag !== "") ||
    "";
  for (const member of statement.members) {
    if (ts.isConstructorDeclaration(member)) {
      for (const parameter of member.parameters) {
        if (!isParameterProperty(parameter) || !isPublic(parameter)) continue;
        const name = memberName(parameter.name);
        if (name === "") continue;
        add(
          memberSymbol(parameter.initializer, parameter.type),
          `${owner}.prototype.${name}`,
          parameter,
          constructorHidden || hidingTag(source, parameter),
        );
      }
      continue;
    }
    if (!isPublic(member)) continue;
    let symbol;
    if (ts.isMethodDeclaration(member)) symbol = "function";
    else if (
      ts.isPropertyDeclaration(member) &&
      !(ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Accessor)
    )
      symbol = memberSymbol(member.initializer, member.type);
    else continue;
    const name = memberName(member.name);
    if (name === "") continue;
    const isStatic =
      (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0;
    add(
      symbol,
      isStatic ? `${owner}.${name}` : `${owner}.prototype.${name}`,
      member,
      hidden || hidingTag(source, member),
    );
  }
}

/** `memberSymbol`: a function value or a direct function type is a function. */
function memberSymbol(initializer, type) {
  let declared = type;
  while (declared !== undefined && ts.isParenthesizedTypeNode(declared))
    declared = declared.type;
  return isFunctionValue(initializer) ||
    (declared !== undefined && ts.isFunctionTypeNode(declared))
    ? "function"
    : "property";
}

/** `isFunctionValue`: an arrow or function expression through wrappers. */
function isFunctionValue(node) {
  while (node !== undefined) {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true;
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isTypeAssertionExpression(node)
    )
      node = node.expression;
    else return false;
  }
  return false;
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

/**
 * `commentHidingTag`: a hiding tag that opens its own line outside a code
 * fence. Each line is trimmed, stripped of a leading `*` and then `///`, and
 * fed through `commentFence`/`markdownFence` before the tag test.
 */
function hidingTag(source, node) {
  for (const doc of attachedDocs(source, node)) {
    let fence;
    for (const raw of commentLines(doc)) {
      const line = raw.replace(/^\/\/\//, "").trim();
      const opened = markdownFence(line);
      if (opened !== undefined) {
        if (fence === undefined) fence = opened;
        else if (
          opened.marker === fence.marker &&
          opened.length >= fence.length &&
          opened.remainder.trim() === ""
        )
          fence = undefined;
        continue;
      }
      if (fence !== undefined) continue;
      const tag = HIDING_TAGS.find(
        (candidate) => line === candidate || line.startsWith(`${candidate} `),
      );
      if (tag !== undefined) return tag;
    }
  }
  return "";
}

/** `markdownFence`: a run of three or more backticks or tildes. */
function markdownFence(line) {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (match === null) return undefined;
  const [, , run, remainder] = match;
  // A backtick fence's info string may not contain a backtick.
  if (run[0] === "`" && remainder.includes("`")) return undefined;
  return { length: run.length, marker: run[0], remainder };
}

/** `jsdocHasContent` over every attached block: content, empty, or missing. */
function documentation(source, node) {
  const docs = attachedDocs(source, node);
  if (docs.some((doc) => commentLines(doc).some((line) => line !== "")))
    return "content";
  return docs.length === 0 ? "missing" : "empty";
}

/** The trimmed lines of one comment, each without its leading `*`. */
function commentLines(comment) {
  return comment
    .trim()
    .replace(/^\/\*\*?/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.trim().replace(/^\*/, "").trim());
}
