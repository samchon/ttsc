import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Create a project that extends a bare npm preset selecting its config through
 * `package.json#tsconfig` (no JS/JSON entrypoint). The preset declares a
 * `#preset/*` path alias anchored at its own directory and ships the target
 * type it points at.
 *
 * TypeScript accepts this project and resolves `#preset/model` through the
 * inherited alias. The unplugin paths reader must do the same — honoring
 * `package.json#tsconfig` and anchoring the inherited relative target at the
 * preset config's directory — or the alias silently collapses to `any`.
 */
function createManifestPresetProject(): string {
  const root = TestProject.tmpdir("ttsc-unplugin-preset-");
  const preset = path.join(root, "node_modules", "example-preset");
  fs.mkdirSync(path.join(preset, "types"), { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(preset, "package.json"),
    JSON.stringify(
      {
        name: "example-preset",
        version: "1.0.0",
        tsconfig: ".\\base.json",
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(preset, "base.json"),
    JSON.stringify(
      { compilerOptions: { paths: { "#preset/*": ["./types/*"] } } },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(preset, "types", "model.ts"),
    "export interface PresetModel { id: number }\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "example-preset",
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "bundler",
          target: "ES2022",
          strict: true,
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  return root;
}

/**
 * Verifies the alias overlay preserves `paths` inherited from a bare preset
 * selected through `package.json#tsconfig`.
 *
 * The overlay re-states the project's effective `paths` whenever a bundler
 * alias is forwarded. If the reader cannot resolve a bare manifest-selected
 * preset, its inherited `#preset/*` alias disappears and the import collapses
 * to `any` with no diagnostic. The probe is a deliberate type error that can
 * only be reported when the alias resolved to the real interface, and its
 * well-typed twin pins that the overlay introduces no diagnostics of its own.
 *
 * 1. Create a project that extends a preset selected through a package's
 *    `tsconfig` field.
 * 2. Transform a source that misuses a type imported through the inherited alias,
 *    and assert it rejects.
 * 3. Transform a well-typed twin and assert it passes unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification An alias-wrapper compile resolves a bare preset selected by package.json#tsconfig and must reject string id against PresetModel.id:number; its numeric twin must pass unchanged with undefined result.
 * @evidence contracts/testing.md#independent-expectations The preset fixture declares id:number, and independent literal string/number assignments require opposite checker outcomes. The undefined success contract is appropriate because no plugins transform clean source; the result is not a snapshot computed by the overlay.
 * @evidence contracts/testing.md#distinguishing-cases Bare manifest-selected preset with Windows-style relative config spelling and preset-directory-relative #preset target tests resolution/anchoring. Bad and well-typed twins prevent a generic wrapper error from satisfying the negative case.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_resolves_package_tsconfig_preset_paths in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The generated wrapper, manifest-selected filesystem preset and native checker must agree on inherited type identity. A direct config reader cannot demonstrate actual compiler acceptance of the preset and rejection of the mistyped consumer.
 * @evidence contracts/e2e.md#shared-execution One preset consumer, alias map and built compiler artifact serve both sequential source variants. Each variant requires a native check because source bytes change; the preset and package installation layout are created only once.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The preset and consumer live under one unique fixture root. transformWithAliases rewrites the same main.ts sequentially with fresh uncached deliveries so the valid twin cannot reuse rejected source state. Temporary consumer/wrapper resources end with runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_resolves_package_tsconfig_preset_paths; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_resolves_package_tsconfig_preset_paths(): Promise<void> {
  const root = createManifestPresetProject();
  const aliases = { "@": path.join(root, "src") };

  await assert.rejects(
    () =>
      transformWithAliases(
        root,
        aliases,
        [
          'import type { PresetModel } from "#preset/model";',
          'export const bad: PresetModel = { id: "oops" };',
          "",
        ].join("\n"),
      ),
    /not assignable/,
  );

  const clean = await transformWithAliases(
    root,
    aliases,
    [
      'import type { PresetModel } from "#preset/model";',
      "export const good: PresetModel = { id: 1 };",
      "",
    ].join("\n"),
  );
  // No plugins are configured, so a clean transform leaves the source as-is.
  assert.equal(clean, undefined);
}

/** Run `transformTtsc` over `src/main.ts` with an explicit bundler alias map. */
async function transformWithAliases(
  root: string,
  aliases: Record<string, string>,
  source: string,
): Promise<unknown> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const file = path.join(root, "src", "main.ts");
  fs.writeFileSync(file, source, "utf8");
  return transformTtsc(file, source, resolveOptions({}), aliases);
}
