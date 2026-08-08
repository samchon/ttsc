import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

import type { EvidenceBenchmarkArm } from "../../../../benchmarks/evidence/src/typings/EvidenceBenchmarkArm";
import type { IBenchmarkWorkspace } from "../internal/IBenchmarkWorkspace";
import { acquireBenchmarkWorkspace } from "../internal/benchmarkWorkspace";
import { benchmarkRoot, repositoryRoot } from "../internal/suiteRoot";

/**
 * Verifies both delivered workspaces resolve this repository's own packages
 * from the archives beside them instead of from the registry.
 *
 * This repository publishes the compiler a measured cell runs. The template
 * asks for `ttsc`, `@ttsc/lint`, and `@ttsc/unplugin` through its catalog, and
 * a catalog resolves them the only way a catalog can — from npm, at whatever
 * the last release contains. A cell that installed those would compile, lint,
 * and build against a published version while its report described the tree
 * under test, and a fix or a regression on the branch would reach nothing the
 * cell ran. Preparation therefore packs each one and overrides its name to the
 * local archive.
 *
 * Nothing about that failure is visible from a passing gate. The workspace
 * builds, lints, and tests exactly as well against the published compiler, so
 * the only place the difference is legible is the delivered workspace file and
 * the lockfile pnpm wrote from it. That is what this case reads.
 *
 * 1. Assert the arm was prepared with a toolchain at all, and that it covers the
 *    platform package `ttsc` takes its native binary from.
 * 2. Assert each archive arrived under `.benchmark-deps/` with the packed bytes.
 * 3. Assert the delivered `overrides` binds every packed name to its archive
 *    without dropping the overrides the template already declared.
 * 4. Assert no package this repository publishes is declared anywhere in the
 *    delivered tree without a local binding.
 * 5. Assert the lockfile records every one of those names resolved from a `file:`
 *    tarball and from no registry version.
 */
export const test_benchmark_workspace_resolves_the_packed_toolchain =
  async (): Promise<void> => {
    for (const arm of ["plain", "evidence"] as const) {
      const workspace: IBenchmarkWorkspace =
        await acquireBenchmarkWorkspace(arm);
      assertToolchainCoversTheCompiler(workspace);
      assertArchivesDelivered(workspace);
      const bound: Map<string, string> = assertOverridesBindArchives(workspace);
      assertNothingPublishedHereResolvesRemotely(workspace, bound);
      assertLockfileRecordsTheArchives(workspace);
    }
  };

/**
 * Fails when the arm was prepared with no toolchain, or without the binary.
 *
 * An empty set is the shape every later assertion in this case passes
 * vacuously, so it is refused first. The platform package is checked separately
 * because it is the one member no manifest in the delivered workspace names:
 * `ttsc` takes its native Go compiler from it as an optional dependency, and
 * packing `ttsc` alone would drive a published compiler binary from a locally
 * built JavaScript wrapper — a pairing that exists nowhere else and measures
 * neither side, while every gate still exits zero.
 *
 * Which platform package that is comes from `packages/ttsc`'s own optional
 * dependencies rather than from a name spelled here, so the assertion holds on
 * whatever machine runs the suite.
 */
const assertToolchainCoversTheCompiler = (
  workspace: IBenchmarkWorkspace,
): void => {
  const names: string[] = workspace.toolchain.map((artifact) => artifact.name);
  if (!names.includes("ttsc"))
    throw new Error(
      `The ${describe(workspace.arm)} arm was prepared without a locally packed \`ttsc\`, so every gate it runs is the last published compiler rather than this tree. Packed: ${names.join(", ") || "(nothing)"}.`,
    );
  const platforms: string[] = Object.keys(
    readManifest(path.join(repositoryRoot, "packages", "ttsc", "package.json"))
      .optionalDependencies ?? {},
  );
  if (platforms.length === 0)
    throw new Error(
      "`packages/ttsc` declares no optional platform dependency, so this case can no longer tell which package carries the native compiler binary.",
    );
  const carried: string[] = platforms.filter((name) => names.includes(name));
  if (carried.length !== 1)
    throw new Error(
      `The ${describe(workspace.arm)} arm must pack exactly the one platform package \`ttsc\` loads its native compiler from, but it packed ${String(carried.length)} of them. A locally built wrapper in front of a published compiler binary is a pairing that exists nowhere else, and every gate passes on it.\n\nDeclared by ttsc: ${platforms.join(", ")}\nPacked: ${names.join(", ")}`,
    );
};

