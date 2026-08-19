import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { seedUtilityPlugin } from "./transform-utility-plugin-config";

/**
 * Scenarios for the completeness a linked plugin declares about its own
 * contribution (samchon/ttsc#1263) and the rule the host declares under
 * (samchon/ttsc#1259).
 *
 * Every fixture here has the same shape: an entry that imports a type-only
 * sibling, so the host-owned reference bound contains a file whose content
 * cannot reach a syntactic transform's output. Whether that sibling is
 * registered as a watch input of the entry is exactly the question the
 * declaration answers.
 */

/** Name of a first-party utility plugin under test. */
type UtilityPlugin = "banner" | "paths" | "strip";

/** One fixture project wired to a set of linked utility plugins. */
interface ILinkedPluginProject {
  /** Absolute path of the entry module. */
  main: string;
  /** Project root. */
  root: string;
  /** Absolute path of the type-only sibling the entry imports. */
  types: string;
}

/**
 * Materialize a project whose entry imports a type-only sibling through a
 * tsconfig path alias, wired to the given linked plugins.
 *
 * The alias exists so `@ttsc/paths` has something to rewrite; the type-only
 * import exists so the reference graph carries an edge whose target cannot
 * influence a syntactic transform. The mapping is written without `baseUrl`,
 * which TypeScript 7 removed: `paths` targets resolve against the tsconfig's
 * own directory.
 */
