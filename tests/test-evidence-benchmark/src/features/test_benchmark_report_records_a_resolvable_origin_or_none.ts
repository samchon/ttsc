import { normalizeEvidenceBenchmarkOrigin } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkDashboard";

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
 * 2. Assert the repository's own declared URL is among them.
 * 3. Assert a value that cannot reduce yields nothing rather than itself.
 */
export const test_benchmark_report_records_a_resolvable_origin_or_none =
  (): void => {
    // Step 1 and 2: the shapes a `repository.url` is written in, including the
    // one this repository's own root manifest declares.
    const resolvable: readonly (readonly [string, string])[] = [
      ["https://github.com/samchon/ttsc", "samchon/ttsc"],
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

    // Step 3: anything that cannot reduce to `owner/name` records nothing. A
    // raw value here would be a string a reader cannot resolve, published as
    // though it were an attribution.
    for (const url of ["", "   ", "ttsc", "/"]) {
      const actual: string | undefined = normalizeEvidenceBenchmarkOrigin(url);
      if (actual !== undefined)
        throw new Error(
          `"${url}" does not name an owner and a repository, and recorded ${actual} instead of nothing.`,
        );
    }
  };