/**
 * Fails unless every packed archive reached `.benchmark-deps/` unchanged.
 *
 * The override names a path, and a path that names nothing is an install that
 * falls back to the registry. Bytes are compared rather than existence: the
 * copy is keyed on base name, so two artifacts whose directories share one
 * would otherwise deliver one package's contents under the other's name.
 */
const assertArchivesDelivered = (workspace: IBenchmarkWorkspace): void => {
  for (const artifact of workspace.toolchain) {
    const delivered: string = path.join(
      workspace.workspace,
      ".benchmark-deps",
      path.basename(artifact.archive),
    );
    if (!fs.existsSync(delivered))
      throw new Error(
        `The ${describe(workspace.arm)} arm binds \`${artifact.name}\` to ${delivered}, which the delivered workspace does not carry. The install falls back to the registry and the cell measures a published release.`,
      );
    if (!fs.readFileSync(delivered).equals(fs.readFileSync(artifact.archive)))
      throw new Error(
        `The archive delivered for \`${artifact.name}\` at ${delivered} is not the one that was packed from ${artifact.archive}. One package's bytes are installed under another's name, and the digest a launch pins still matches the file it wrote.`,
      );
  }
};

/**
 * Reads the delivered `overrides` and holds it to binding every packed name.
 *
 * The binding lands in `overrides` rather than in the catalog because pnpm
 * rejects a `file:` entry inside a catalog and because the platform package
 * appears in no catalog at all. It is written by text insertion into a document
 * whose anchors and comments must survive, so this parses the delivered file
 * back and asserts on the mapping rather than on the insertion.
 *
 * The template's own overrides are asserted to have survived, read from the
 * template rather than named here. An insertion that replaced the mapping
 * instead of extending it would leave a workspace that installs a different
 * `better-sqlite3` than the one the template pinned to keep it installable, and
 * the failure would surface as a native build error nowhere near this file.
 *
 * @returns Every override the delivered workspace declares.
 */
const assertOverridesBindArchives = (
  workspace: IBenchmarkWorkspace,
): Map<string, string> => {
  const delivered: Map<string, string> = readOverrides(
    path.join(workspace.workspace, "pnpm-workspace.yaml"),
  );
  for (const artifact of workspace.toolchain) {
    const expected = `file:.benchmark-deps/${path.basename(artifact.archive)}`;
    const actual: string | undefined = delivered.get(artifact.name);
    if (actual !== expected)
      throw new Error(
        `The ${describe(workspace.arm)} arm must override \`${artifact.name}\` to its local archive, so the name resolves to the tree under test rather than to whatever the registry serves.\n\nExpected: ${expected}\nFound: ${String(actual)}`,
      );
  }
  const template: Map<string, string> = readOverrides(
    path.join(benchmarkRoot, "template", "base", "pnpm-workspace.yaml"),
  );
  for (const [name, version] of template)
    if (delivered.get(name) !== version)
      throw new Error(
        `The template overrides \`${name}\` to ${version}, and the delivered ${describe(workspace.arm)} workspace no longer does. Binding the toolchain extends that mapping; it does not replace it.\n\nFound: ${String(delivered.get(name))}`,
      );
  return delivered;
};

/**
 * Fails when the delivered tree asks for a package this repository publishes
 * and nothing binds it locally.
 *
 * The packed set is the answer to a question the template asks, and the
 * template is free to ask a different one: a package that starts depending on
 * another of this repository's publications binds to the registry the moment it
 * is added, silently, because that dependency resolves perfectly well. So the
 * property is stated from the delivered manifests rather than from the packed
 * list — every name in the intersection has to be bound, by an override or by
 * the `file:` specifier the manifest itself carries, which is how the Evidence
 * plugin arrives.
 *
 * The intersection is required to be non-empty. A delivered workspace that
 * named none of this repository's packages would satisfy the rule while
 * measuring a toolchain nobody in this repository built.
 */
