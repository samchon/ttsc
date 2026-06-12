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

export {
  assertAliasOverlapResolvesTypes,
  assertAliasOverlayMergesExtendedJsoncPaths,
  assertAliasOverlayPreservesUnaliasedPaths,
};
