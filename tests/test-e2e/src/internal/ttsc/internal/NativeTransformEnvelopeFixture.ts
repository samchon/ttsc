import { FixtureFiles } from "../../FixtureFiles";
/** Wire inputs shared by decoder units and the real Go transport batch. */
export namespace NativeTransformEnvelopeFixture {
  export const valid = {
    typescript: FixtureFiles.read("ttsc/NativeTransformEnvelopeFixture/inputs-1"),
    dependencies: { "src/main.ts": ["src/consulted.d.ts"] },
    dependenciesComplete: ["src/main.ts"],
    graph: {
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    },
    volatile: ["src/volatile.ts"],
  };

  export const malformedAdvisory = {
    typescript: FixtureFiles.read("ttsc/NativeTransformEnvelopeFixture/inputs-2"),
    sourceMaps: {
      "src/main.ts": { version: 3, file: "main.ts", sources: ["main.ts"], sourcesContent: ["export const value = 1\n"], names: [], mappings: "AAAA" },
      "src/extra.ts": { version: 2, sources: ["extra.ts"], names: [], mappings: "" },
      "src/elsewhere.ts": { version: 3, sources: ["elsewhere.ts"], names: [], mappings: "" },
    },
    graph: {
      edges: { "": [], "src/main.ts": ["src/good.d.ts"], "src/bad.ts": "not-a-list", "src/worse.ts": [1, 2] },
      globals: "not-a-list",
      configs: ["tsconfig.json", 42],
      inputHashes: { "src/good.d.ts": "a".repeat(64), "src/missing.d.ts": null, "src/bad.d.ts": "not-a-hash", "": null },
      inputObservations: { "src/good.d.ts": { fileExists: true }, "src/missing.d.ts": { fileExists: false, directoryExists: true }, "src/bad.d.ts": { fileExists: "not-a-boolean" }, "src/worse.d.ts": { fileExists: true, directoryExists: true } },
      inputProofFailures: { "src/missing.d.ts": "content-unavailable", "src/bad.d.ts": "NOT SAFE", "src/worse.d.ts": 42, "": "unobserved" },
      inputRealpaths: { "src/good.d.ts": null, "src/missing.d.ts": null, "src/bad.d.ts": "relative/path", "": null },
    },
    dependenciesComplete: ["src/main.ts", 42, ""],
    volatile: { not: "a-list" },
  };

  export const missingSource = { output: FixtureFiles.read("ttsc/NativeTransformEnvelopeFixture/inputs-3") };
  export const arraySource = { typescript: ["not-a-source-map"] };
  export const resolutionCandidates = {
    typescript: FixtureFiles.read("ttsc/NativeTransformEnvelopeFixture/inputs-4"),
    graph: {
      candidates: { "src/main.ts": ["src/mytype.ts", "src/mytype.tsx"] },
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    },
  };
}