const assertNothingPublishedHereResolvesRemotely = (
  workspace: IBenchmarkWorkspace,
  overrides: ReadonlyMap<string, string>,
): void => {
  const published: Set<string> = publishedPackageNames();
  const remote: string[] = [];
  let intersecting = 0;
  for (const manifest of deliveredManifests(workspace.workspace))
    for (const [name, specifier] of declaredDependencies(manifest)) {
      if (!published.has(name)) continue;
      ++intersecting;
      const binding: string = overrides.get(name) ?? specifier;
      if (!binding.startsWith("file:.benchmark-deps/"))
        remote.push(
          `${path.relative(workspace.workspace, manifest)} asks for ${name} as ${binding}`,
        );
    }
  if (intersecting === 0)
    throw new Error(
      `No manifest in the delivered ${describe(workspace.arm)} workspace names a package this repository publishes. Either the template stopped depending on this compiler, or this case is no longer reading the manifests.`,
    );
  if (remote.length !== 0)
    throw new Error(
      `The delivered ${describe(workspace.arm)} workspace resolves a package this repository publishes from somewhere other than a local archive, so a cell would measure a published release while its report described this tree:\n${remote.join("\n")}`,
    );
};

/**
 * Fails unless the package manager recorded every packed name as a `file:`
 * resolution.
 *
 * The override and the archive together are only an instruction. What a cell
 * actually installs is what pnpm resolved, and the lockfile is where that is
 * written down: an override the install ignored, a name it resolved twice, or a
 * transitive edge that reached the registry anyway all read the same from the
 * workspace file and differently from here. The platform package is reachable
 * from nowhere else — no manifest in the workspace declares it — so this is the
 * only assertion that proves the native compiler binary was installed locally
 * at all.
 *
 * Every entry for a packed name is required to be a `file:` one, not merely one
 * of them, and at least one entry is required to exist. A name resolved to both
 * an archive and a released version installs both.
 */
const assertLockfileRecordsTheArchives = (
  workspace: IBenchmarkWorkspace,
): void => {
  const file: string = path.join(workspace.workspace, "pnpm-lock.yaml");
  if (!fs.existsSync(file))
    throw new Error(
      `The prepared ${describe(workspace.arm)} workspace has no lockfile at ${file}, so nothing records what its install resolved.`,
    );
  const parsed: unknown = YAML.parse(fs.readFileSync(file, "utf8"));
  const packages: unknown =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).packages
      : undefined;
  if (typeof packages !== "object" || packages === null)
    throw new Error(
      `${file} declares no \`packages\` section, so this case can no longer read what the install resolved. Either the lockfile format moved, or the install resolved nothing.`,
    );
  for (const artifact of workspace.toolchain) {
    const resolved: string[] = Object.keys(packages)
      .filter((key) => lockfilePackageName(key) === artifact.name)
      .map((key) => key.slice(artifact.name.length + 1));
    if (resolved.length === 0)
      throw new Error(
        `${file} records no resolution for \`${artifact.name}\`, which the ${describe(workspace.arm)} arm packed and overrode. An override the install never applied leaves the name to the registry.`,
      );
    const remote: string[] = resolved.filter(
      (version) => !version.startsWith("file:"),
    );
    if (remote.length !== 0)
      throw new Error(
        `${file} resolves \`${artifact.name}\` from outside the delivered archives, so the ${describe(workspace.arm)} arm installs a published release rather than this tree.\n\nResolved as: ${resolved.join(", ")}`,
      );
  }
};

/**
 * Splits a lockfile key such as `@ttsc/lint@file:...` into its package name.
 *
 * The version half of the key is arbitrary text — a `file:` path, a range, or a
 * range with a peer suffix in parentheses — so the name is read from the front
 * rather than by looking for the last separator, which a peer suffix carries
 * one of.
 */
const lockfilePackageName = (key: string): string => {
  const separator: number = key.indexOf("@", key.startsWith("@") ? 1 : 0);
  return separator === -1 ? key : key.slice(0, separator);
};

