import { type AnyNode, parse as parseJavaScript } from "acorn";
import { parse as parseCommonJs } from "cjs-module-lexer";

/**
 * Node's export metadata plus the scoped star helpers ttsx already supports.
 * Node's frozen lexer patterns omit helpers inside blocks and functions. An AST
 * supplies those calls without interpreting regex or template text as code.
 */
export function parseCommonJsExports(
  source: string,
): ReturnType<typeof parseCommonJs> {
  let parsed: ReturnType<typeof parseCommonJs>;
  try {
    parsed = parseCommonJs(source);
  } catch {
    // Metadata never replaces the syntax diagnostic from Node's actual load.
    parsed = { exports: [], reexports: [] };
  }
  if (!source.includes("__exportStar")) return parsed;
  try {
    const root = parseJavaScript(source, {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      // Name-only lowering of owned ESM may retain import.meta.
      allowImportExportEverywhere: true,
    });
    const pending: AnyNode[] = [root];
    const found: { start: number; specifier: string }[] = [];
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (node.type === "CallExpression" && !node.optional) {
        const callee = node.callee;
        const star =
          (callee.type === "Identifier" && callee.name === "__exportStar") ||
          (callee.type === "MemberExpression" &&
            !callee.computed &&
            !callee.optional &&
            callee.object.type === "Identifier" &&
            callee.property.type === "Identifier" &&
            callee.property.name === "__exportStar");
        const [required, target] = node.arguments;
        if (
          star &&
          target?.type === "Identifier" &&
          target.name === "exports" &&
          required?.type === "CallExpression" &&
          !required.optional &&
          required.callee.type === "Identifier" &&
          required.callee.name === "require" &&
          required.arguments.length === 1
        ) {
          const specifier = required.arguments[0];
          if (
            specifier?.type === "Literal" &&
            typeof specifier.value === "string"
          ) {
            found.push({ start: node.start, specifier: specifier.value });
          }
        }
      }
      for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
          if (isJavaScriptNode(child)) pending.push(child);
        }
      }
    }
    found.sort((a, b) => a.start - b.start);
    return {
      exports: parsed.exports,
      reexports: [
        ...new Set([
          ...found.map((entry) => entry.specifier),
          ...parsed.reexports,
        ]),
      ],
    };
  } catch {
    // Retain native metadata if a source is outside the supplemental parser's grammar.
    return parsed;
  }
}

function isJavaScriptNode(value: unknown): value is AnyNode {
  if (typeof value !== "object" || value === null) return false;
  const node = value as { type?: unknown; start?: unknown; end?: unknown };
  return (
    typeof node.type === "string" &&
    typeof node.start === "number" &&
    typeof node.end === "number"
  );
}
