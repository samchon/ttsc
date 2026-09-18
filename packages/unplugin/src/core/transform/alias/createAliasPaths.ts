import path from "node:path";

import { normalizePath } from "../filesystem/normalizePath";
import { normalizeAliases } from "./normalizeAliases";

/**
 * Convert bundler aliases into absolute `paths` mappings.
 *
 * Targets are written as absolute paths on purpose: the generated tsconfig
 * lives in a system temp directory, where TypeScript-Go would reject bare
 * relative targets (TS5090) and anchor `./`-style ones at the wrong directory.
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
    const target = normalizePath(
      path.isAbsolute(alias.replacement)
        ? alias.replacement
        : path.resolve(process.cwd(), alias.replacement),
    );
    paths[key] = [target];
    paths[`${key}/*`] = [`${target}/*`];
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
 * Only the wildcard form reaches here. Every entry it names was written by the
 * user, because nothing injects one; the `RegExp` form is left to the
 * documentation precisely because Vite does inject those, and
 * {@link createAliasPaths} carries that measurement.
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
