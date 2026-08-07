import fs from "node:fs";
import path from "node:path";

import { normalizeEvidenceBenchmarkOrigin } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkDashboard";
import { repositoryRoot } from "../internal/suiteRoot";

/**
 * Verifies the published origin is an `owner/name` a reader can resolve.
 *
 * Every cell carries the `benchmarkRevision` its launcher read from `HEAD`, and
 * a bare SHA resolves nowhere on its own, so the aggregate's `origin` is what
 * separates a cohort measured here from one vendored in. `coverage.json`
 * already states the same fact by hand as `samchon/lint-plugin-evidence`, so
 * the two artifacts have to answer in one vocabulary. A manifest value that
 * does not reduce to that shape yields nothing rather than being written down,
 * because an unresolvable string in a generated artifact is the failure the
 * field exists to prevent.
 *
 * 1. Assert every URL form a manifest declares reduces to `owner/name`.
 * 2. Assert the repository's own declared URL reduces, read from its manifest
 *    rather than copied, so a manifest edited into an unrecordable shape fails
 *    here instead of silently emptying the aggregate's origin.
 * 3. Assert a value that cannot reduce yields nothing rather than itself,
 *    including the profile URL that names an owner and no repository.
 */
export const test_benchmark_report_records_a_resolvable_origin_or_none =
  (): void => {
    // Step 1 and 2: the shapes a `repository.url` is written in, including the
    // one this repository's own root manifest declares.
    const resolvable: readonly (readonly [string, string])[] = [
      ["https://github.com/samchon/ttsc.git", "samchon/ttsc"],
      ["git+https://github.com/samchon/ttsc.git", "samchon/ttsc"],
      ["git@github.com:samchon/ttsc.git", "samchon/ttsc"],
      ["ssh://git@github.com/samchon/ttsc.git", "samchon/ttsc"],
      ["https://github.com/samchon/ttsc/", "samchon/ttsc"],
      ["  https://github.com/samchon/ttsc  ", "samchon/ttsc"],
      ["samchon/ttsc", "samchon/ttsc"],
      [
        "https://github.com/samchon/lint-plugin-evidence",
        "samchon/lint-plugin-evidence",
      ],
    ];
    for (const [url, expected] of resolvable) {
      const actual: string | undefined = normalizeEvidenceBenchmarkOrigin(url);
      if (actual !== expected)
        throw new Error(
          `"${url}" should record the origin ${expected}, recorded ${String(actual)}.`,
        );
    }

    // Step 2: the repository's own manifest, read rather than copied.
    const manifest: unknown = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    );
    const declared: unknown = (
      manifest as { repository?: { url?: unknown } | string } | null
    )?.repository;
    const url: unknown =
      typeof declared === "string"
        ? declared
        : (declared as { url?: unknown } | undefined)?.url;
    if (typeof url !== "string")
      throw new Error("The repository manifest declares no repository URL.");
    if (normalizeEvidenceBenchmarkOrigin(url) === undefined)
      throw new Error(
        `The repository's own \`repository.url\` (${url}) records no origin, so every aggregate this repository publishes would carry none.`,
      );

    // Step 3: anything that cannot reduce to `owner/name` records nothing. A
    // raw value here would be a string a reader cannot resolve, published as
    // though it were an attribution. The profile URL is the likeliest of them:
    // it names an owner and no repository, and taking its last two segments
    // would record the host as the owner.
    for (const candidate of [
      "",
      "   ",
      "ttsc",
      "/",
      "https://github.com/samchon",
      "https://example.com/a/b/c.git",
      ":x/y",
    ]) {
      const actual: string | undefined =
        normalizeEvidenceBenchmarkOrigin(candidate);
      if (actual !== undefined)
        throw new Error(
          `"${candidate}" does not name an owner and a repository, and recorded ${actual} instead of nothing.`,
        );
    }
  };
