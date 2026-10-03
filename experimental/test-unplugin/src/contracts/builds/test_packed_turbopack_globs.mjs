import fs from "node:fs";
import path from "node:path";

/**
 * Runs the actual Turbopack matcher with instrumented rules and compares matched root, shallow and deep resources for all source extensions.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Runs the actual Turbopack matcher with instrumented rules and compares matched root, shallow and deep resources for all source extensions.
 * @evidence contracts/testing.md#independent-expectations
 *   The dedicated root, shallow and deep fixture resources form an independent expected set per declared extension. Measured supported allowlist entries are checked against Turbopack itself, including two scoped refusal counterexamples.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Project-wide rules must match the independently authored resource set; scoped and brace counterexamples must not be mistaken for complete coverage.
 * @evidence contracts/testing.md#execution-ownership
 *   The next phase calls this named matcher case after production output verification. Per-glob mismatch strings identify each failed matching expectation; unit glob decisions cannot replace this real matcher owner.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Our own glob predicate cannot certify Turbopack matching. A real upgrade may change matching while every unit remains green.
 * @evidence contracts/e2e.md#shared-execution
 *   All rule spellings share one probe build. This is separate from transformed-output builds because overlapping probe rules alter loader composition.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   All probe rules share one generated probe directory and build. Old probe files and dist-next are removed before matching; per-rule output directories separate observations, and successful measurement restores ordinary next.config.mjs.
 * @evidence contracts/e2e.md#preserved-coverage
 *   The complete former verifyTurbopackRecognisedGlobs body and all assertion arguments
 *   remain in this entry. Extraction adds no build or process; it provides an
 *   address for the retained boundary instead of an anonymous phase assertion.
 */
export function test_packed_turbopack_globs({ workspace, experimentRoot, TURBOPACK_SCOPED_GLOBS, run, installedTurbopackProjectWideGlobCoverage, writeNextConfig , assert }) {
    const coverage = installedTurbopackProjectWideGlobCoverage();
    const projectWideGlobs = coverage.map(([glob]) => glob);
    const globs = [...projectWideGlobs, ...TURBOPACK_SCOPED_GLOBS];
    const probeDirectory = path.join(experimentRoot, ".tmp", "turbopack-glob-probes");
    fs.rmSync(probeDirectory, { force: true, recursive: true });
    fs.mkdirSync(probeDirectory, { recursive: true });
    const probeLoader = path.join(workspace, "turbopack-glob-probe.cjs");
    const rules = globs.flatMap((glob, index) => [
        `        ${JSON.stringify(glob)}: {`,
        "          loaders: [{",
        `            loader: ${JSON.stringify(probeLoader)},`,
        `            options: { id: ${JSON.stringify(String(index))}, outputDirectory: ${JSON.stringify(probeDirectory)} },`,
        "          }],",
        "        },",
    ]);
    fs.writeFileSync(path.join(workspace, "next.config.mjs"), [
        'import withTtsc from "@ttsc/unplugin/next";',
        "",
        "export default withTtsc(",
        "  {",
        '    distDir: "dist-next",',
        "    typescript: {",
        "      ignoreBuildErrors: true,",
        "    },",
        "    turbopack: {",
        `      root: ${JSON.stringify(path.dirname(workspace))},`,
        "      rules: {",
        ...rules,
        "      },",
        "    },",
        "  },",
        "  {",
        '    project: "tsconfig.unplugin.json",',
        "  },",
        ");",
        "",
    ].join("\n"), "utf8");
    fs.rmSync(path.join(workspace, "dist-next"), {
        force: true,
        recursive: true,
    });
    run("npx next build --turbopack", workspace);
    const sourcePaths = new Map([
        [
            "ts",
            [
                path.join(workspace, "turbopack-root-entry.ts"),
                path.join(workspace, "src", "next-entry.ts"),
                path.join(workspace, "src", "deep", "nested", "turbopack-deep-entry.ts"),
            ],
        ],
        [
            "tsx",
            [
                path.join(workspace, "turbopack-root-entry.tsx"),
                path.join(workspace, "src", "turbopack-tsx-entry.tsx"),
                path.join(workspace, "src", "deep", "nested", "turbopack-deep-entry.tsx"),
            ],
        ],
        [
            "mts",
            [
                path.join(workspace, "turbopack-root-entry.mts"),
                path.join(workspace, "src", "turbopack-mts-entry.mts"),
                path.join(workspace, "src", "deep", "nested", "turbopack-deep-entry.mts"),
            ],
        ],
        [
            "cts",
            [
                path.join(workspace, "turbopack-root-entry.cts"),
                path.join(workspace, "src", "turbopack-cts-entry.cts"),
                path.join(workspace, "src", "deep", "nested", "turbopack-deep-entry.cts"),
            ],
        ],
    ]);
    const dedicatedSources = [...sourcePaths.values()].flat();
    const comparable = (file) => {
        const resolved = path.resolve(file);
        return process.platform === "win32" ? resolved.toLowerCase() : resolved;
    };
    const probeMatches = (index) => {
        const directory = path.join(probeDirectory, String(index));
        if (!fs.existsSync(directory))
            return new Set();
        return new Set(fs
            .readdirSync(directory)
            .map((file) => fs.readFileSync(path.join(directory, file), "utf8"))
            .map(comparable));
    };
    const mismatches = [];
    for (const [index, [glob, extensions]] of coverage.entries()) {
        const expected = extensions.flatMap((extension) => sourcePaths.get(extension) ?? []);
        const matches = probeMatches(index);
        const actual = dedicatedSources
            .filter((file) => matches.has(comparable(file)))
            .map(comparable)
            .sort();
        const wanted = expected.map(comparable).sort();
        if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
            mismatches.push(`${glob} expected ${JSON.stringify(wanted)} but matched ${JSON.stringify(actual)}`);
        }
    }
    for (const [offset, glob] of TURBOPACK_SCOPED_GLOBS.entries()) {
        const matches = probeMatches(projectWideGlobs.length + offset);
        const tsSources = sourcePaths.get("ts") ?? [];
        if (tsSources.every((file) => matches.has(comparable(file)))) {
            mismatches.push(`${glob} must remain refused because it covers every project-wide .ts source`);
        }
    }
    assert(mismatches.length === 0, `Turbopack glob coverage mismatches:\n${mismatches.join("\n")}`);
    writeNextConfig();
}
