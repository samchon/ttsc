import fs from "node:fs";
import path from "node:path";

/**
 * Executes source through the actual bun-register preload and checks BUN-RUNTIME-OK stdout.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes source through the actual bun-register preload and checks BUN-RUNTIME-OK stdout.
 * @evidence contracts/testing.md#independent-expectations
 *   The deliberate mark("bun-runtime-ok") input must become BUN-RUNTIME-OK under the fixture plugin contract; the uppercase presence and lowercase absence are independent of the adapter code.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The transformed uppercase value must appear and original bun-runtime-ok must be absent; an untransformed mark() is undefined.
 * @evidence contracts/testing.md#execution-ownership
 *   The bun-runtime phase invokes this named case after Bun production builds, with two explicit transformed/original stdout assertions. Packed Bun preload mutation scenarios independently own runtime error and recovery.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Runtime preload loading is distinct from Bun.build setup and must execute the installed registration side effect.
 * @evidence contracts/e2e.md#shared-execution
 *   One runtime process shares the installed artifacts and producer; its dedicated entry and preload config are authored after production bundling.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   This entry owns src/bun-runtime-entry.ts and bunfig.toml within the disposable packed consumer. It runs after production bundling, so introducing preload cannot silently change the earlier Bun.build boundary.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyBunRuntime body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_bun_runtime({ workspace, run , assert }) {
    fs.writeFileSync(path.join(workspace, "src", "bun-runtime-entry.ts"), [
        // `mark` is only declared (globals.d.ts); if the preload transform does
        // not run, `mark(...)` survives and Bun throws "mark is not defined".
        'export const value = mark("bun-runtime-ok");',
        "console.log(value);",
        "",
    ].join("\n"), "utf8");
    fs.writeFileSync(path.join(workspace, "bunfig.toml"), ['preload = ["@ttsc/unplugin/bun-register"]', ""].join("\n"), "utf8");
    const { stdout } = run("bun run src/bun-runtime-entry.ts", workspace);
    assert(stdout.includes("BUN-RUNTIME-OK"), "bun runtime preload must transform mark() on import (expected BUN-RUNTIME-OK in stdout)");
    assert(!stdout.includes("bun-runtime-ok"), "bun runtime preload must not leave the original marker string");
}
