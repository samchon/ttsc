import fs from "node:fs";
import path from "node:path";

/**
 * Imports the actual installed root, API and nine adapter exports through separate ESM and CommonJS processes.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Imports the actual installed root, API and nine adapter exports through separate ESM and CommonJS processes.
 * @evidence contracts/testing.md#independent-expectations
 *   The supported public exports independently require callable adapter defaults, root.default.vite and API transformTtsc. Both module systems must meet the same declared public shapes.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Each root must expose the Vite adapter, each API must expose transformTtsc, and every adapter default must be callable.
 * @evidence contracts/testing.md#execution-ownership
 *   The entrypoints phase calls this function once, which launches the ESM and CommonJS fixture entry scripts and preserves the failing export name in each thrown error.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Actual package export resolution and ESM/CommonJS interoperation cannot be proved by inspecting source imports.
 * @evidence contracts/e2e.md#shared-execution
 *   Two processes are necessary for the two Node module systems; both read the same installed artifacts and consumer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   The two generated entry scripts are distinct and read the same immutable installed package. Both subprocesses finish before return; no import-cache result is carried from one module system to the other.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyEntrypoints body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_entrypoints({ workspace, adapterEntrypoints, run }) {
    fs.writeFileSync(path.join(workspace, "verify-entrypoints.mjs"), [
        'const root = await import("@ttsc/unplugin");',
        'if (typeof root.default.vite !== "function") {',
        '  throw new Error("@ttsc/unplugin ESM default import must expose adapters");',
        "}",
        'const api = await import("@ttsc/unplugin/api");',
        'if (typeof api.transformTtsc !== "function") {',
        '  throw new Error("@ttsc/unplugin/api must expose transformTtsc");',
        "}",
        "for (const entrypoint of " + JSON.stringify(adapterEntrypoints) + ") {",
        "  const mod = await import(`@ttsc/unplugin/${entrypoint}`);",
        '  if (typeof mod.default !== "function") {',
        "    throw new Error(`${entrypoint} ESM default import must be a function`);",
        "  }",
        "}",
        "",
    ].join("\n"), "utf8");
    run("node verify-entrypoints.mjs", workspace);
    fs.writeFileSync(path.join(workspace, "verify-entrypoints.cjs"), [
        'const root = require("@ttsc/unplugin");',
        'if (typeof root.default.vite !== "function") {',
        '  throw new Error("@ttsc/unplugin CJS require must expose adapters");',
        "}",
        'const api = require("@ttsc/unplugin/api");',
        'if (typeof api.transformTtsc !== "function") {',
        '  throw new Error("@ttsc/unplugin/api must expose transformTtsc through CJS");',
        "}",
        "for (const entrypoint of " + JSON.stringify(adapterEntrypoints) + ") {",
        "  const mod = require(`@ttsc/unplugin/${entrypoint}`);",
        '  if (typeof mod.default !== "function") {',
        "    throw new Error(`${entrypoint} CJS require must expose a default function`);",
        "  }",
        "}",
        "",
    ].join("\n"), "utf8");
    run("node verify-entrypoints.cjs", workspace);
}
