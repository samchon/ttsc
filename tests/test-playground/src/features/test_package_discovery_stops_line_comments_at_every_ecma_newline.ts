import assert from "node:assert/strict";
import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";
/**
 * Verifies line comments terminate in executable top-level and template code.
 *
 * @evidence contracts/testing.md#behavioral-verification The real source collector runs all ten lexical rows and compares exact dependency names.
 * @evidence contracts/testing.md#independent-expectations An independent JavaScript Function executes every authored source and records the literal active require argument; inert comment text never supplies an expectation.
 * @evidence contracts/testing.md#distinguishing-cases LF, CR, CRLF, LS and PS distinguish newline policy in both scanner loops, with top-level and template-substitution contexts.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry executes the owning source operations in this test process, without installing a consumer, building a native producer or fabricating process protocol replies.
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
