// Loading @ttsc/testing evaluates TestUnpluginProject, which seeds
// TTSC_TSGO_BINARY for in-process transformTtsc calls.
import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Fixture options for the alias-resolution projects.
 *
 * `basePathsInExtendedJsonc` moves the `paths` declaration into an extended
 * JSONC base config under `config/`, exercising the `extends`-chain walk and
 * comment/trailing-comma tolerance of the generated-tsconfig overlay.
 */
interface IAliasProjectOptions {
  basePathsInExtendedJsonc?: boolean;
}

/**
 * Create a plugin-free project with two tsconfig path mappings: `@/*` →
 * `./src/*` (also mirrored by the forwarded bundler alias in tests) and
 * `#lib/*` → `./lib/*` (tsconfig-only). Plugin-free matters: the transform then
 * runs the real TypeScript-Go program and surfaces semantic diagnostics, which
 * is how these tests observe whether an aliased type actually resolved or
 * silently collapsed to `any`.
 */
function createAliasProject(options: IAliasProjectOptions = {}): string {
  const root = TestProject.tmpdir("ttsc-unplugin-alias-");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "lib"), { recursive: true });
  const compilerOptions = {
    module: "ESNext",
    moduleResolution: "bundler",
    target: "ES2022",
    strict: true,
  };
  if (options.basePathsInExtendedJsonc) {
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "config", "tsconfig.base.json"),
      [
        "{",
        "  // paths live in an extended JSONC base on purpose:",
        "  // targets must stay anchored at this config's directory.",
        '  "compilerOptions": {',
        '    "paths": { "@/*": ["../src/*"], "#lib/*": ["../lib/*"], },',
        "  },",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify(
        {
          extends: "./config/tsconfig.base.json",
          compilerOptions,
          include: ["src", "lib"],
        },
        null,
        2,
      ),
      "utf8",
    );
  } else {
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            ...compilerOptions,
            paths: { "@/*": ["./src/*"], "#lib/*": ["./lib/*"] },
          },
          include: ["src", "lib"],
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  fs.writeFileSync(
    path.join(root, "src", "types.ts"),
    "export interface Foo { id: number; name: string }\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "lib", "other.ts"),
    "export interface Bar { flag: boolean }\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  return root;
}

/** The bundler alias map mirroring the project's `@/*` tsconfig mapping. */
function overlappingAliases(root: string): Record<string, string> {
  return { "@": path.join(root, "src") };
}

/** Run `transformTtsc` over `src/main.ts` with the given source text. */
async function transformMain(root: string, source: string): Promise<unknown> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const file = path.join(root, "src", "main.ts");
  fs.writeFileSync(file, source, "utf8");
  return transformTtsc(
    file,
    source,
    resolveOptions({}),
    overlappingAliases(root),
  );
}

/**
 * Asserts the #205 regression: a type imported through an alias present in BOTH
 * tsconfig `paths` and the forwarded bundler aliases must still resolve.
 *
 * The probe is a deliberate type error through the aliased import: it can only
 * be reported when `Foo` resolved to the real interface. Before the fix the
 * generated overlay broke resolution (`baseUrl` is TS5102-removed and bare
 * relative targets are TS5090-rejected in the temp dir), the type collapsed to
 * `any`, and no error surfaced — the silent-no-op failure mode. The negative
 * twin (well-typed source passes cleanly) pins that the overlay introduces no
 * new diagnostics of its own.
 */
async function assertAliasOverlapResolvesTypes(): Promise<void> {
  const root = createAliasProject();
  await assert.rejects(
    () =>
      transformMain(
        root,
        [
          'import type { Foo } from "@/types";',
          'export const bad: Foo = { id: "oops", name: 42 };',
          "",
        ].join("\n"),
      ),
    /not assignable/,
  );
  const clean = await transformMain(
    root,
    [
      'import type { Foo } from "@/types";',
      'export const good: Foo = { id: 1, name: "fine" };',
      "",
    ].join("\n"),
  );
  // No plugins are configured, so a clean transform leaves the source as-is.
  assert.equal(clean, undefined);
}

/**
 * Asserts that a tsconfig-only `paths` key (`#lib/*`, absent from the bundler
 * aliases) keeps resolving when the alias overlay is active. The generated
 * tsconfig replaces `paths` wholesale via `extends` semantics, so the overlay
 * must re-state the project's own mappings or this import silently breaks.
 */
async function assertAliasOverlayPreservesUnaliasedPaths(): Promise<void> {
  const root = createAliasProject();
  await assert.rejects(
    () =>
      transformMain(
        root,
        [
          'import type { Bar } from "#lib/other";',
          'export const bad: Bar = { flag: "oops" };',
          "",
        ].join("\n"),
      ),
    /not assignable/,
  );
}

/**
 * Asserts the overlay merges `paths` declared in an extended JSONC base config:
 * the chain is walked, comments and trailing commas are tolerated, and relative
 * targets stay anchored at the declaring config's directory (the base sits in
 * `config/`, one level below the project root).
 */
async function assertAliasOverlayMergesExtendedJsoncPaths(): Promise<void> {
  const root = createAliasProject({ basePathsInExtendedJsonc: true });
  await assert.rejects(
    () =>
      transformMain(
        root,
        [
          'import type { Bar } from "#lib/other";',
          'export const bad: Bar = { flag: "oops" };',
          "",
        ].join("\n"),
      ),
    /not assignable/,
  );
}

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
      { name: "example-preset", version: "1.0.0", tsconfig: "base.json" },
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
 * Asserts the alias overlay preserves `paths` inherited from a bare preset
 * selected through `package.json#tsconfig`.
 *
 * The transform overlay re-states the project's effective `paths` (walking the
 * `extends` chain) whenever a bundler alias is forwarded. If the unplugin
 * reader cannot resolve a bare manifest-selected preset, its inherited
 * `#preset/*` alias disappears from the overlay and the aliased import
 * collapses to `any` — no diagnostic surfaces. The probe is a deliberate type
 * error through the inherited alias: it can only be reported when `PresetModel`
 * resolved to the real interface. The negative twin (well-typed source) pins
 * that the overlay introduces no diagnostics of its own.
 */
async function assertAliasOverlayResolvesPackageTsconfigPresetPaths(): Promise<void> {
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

export {
  assertAliasOverlapResolvesTypes,
  assertAliasOverlayMergesExtendedJsoncPaths,
  assertAliasOverlayPreservesUnaliasedPaths,
  assertAliasOverlayResolvesPackageTsconfigPresetPaths,
};
