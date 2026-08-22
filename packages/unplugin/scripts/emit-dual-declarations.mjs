import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "ts-legacy";

const lib = fileURLToPath(new URL("../lib", import.meta.url));
const declarationFiles = await collectDeclarationFiles(lib);
if (declarationFiles.length === 0) {
  throw new Error(`No declarations found under ${lib}`);
}

for (const format of [
  { declarationExtension: ".d.mts", moduleExtension: ".mjs" },
  { declarationExtension: ".d.cts", moduleExtension: ".cjs" },
]) {
  for (const file of declarationFiles) {
    const source = await fs.readFile(file, "utf8");
    const output = rewriteRelativeModuleSpecifiers(
      file,
      source,
      format.moduleExtension,
    );
    await fs.writeFile(
      declarationVariant(file, format.declarationExtension),
      output,
      "utf8",
    );
  }
  await verifyDeclarationGraph(
    declarationFiles,
    format.declarationExtension,
    format.moduleExtension,
  );
}

async function collectDeclarationFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectDeclarationFiles(file)));
    } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
      files.push(file);
    }
  }
  return files.sort();
}

function rewriteRelativeModuleSpecifiers(file, source, moduleExtension) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const replacements = collectRelativeModuleSpecifiers(sourceFile).map(
    (literal) => ({
      end: literal.getEnd() - 1,
      start: literal.getStart(sourceFile) + 1,
      text: formatRelativeModuleSpecifier(literal.text, moduleExtension),
    }),
  );
  let output = source;
  for (const replacement of replacements.sort((x, y) => y.start - x.start)) {
    output =
      output.slice(0, replacement.start) +
      replacement.text +
      output.slice(replacement.end);
  }
  return output;
}

function collectRelativeModuleSpecifiers(sourceFile) {
  const literals = [];
  const visit = (node) => {
    let literal;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      literal = node.moduleSpecifier;
    } else if (
      ts.isExternalModuleReference(node) &&
      node.expression !== undefined &&
      ts.isStringLiteralLike(node.expression)
    ) {
      literal = node.expression;
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      literal = node.argument.literal;
    } else if (
      ts.isModuleDeclaration(node) &&
      ts.isStringLiteralLike(node.name)
    ) {
      literal = node.name;
    }
    if (literal !== undefined && isRelativeModuleSpecifier(literal.text)) {
      literals.push(literal);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return literals;
}

function formatRelativeModuleSpecifier(specifier, moduleExtension) {
  const match = /^(.*?)([?#].*)?$/.exec(specifier);
  const pathname = match[1];
  const suffix = match[2] ?? "";
  if (/\.(?:[cm]?js)$/.test(pathname)) {
    return pathname.replace(/\.(?:[cm]?js)$/, moduleExtension) + suffix;
  }
  if (/\.(?:json|node)$/.test(pathname)) return specifier;
  if (/\.(?:[cm]?tsx?|d\.[cm]?ts)$/.test(pathname)) {
    throw new Error(
      `Declaration module specifier ${JSON.stringify(specifier)} references TypeScript source`,
    );
  }
  return pathname + moduleExtension + suffix;
}

async function verifyDeclarationGraph(
  sourceFiles,
  declarationExtension,
  moduleExtension,
) {
  for (const sourceFile of sourceFiles) {
    const outputFile = declarationVariant(sourceFile, declarationExtension);
    const output = await fs.readFile(outputFile, "utf8");
    const parsed = ts.createSourceFile(
      outputFile,
      output,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    for (const literal of collectRelativeModuleSpecifiers(parsed)) {
      const specifier = literal.text.split(/[?#]/, 1)[0];
      if (/\.(?:json|node)$/.test(specifier)) continue;
      if (!specifier.endsWith(moduleExtension)) {
        throw new Error(
          `${outputFile} contains ${JSON.stringify(literal.text)} instead of a ${moduleExtension} specifier`,
        );
      }
      const target = path.resolve(path.dirname(outputFile), specifier);
      const declarationTarget =
        target.slice(0, -moduleExtension.length) + declarationExtension;
      await fs.access(declarationTarget);
    }
  }
}

function declarationVariant(file, extension) {
  return file.slice(0, -".d.ts".length) + extension;
}

function isRelativeModuleSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}
