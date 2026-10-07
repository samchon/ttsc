import assert from "node:assert/strict";
import ts from "ts-legacy";

import { COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "../../../../../packages/ttsc/src/plugin/internal/load/COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE";
import { PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "../../../../../packages/ttsc/src/plugin/internal/load/PLUGIN_DESCRIPTOR_SHIM_SOURCE";

/**
 * Verifies descriptor evaluation rejects prohibited keys before JSON erases
 * them.
 *
 * A function, undefined value, or inherited property disappears during JSON
 * serialization. Checking only the parsed envelope cannot reject that input.
 * The independent TypeScript AST locates candidate and serializedDescriptor
 * declarations in the actual try block; every intervening production statement
 * executes unchanged. The binder accepts a literal module and context, leaving
 * module loading and observer installation to their integration owner. It
 * supplies no guard, expected descriptor, foreign method replacement, or
 * product-specific test branch.
 *
 * 1. Execute each generated shim's actual factory-to-serialization statements.
 * 2. Preserve clean object and factory descriptors with literal native fields.
 * 3. Reject both prohibited keys with function, undefined, null, and inherited
 *    values.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the actual candidate selection, factory invocation, membership guard and JSON serialization statements from both emitted shim constants; exact clean payloads survive and prohibited properties throw before serialization.
 * @evidence contracts/testing.md#independent-expectations The supported descriptor contract rejects transformSource and transformOutput by key presence, independently of JavaScript JSON omission rules; literal clean payloads and a factory receiving its supplied context distinguish valid evaluation from blanket rejection.
 * @evidence contracts/testing.md#distinguishing-cases Both keys are tested as own function, undefined and null values, inherited functions and accessors that must not execute; clean default objects, default factories and named factories retain their exact values. Independent failures are collected across both generated operations.
 * @evidence contracts/testing.md#execution-ownership A source unit executes the generated portable evaluation operation in process with literal descriptor modules and context. AST selection extracts actual production statements without constructing a replacement guard; module loading, observation installation, ttsx, native compilation and process integration are outside this test.
 */
export function test_plugin_descriptor_shims_reject_js_transform_properties_before_serializing(): void {
  const failures: Error[] = [];
  for (const [kind, source] of [
    ["commonjs", COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE],
    ["esm", PLUGIN_DESCRIPTOR_SHIM_SOURCE],
  ] as const) {
    const evaluate = descriptorEvaluation(source);
    const check = (name: string, operation: () => void): void => {
      try {
        operation();
      } catch (error) {
        failures.push(new Error(`${kind}/${name}`, { cause: error }));
      }
    };
    const clean = { name: "native", native: { entrypoint: "main.go" } };
    check("default-object", () =>
      assert.deepEqual(evaluate({ default: clean }, {}), clean),
    );
    check("default-factory", () =>
      assert.deepEqual(
        evaluate(
          {
            default: (context: { name: string }) => ({
              ...clean,
              name: context.name,
            }),
          },
          { name: "factory" },
        ),
        { ...clean, name: "factory" },
      ),
    );
    check("named-factory", () =>
      assert.deepEqual(
        evaluate({ createTtscPlugin: () => clean, default: null }, {}),
        clean,
      ),
    );
    for (const key of ["transformSource", "transformOutput"]) {
      for (const [name, value] of [
        ["function", () => undefined],
        ["undefined", undefined],
        ["null", null],
      ] as const) {
        check(`${key}/${name}`, () =>
          assert.throws(
            () => evaluate({ default: () => ({ ...clean, [key]: value }) }, {}),
            /unsupported JS transform functions/,
          ),
        );
      }
      check(`${key}/inherited`, () => {
        const descriptor = Object.assign(
          Object.create({ [key]: () => undefined }),
          clean,
        );
        assert.throws(
          () => evaluate({ plugin: descriptor }, {}),
          /unsupported JS transform functions/,
        );
      });
      check(`${key}/accessor`, () => {
        let reads = 0;
        const descriptor = Object.defineProperty({ ...clean }, key, {
          enumerable: true,
          get: () => {
            reads++;
            throw new Error("getter must not run");
          },
        });
        assert.throws(
          () => evaluate({ default: descriptor }, {}),
          /unsupported JS transform functions/,
        );
        assert.equal(reads, 0);
      });
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "descriptor validation before serialization",
    );
}

/**
 * Bind only the emitted descriptor evaluator, leaving loading to its
 * integration owner.
 */
function descriptorEvaluation(
  source: string,
): (mod: object, context: object) => unknown {
  const parsed = ts.createSourceFile(
    "descriptor-shim.mts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const block = parsed.statements.find(ts.isTryStatement)?.tryBlock;
  assert.ok(block, "generated evaluator must have its error boundary");
  const named = (statement: ts.Statement, name: string): boolean =>
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === name,
    );
  const first = block.statements.findIndex((statement) =>
    named(statement, "candidate"),
  );
  const last = block.statements.findIndex((statement) =>
    named(statement, "serializedDescriptor"),
  );
  assert.ok(
    first >= 0 && last > first,
    "generated descriptor evaluation must be addressable",
  );
  const actual = source.slice(
    block.statements[first]!.getStart(parsed),
    block.statements[last]!.end,
  );
  return new Function(
    "mod",
    "context",
    `${actual}\nreturn serializedDescriptor === undefined ? undefined : JSON.parse(serializedDescriptor);`,
  ) as (mod: object, context: object) => unknown;
}