/** Every package name this repository publishes from `packages/`. */
const publishedPackageNames = (): Set<string> => {
  const root: string = path.join(repositoryRoot, "packages");
  const found = new Set<string>();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const location: string = path.join(root, entry.name, "package.json");
    if (!fs.existsSync(location)) continue;
    const manifest = readManifest(location);
    if (manifest.private !== true && typeof manifest.name === "string")
      found.add(manifest.name);
  }
  if (found.size === 0)
    throw new Error(
      `No package under ${root} publishes a name, so this case cannot tell which dependencies the delivered workspace must bind locally.`,
    );
  return found;
};

/**
 * The delivered workspace's root manifest and every member manifest it lists.
 *
 * The members come from the delivered `pnpm-workspace.yaml` rather than from a
 * walk of the tree. By the time this case runs the tree also holds a package
 * manager's store, a Vite cache, and generated build output, each of which
 * carries manifests that belong to no one here. An entry shape this cannot
 * expand throws rather than being skipped: a member silently dropped is a
 * member whose dependencies stop being checked.
 */
const deliveredManifests = (workspace: string): string[] => {
  const parsed: unknown = YAML.parse(
    fs.readFileSync(path.join(workspace, "pnpm-workspace.yaml"), "utf8"),
  );
  const declared: unknown =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).packages
      : undefined;
  if (!Array.isArray(declared) || declared.length === 0)
    throw new Error(
      `The delivered ${workspace} lists no workspace package, so this case has no manifest to read.`,
    );
  const found: string[] = [path.join(workspace, "package.json")];
  for (const entry of declared) {
    if (typeof entry !== "string" || entry.includes("**"))
      throw new Error(
        `The delivered workspace lists a member this case cannot expand: ${String(entry)}.`,
      );
    const directories: string[] = entry.endsWith("/*")
      ? fs
          .readdirSync(path.join(workspace, ...entry.slice(0, -2).split("/")), {
            withFileTypes: true,
          })
          .filter((child) => child.isDirectory())
          .map((child) => path.join(child.parentPath, child.name))
      : [path.join(workspace, ...entry.split("/"))];
    for (const directory of directories) {
      const location: string = path.join(directory, "package.json");
      if (!fs.existsSync(location))
        throw new Error(
          `The delivered workspace lists ${entry}, which carries no manifest at ${location}.`,
        );
      found.push(location);
    }
  }
  return found;
};

/** Every dependency of one manifest, whatever group declares it. */
const declaredDependencies = (manifest: string): [string, string][] => {
  const parsed = readManifest(manifest);
  const found: [string, string][] = [];
  for (const group of [
    parsed.dependencies,
    parsed.devDependencies,
    parsed.optionalDependencies,
    parsed.peerDependencies,
  ])
    for (const [name, specifier] of Object.entries(group ?? {}))
      if (typeof specifier === "string") found.push([name, specifier]);
  return found;
};

/**
 * Every override one workspace file declares.
 *
 * A non-string entry throws rather than being skipped. An override written
 * unquoted can parse as a number or a date, and dropping it here would compare
 * the delivered mapping against a template mapping that quietly lost the same
 * entry — two narrowed sets agreeing with each other.
 */
const readOverrides = (file: string): Map<string, string> => {
  const parsed: unknown = YAML.parse(fs.readFileSync(file, "utf8"));
  const overrides: unknown =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).overrides
      : undefined;
  if (typeof overrides !== "object" || overrides === null)
    throw new Error(`${file} declares no \`overrides\` mapping.`);
  const found = new Map<string, string>();
  for (const [name, version] of Object.entries(
    overrides as Record<string, unknown>,
  )) {
    if (typeof version !== "string")
      throw new Error(
        `${file} overrides \`${name}\` with a non-string entry this case cannot compare: ${String(version)}.`,
      );
    found.set(name, version);
  }
  return found;
};

interface IManifest {
  readonly name?: unknown;
  readonly private?: unknown;
  readonly dependencies?: Record<string, unknown>;
  readonly devDependencies?: Record<string, unknown>;
  readonly optionalDependencies?: Record<string, unknown>;
  readonly peerDependencies?: Record<string, unknown>;
}

const readManifest = (file: string): IManifest =>
  JSON.parse(fs.readFileSync(file, "utf8")) as IManifest;

const describe = (arm: EvidenceBenchmarkArm): string =>
  arm === "plain" ? "Plain" : "Evidence";