function createLinkedPluginProject(
  plugins: readonly UtilityPlugin[],
): ILinkedPluginProject {
  // Share one Go build cache across these fixtures; each distinct plugin set
  // still links its own host, but without this every project would rebuild the
  // host into its own `node_modules/.cache`.
  TestUnpluginProject.ensureSharedCacheDir();
  const root = TestProject.tmpdir("ttsc-unplugin-linked-complete-");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  const types = path.join(root, "src", "types.ts");
  fs.writeFileSync(
    types,
    "export interface Model {\n  id: string;\n}\n",
    "utf8",
  );
  const main = path.join(root, "src", "main.ts");
  fs.writeFileSync(
    main,
    [
      'import type { Model } from "~/types";',
      "",
      'export const value: string = ({ id: "x" } satisfies Model).id;',
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "commonjs",
          outDir: "dist",
          paths: { "~/*": ["./src/*"] },
          plugins: plugins.map((plugin) => ({ transform: `@ttsc/${plugin}` })),
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  if (plugins.includes("banner")) {
    fs.writeFileSync(
      path.join(root, "banner.config.json"),
      JSON.stringify({ text: "Fixture Banner Text" }),
      "utf8",
    );
  }
  if (plugins.includes("strip")) {
    fs.writeFileSync(
      path.join(root, "strip.config.json"),
      JSON.stringify({ calls: ["logger.trace"], statements: [] }),
      "utf8",
    );
  }
  for (const plugin of plugins) {
    seedUtilityPlugin(root, plugin);
  }
  return { main, root, types };
}

/**
 * Transform the entry once and collect every watch input the adapter derived.
 *
 * `aliases` forces the compile through a generated tsconfig in the system temp
 * directory, which moves the host's cwd off the project root and therefore
 * changes how every envelope section is keyed.
 */
async function collectEntryWatchInputs(
  project: ILinkedPluginProject,
  aliases?: Record<string, string>,
): Promise<string[]> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const watched: string[] = [];
  // The watch inputs are notified whether or not the transform changed the
  // text, so the derivation is observable even for a plugin set that leaves
  // this particular entry alone; an empty list is the only state that would
  // make the scenario prove nothing.
  await transformTtsc(
    project.main,
    fs.readFileSync(project.main, "utf8"),
    resolveOptions(),
    aliases,
    undefined,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(
    watched.length !== 0,
    "the transform must derive watch inputs, or the scenario proves nothing",
  );
  return watched.map((input) => path.resolve(input));
}

/** Report whether the derived inputs contain the type-only sibling. */
function watchesTypeSibling(
  watched: readonly string[],
  project: ILinkedPluginProject,
): boolean {
  return watched.includes(path.resolve(project.types));
}

/**
 * Asserts a preamble plugin's declaration narrows the entry's watch inputs.
 *
 * `@ttsc/banner` prepends one text derived from `banner.config.*` to every
 * file, so nothing in a sibling's content can reach the output. Its declaration
 * (through `SourcePreamble`, the hook that never sees the Program) plus the
 * host's own syntactic printing is what lets the adapter drop the reference
 * closure — while the config file, being a host input, stays universal.
 */
export async function assertBannerNarrowsTheEntryWatchInputs(): Promise<void> {
  const project = createLinkedPluginProject(["banner"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `a banner-only project must not register the entry's type-only sibling; watched: ${watched.join(", ")}`,
  );
  assert.ok(
    watched.includes(path.resolve(path.join(project.root, "tsconfig.json"))),
    "the config chain stays universal for a file declared complete",
  );
  assert.ok(
    watched.includes(
      path.resolve(path.join(project.root, "banner.config.json")),
    ),
    "the plugin's own config remains a universal host input",
  );
}

/**
 * Asserts a program plugin can make the same declaration.
 *
 * `@ttsc/strip` removes statements matching configured patterns and reads
 * nothing else, so it declares from `ApplyProgram`. Pairing this with the
 * banner case pins both hooks the host counts as contributors.
 */
export async function assertStripNarrowsTheEntryWatchInputs(): Promise<void> {
  const project = createLinkedPluginProject(["strip"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `a strip-only project must not register the entry's type-only sibling; watched: ${watched.join(", ")}`,
  );
  // The same two assertions the banner case makes: a list that collapsed to
  // nothing would also drop the sibling, and would be a far worse bug.
  assert.ok(
    watched.includes(path.resolve(path.join(project.root, "tsconfig.json"))),
    "the config chain stays universal for a file declared complete",
  );
  assert.ok(
    watched.includes(
      path.resolve(path.join(project.root, "strip.config.json")),
    ),
    "the plugin's own config remains a universal host input",
  );
}

/**
 * Asserts a plugin that declares nothing keeps the host-owned bound.
 *
 * `@ttsc/paths` deliberately declares nothing: which source files the program
 * contains decides whether an alias target resolves, and the Checker decides
 * whether a bare `require` is the module loader. This is the negative twin of
 * the two cases above — the same fixture shape, the opposite verdict — and it
 * is also what pins that the narrowing comes from the declaration rather than
 * from the host stamping every linked-plugin envelope.
 */
export async function assertPathsKeepsTheHostOwnedBound(): Promise<void> {
  const project = createLinkedPluginProject(["paths"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    true,
    `a paths-only project must keep registering the entry's reference closure; watched: ${watched.join(", ")}`,
  );
}

/**
 * Asserts the aggregation rule over a composed plugin set.
 *
 * Completeness is per (plugin, file) and a consumer cannot attribute one
 * plugin's reported inputs back to it, so a file is complete only when every
 * contributing plugin declared it. A declaring plugin beside a silent one
 * therefore keeps the wider bound, not the narrower one.
 */
export async function assertComposedPluginsKeepTheWiderBound(): Promise<void> {
  const project = createLinkedPluginProject(["banner", "paths"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    true,
    `a declaring plugin beside a silent one must keep the union bound; watched: ${watched.join(", ")}`,
  );
}

/**
 * Asserts the declaration survives a compile through the generated tsconfig.
 *
 * Any bundler alias makes the adapter compile through a wrapper tsconfig in the
 * system temp directory, so the host's cwd is no longer the project root and
 * every envelope section — `typescript`, `graph`, and now
 * `dependenciesComplete` — is keyed as an absolute path instead of a
 * project-relative one. A declaration the consumer cannot join back to the file
 * it names would silently stop narrowing, which is invisible except as the cost
 * it was supposed to remove.
 */
export async function assertBannerNarrowsThroughTheAliasOverlay(): Promise<void> {
  const project = createLinkedPluginProject(["banner"]);
  const watched = await collectEntryWatchInputs(project, {
    "@lib": path.join(project.root, "src"),
  });

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `the declaration must survive the generated tsconfig's key convention; watched: ${watched.join(", ")}`,
  );
}
