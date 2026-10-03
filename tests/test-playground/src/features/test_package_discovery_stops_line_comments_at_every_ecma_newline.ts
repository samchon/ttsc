import assert from "node:assert/strict";
import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";
/**
 * Verifies line comments terminate in executable top-level and template code.
 *
 * A line comment ends at any ECMAScript line terminator, including carriage return
 * and the two Unicode separators. Discovery must therefore find the call after the
 * comment at top level and inside a template substitution, exactly as the
 * JavaScript engine executes it.
 *
 * 1. Write an inert require comment followed by a real require after each of five
 *    line terminators, at top level and inside a template substitution.
 * 2. Execute the source through the JavaScript engine with a recording require and
 *    require only the active call.
 * 3. Require package discovery to report exactly the same active package.
 *
 * @evidence contracts/testing.md#behavioral-verification collectExternalPackageNames is called on each of ten generated sources (five terminators at top level and inside a template substitution) and must return exactly ["active"]; any failing row is collected and rethrown in one AggregateError.
 * @evidence contracts/testing.md#independent-expectations The JavaScript engine itself (new Function with a recording require) runs every source and must record only "active", so the expectation comes from real ECMAScript line-comment semantics rather than from the collector's tokenizer.
 * @evidence contracts/testing.md#distinguishing-cases LF, CR, CRLF, U+2028 and U+2029 each end the line comment, so the real require after it must be found; the inert require inside the comment must not be. Top level and template-substitution rows cover the two scanner code paths that skip comments.
 * @evidence contracts/testing.md#execution-ownership Unit-layer entry exported from src/features and run in the shared playground process; it calls only the in-memory collector and a local Function, with no installer, compiler, native build or host process.
 */
export function test_package_discovery_stops_line_comments_at_every_ecma_newline(): void {
  const failures: unknown[] = [];
  for (const separator of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
    for (const template of [false, true]) {
      const body = '// inert require("inert")' + separator + 'require("active")';
      const source = template ? 'return `\${' + body + '}`;' : body;
      try {
        const calls: string[] = [];
        new Function("require", source)((name: string) => { calls.push(name); return name; });
        assert.deepEqual(calls, ["active"]);
        assert.deepEqual(collectExternalPackageNames(source, []), ["active"]);
      } catch (error) { failures.push(error); }
    }
  }
  if (failures.length) throw new AggregateError(failures, "Line-comment dependency matrix failed");
}
