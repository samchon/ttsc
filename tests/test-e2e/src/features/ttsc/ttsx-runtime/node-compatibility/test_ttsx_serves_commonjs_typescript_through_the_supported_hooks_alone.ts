import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";


/**
 * Verifies ttsx serves a CommonJS TypeScript graph an ESM import reaches
 * through `module.registerHooks` alone, with no private loader slot assigned
 * where the hooks reach.
 *
 * The runtime assigned handlers into `Module._extensions` and replaced
 * `Module._resolveFilename` for the whole process, because a CommonJS module
 * handed to the ESM loader with source resolved its own `require()` past the
 * hooks on some releases (samchon/ttsc#1517). Such a module is now served to an
 * ESM importer as a facade that loads it through the CommonJS loader, whose
 * `require()` the hooks see on every release. `require.resolve` is the one
 * resolution the hooks miss on some releases, and only there is it rescued.
 *
 * 1. Give a CommonJS project an ESM entry that imports a CommonJS module, which
 *    requires `./target.js` backed only by `target.ts` and resolves it through
 *    `require.resolve`, relatively and in the `{ paths }` form.
 * 2. Run the entry through ttsx.
 * 3. Assert the require and both resolutions reached the source, the importer saw
 *    the module's named export, the `.ts` key carries Node's own `.js` handler
 *    rather than a ttsx one (samchon/ttsc#1560), and the resolver is Node's own
 *    wherever `require.resolve` consults the hooks.
 *
 * @evidence contracts/testing.md#behavioral-verification An ESM import reaches CommonJS typed config, whose require and both require.resolve forms must reach target.ts; exact JSON also checks native .js handler and unwrapped resolver.
 * @evidence contracts/testing.md#independent-expectations SERVED is a literal typed export; handler identity is compared to native .js and resolver wrapping is observed in the actual consumer.
 * @evidence contracts/testing.md#distinguishing-cases Relative require.resolve and paths-based resolution are both checked; handler false and wrapper false expectations rule out private-loader substitution.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary An ESM import reaches CommonJS typed config, whose require and both require.resolve forms must reach target.ts; exact JSON also checks native .js handler and unwrapped resolver. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One CommonJS project and ESM consumer host exercise every probe together; no per-resolution compiler preparation is introduced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The target has no target.js fallback, so hook rescue cannot pass by reading emitted files; synchronous spawn closes the host and temporary project is TestProject-owned.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_serves_commonjs_typescript_through_the_supported_hooks_alone() {
    const root = TestProject.commonJsProject(FixtureFiles.read("ttsc/ttsx_serves_commonjs_typescript_through_the_supported_hooks_alone/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/entry.mts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      handler: true,
      resolved: true,
      resolvedFromPaths: true,
      target: "SERVED",
      wrapped: false,
    });
  }
