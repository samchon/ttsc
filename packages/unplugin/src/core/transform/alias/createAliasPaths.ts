import path from "node:path";

import { normalizePath } from "../filesystem/normalizePath";
import { pathIsWithin } from "../filesystem/pathIsWithin";
import { normalizeAliases } from "./normalizeAliases";

/**
 * Convert bundler aliases into absolute `paths` mappings, in the meaning Vite
 * gives each replacement (samchon/ttsc#1399).
 *
 * Targets are written as absolute paths on purpose: the generated tsconfig
 * lives in a system temp directory, where TypeScript-Go would reject bare
 * relative targets (TS5090) and anchor `./`-style ones at the wrong directory.
 *
 * Vite substitutes the replacement into the specifier and resolves the result:
 *
 * - A replacement with a leading `/` that is not already below the root, such as
 *   `"/src"`, is tried against the Vite root first and only then as an absolute
 *   path. Both targets are listed in that order, since `paths` tries its
 *   targets in order too. Reading it as absolute alone sent every `@/...`
 *   import to the filesystem root, or on Windows to the drive root, and the
 *   overlay then overrode the project's own correct `paths` entry.
 * - Any other absolute replacement means itself.
 * - A relative replacement is resolved against each importing module, and a bare
 *   one as a package. `paths` can express neither, so each is reported once and
 *   not forwarded, leaving the tsconfig's own mapping in force.
 */
export function createAliasPaths(aliases: unknown): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
  for (const alias of normalizeAliases(aliases)) {
    if (typeof alias.find !== "string") {
      // Vite's array form accepts a `RegExp` find, and `{ find: /^~/ }` is a
      // common way to spell a prefix alias. A tsconfig `paths` map has no
      // regular-expression form, so there is nothing to translate it into
      // (samchon/ttsc#1315). Reducing the simple prefix cases to a string is
      // possible in principle and deliberately not done: telling `/^~/` from
      // `/^~(?=\/)/` or `/^@app/` — which matches `@apple` too — means
      // implementing enough of a regular-expression engine that a wrong
      // reduction becomes likely, and a mistranslated alias resolves imports to
      // the wrong file silently, which is worse than not forwarding it.
      //
      // Not reported, unlike the wildcard below, and that asymmetry is the
      // whole point: Vite merges two `RegExp` aliases of its own into every
      // resolved config, `/^\/?@vite\/env/` and `/^\/?@vite\/client/`. Measured
      // on a bare project with no user aliases at all, `resolve.alias` has
      // exactly those two entries under both `serve` and `build`, so a report
      // on this form would fire twice for every Vite user in every build, name
      // aliases they never wrote, and say nothing about their configuration.
      // A diagnostic that cannot distinguish the user's input from the host's
      // is noise, and noise is what teaches people to stop reading the channel
      // the out-of-program report depends on. The documentation carries this
      // form instead, in both README and guide.
      continue;
    }
    if (alias.find.length === 0) {
      continue;
    }
    if (alias.find.includes("*")) {
      // A `paths` key reads `*` as its own wildcard, so forwarding a `find`
      // that already contains one cannot preserve the caller's meaning.
      reportUntranslatableAlias(
        JSON.stringify(alias.find),
        'a "paths" key already reads "*" as its own wildcard',
      );
      continue;
    }
    const key = alias.find.replace(/\/+$/, "");
    if (key.length === 0) {
      continue;
    }
    const replacement = alias.replacement;
    let targets: string[];
    // Vite's root-relative test is a leading `/`, exactly as `vite:resolve`
    // checks `id[0] === "/"`; a `//` prefix is a UNC-style absolute path.
    if (replacement.startsWith("/") && !replacement.startsWith("//")) {
      const root = path.resolve(alias.root ?? process.cwd());
      const absolute = path.resolve(replacement);
      targets = pathIsWithin(absolute, root)
        ? [absolute]
        : [path.join(root, replacement.slice(1)), absolute];
    } else if (path.isAbsolute(replacement)) {
      targets = [replacement];
    } else {
      reportUntranslatableAlias(
        JSON.stringify(alias.find),
        replacement.startsWith(".")
          ? `its replacement ${JSON.stringify(replacement)} is relative, which Vite resolves against each importing module`
          : `its replacement ${JSON.stringify(replacement)} is not a path, which Vite resolves as a package`,
      );
      continue;
    }
    const normalized = targets.map((target) => normalizePath(target));
    paths[key] = normalized;
    paths[`${key}/*`] = normalized.map((target) => `${target}/*`);
  }
  return paths;
}

/**
 * Alias descriptions already reported in this process.
 *
 * The message is about configuration rather than about a module:
 * `resolve.alias` is resolved once and then consulted on every delivery, so
 * reporting per delivery would repeat one statement about the config for every
 * file in the bundle. Keyed by the description, so a Vite dev server that
 * reloads its config reports again only when the alias itself changed.
 */
const REPORTED_UNTRANSLATABLE_ALIASES = new Set<string>();

/**
 * Tell the user once that an alias they declared is not reaching the compile.
 *
 * A dropped alias is not silent in its consequence — the compile resolves
 * through the tsconfig's own `paths`, and a module that resolves for the
 * bundler but not for the compiler surfaces as the out-of-program report
 * (samchon/ttsc#1308) — but that report names the module, not the alias, so the
 * user cannot learn from it that a configuration they wrote was ignored.
 *
 * The wildcard form and relative or bare replacements reach here. Every entry
 * it names was written by the user or the user's framework, because Vite
 * injects none of them; the `RegExp` form is left to the documentation
 * precisely because Vite does inject those, and {@link createAliasPaths} carries
 * that measurement.
 */
function reportUntranslatableAlias(description: string, reason: string): void {
  if (REPORTED_UNTRANSLATABLE_ALIASES.has(description)) {
    return;
  }
  REPORTED_UNTRANSLATABLE_ALIASES.add(description);
  process.stderr.write(
    `ttsc: the Vite alias ${description} was not forwarded to the compile, because ${reason}. Declare it in your tsconfig's "paths" if ttsc must resolve through it.\n`,
  );
}
