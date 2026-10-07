import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { commonJsImportFacade } from "../../../../../packages/ttsc/src/launcher/internal/runtime/commonJsImportFacade";

/**
 * Consumes actual generated ESM facades through Node's native module loader.
 *
 * Supplied static names deliberately include duplicates, missing and inherited
 * properties, declared in fixtures before their exports object is replaced.
 * Static-name discovery itself is not executed. Own getters are evaluated once
 * per facade; a thrown getter must leave its binding undefined without aborting
 * import. Explicit marker modes own the Node-version distinction without
 * inferring it from the current host.
 *
 * @evidence contracts/testing.md#behavioral-verification Writes the actual returned commonJsImportFacade source as mjs and imports it natively. Observes own values, missing/inherited undefined bindings, getter counts and caught getter failure, explicit module.exports marker behavior, default identity and repeated import/cache behavior.
 * @evidence contracts/testing.md#independent-expectations Literal values and counters belong to authored CJS fixtures. Node22.15 translators.js requires own properties and tolerates throwing getters while reserving default; Node24.18 additionally reserves module.exports. Explicit false/true modes require the literal own marker versus default-object alias independently of generated source text.
 * @evidence contracts/testing.md#distinguishing-cases Duplicate own/getter names contrast with missing and inherited names; an inherited getter must remain unread and an own throwing getter must run once without abort. Marker false preserves an own module.exports value while marker true aliases the CJS default. With a null CJS value and a detected default name, the Node22 ordering performs an own-check and throws TypeError while the Node24 marker mode skips that name and retains null. Both ordinary generated modules share one CJS evaluation, repeat imports do not reevaluate, and later CJS value mutation leaves captured named bindings unchanged.
 * @evidence contracts/testing.md#execution-ownership This async source unit directly calls the builder and imports its returned ESM using ordinary file URLs, with private CJS/count/mjs fixtures and no child, Go build, product host, AST extraction or foreign patch. Fixture files are removed in finally; Node owns module-cache retention for this process. Caller-side static-name discovery and runtime marker detection are not exercised.
 */
export async function test_commonjs_import_facade_preserves_own_exports_and_getter_outcomes(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-commonjs-facade-"));
  const countsFile = path.join(root, "counts.cjs");
  const filename = path.join(root, "module.cjs");
  const failures: Error[] = [];
  try {
    fs.writeFileSync(
      countsFile,
      "module.exports = { evaluations: 0, good: 0, throwing: 0, inherited: 0 };\n",
    );
    fs.writeFileSync(
      filename,
      `
exports.value = 0;
exports.good = 0;
exports.missing = 0;
exports.inheritedValue = 0;
exports.inheritedGetter = 0;
exports.throwing = 0;
exports.default = 0;
exports["module.exports"] = 0;
const counts = require("./counts.cjs");
++counts.evaluations;
const prototype = { inheritedValue: 99 };
Object.defineProperty(prototype, "inheritedGetter", {
  get() { ++counts.inherited; return "must not be read"; }
});
const value = Object.create(prototype);
Object.defineProperties(value, {
  value: { value: 11, enumerable: true, writable: true },
  good: { enumerable: true, get() { ++counts.good; return 7; } },
  throwing: { enumerable: true, get() { ++counts.throwing; throw new Error("fixture getter"); } },
  default: { value: "own default field", enumerable: true },
  "module.exports": { value: "own marker field", enumerable: true }
});
module.exports = value;
`,
    );
    const require = createRequire(filename);
    const counts: {
      evaluations: number;
      good: number;
      throwing: number;
      inherited: number;
    } = require(countsFile);
    const names = [
      "value",
      "good",
      "good",
      "missing",
      "inheritedValue",
      "inheritedGetter",
      "throwing",
      "throwing",
      "default",
      "module.exports",
      "value",
    ];
    const originalNames = [...names];
    const namespaces: Record<string, unknown>[] = [];
    for (const [index, marker] of [false, true].entries()) {
      try {
        const facadeFile = path.join(root, `facade-${marker}.mjs`);
        fs.writeFileSync(
          facadeFile,
          commonJsImportFacade(
            pathToFileURL(filename).href,
            filename,
            names,
            marker,
          ),
        );
        const namespace = await import(pathToFileURL(facadeFile).href);
        namespaces.push(namespace);
        assert.deepEqual(names, originalNames);
        assert.equal(namespace.value, 11);
        assert.equal(namespace.good, 7);
        for (const name of [
          "missing",
          "inheritedValue",
          "inheritedGetter",
          "throwing",
        ]) {
          assert.equal(Object.hasOwn(namespace, name), true, name);
          assert.equal(namespace[name], undefined, name);
        }
        const exported: { default: string; value: number } = require(filename);
        assert.equal(exported.default, "own default field");
        assert.equal(namespace.default, exported);
        assert.equal(
          namespace["module.exports"],
          marker ? namespace.default : "own marker field",
        );
        assert.deepEqual(counts, {
          evaluations: 1,
          good: index + 1,
          throwing: index + 1,
          inherited: 0,
        });
        const repeated = await import(pathToFileURL(facadeFile).href);
        assert.equal(repeated, namespace);
        assert.deepEqual(counts, {
          evaluations: 1,
          good: index + 1,
          throwing: index + 1,
          inherited: 0,
        });
      } catch (cause) {
        failures.push(new Error(`facade marker=${marker}`, { cause }));
      }
    }
    if (namespaces.length === 2) {
      assert.equal(namespaces[0]!.default, namespaces[1]!.default);
      const exported: { value: number } = require(filename);
      exported.value = 101;
      assert.equal(require(filename).value, 101);
      assert.equal(namespaces[1]!.default, exported);
      assert.deepEqual(
        namespaces.map((namespace) => namespace.value),
        [11, 11],
      );
      assert.deepEqual(counts, {
        evaluations: 1,
        good: 2,
        throwing: 2,
        inherited: 0,
      });
    }
    const nullFile = path.join(root, "null.cjs");
    fs.writeFileSync(
      nullFile,
      'exports.default = "discarded";\nmodule.exports = null;\n',
    );
    for (const marker of [false, true]) {
      try {
        const facadeFile = path.join(root, `null-${marker}.mjs`);
        fs.writeFileSync(
          facadeFile,
          commonJsImportFacade(
            pathToFileURL(nullFile).href,
            nullFile,
            ["default"],
            marker,
          ),
        );
        if (marker) {
          const namespace = await import(pathToFileURL(facadeFile).href);
          assert.equal(namespace.default, null);
          assert.equal(namespace["module.exports"], null);
        } else {
          await assert.rejects(
            import(pathToFileURL(facadeFile).href),
            TypeError,
          );
        }
      } catch (cause) {
        failures.push(new Error(`null facade marker=${marker}`, { cause }));
      }
    }
  } catch (cause) {
    failures.push(new Error("facade fixture or shared identity", { cause }));
  } finally {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("facade fixture cleanup", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "CommonJS facade namespace observations",
    );
}
