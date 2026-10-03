import { type AnyNode, parse as parseJavaScript } from "acorn";
import { parse as parseCommonJs } from "cjs-module-lexer";

/**
 * CommonJS lexer metadata plus the scoped star helpers ttsx already supports.
 * Base lexer patterns can omit helpers inside blocks and functions. An AST
 * supplies those calls without interpreting regex or template text as code.
 *
 * @evidence contracts/common.md#principled-implementation The maintained cjs-module-lexer metadata remains the base, while Acorn node kinds identify supported literal require/export-star shapes without treating comments or string contents as code; this is metadata discovery, not evaluation or lexical binding analysis.
 * @evidence contracts/common.md#clear-and-simple-design A native parse plus one optional AST walk isolates supplemental star discovery; the node predicate admits only structured parser nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported helper spellings are the transform protocol, and parser failures preserve native metadata so Node's actual loader still owns syntax rejection.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the metadata boundary and why an AST supplements the frozen lexer; failure comments distinguish discovery from loading.
 * @evidence contracts/performance.md#efficient-algorithms The lexer and helper-marker scan process source text. Supplemental Acorn parsing/walking visits AST child references and property arrays; K matched calls sort by numeric source position in O(K log K). Deduplication hashes specifier text; AST/pending/matches and returned name arrays scale with source and discovered metadata, without a configured source-size or recursion-depth cap.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This per-source parser owns no cross-request coordinator; consumers choose whether identical transformed source metadata can be reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources AST, pending references and matches are call-local; returned lexer arrays/deduplicated specifier strings belong to the caller. No native handle, task or historical cache is retained.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The body interprets in-memory JavaScript syntax and literal reexport strings, without resolving native paths or executing loader/process APIs. The consuming runtime owns native resolution and module loading.
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
