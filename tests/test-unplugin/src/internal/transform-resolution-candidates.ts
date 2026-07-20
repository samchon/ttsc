import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TtscCompiler } from "ttsc";

type TransformEnvelope = ReturnType<TtscCompiler["transform"]>;

/**
 * Verifies a missing candidate preceding an already-resolved module target is
 * a project-cache and watch input. The compiler envelope is synthetic so the
 * test isolates the long-lived adapter cache: only the candidate is created
 * between the two calls, while the importer and tsconfig stay byte-identical.
 */
export async function assertTransformTracksSupersedingResolutionCandidates(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestProject.tmpdir("ttsc-unplugin-resolution-candidates-");
  const main = path.join(root, "src", "main.ts");
  const tsconfig = path.join(root, "tsconfig.json");
  const external = TestProject.tmpdir("ttsc-unplugin-resolution-external-");
  const candidate = path.join(external, "generated.ts");
  const source = "export const input = true;\n";
  fs.mkdirSync(path.dirname(main), { recursive: true });
  fs.writeFileSync(main, source, "utf8");
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({ compilerOptions: {}, files: ["src/main.ts"] }),
    "utf8",
  );

  const envelope = {
    diagnostics: [],
    dependenciesComplete: [main],
    graph: {
      candidates: { [main]: [candidate] },
      configs: [tsconfig],
      edges: {},
      globals: [],
    },
    type: "success",
    typescript: { [main]: "export const output = true;\n" },
  } as TransformEnvelope;
  const original = TtscCompiler.prototype.transform;
  let calls = 0;
  TtscCompiler.prototype.transform = () => {
    calls += 1;
    return envelope;
  };
  try {
    const cache = api.createTtscTransformCache();
    const watched: string[] = [];
    const options = api.resolveOptions({ project: tsconfig });
    const hooks = {
      addWatchFile: (file: string) => watched.push(file),
    };

    const first = await api.transformTtsc(
      main,
      source,
      options,
      undefined,
      cache,
      hooks,
    );
    assert.equal(first?.code, "export const output = true;\n");
    assert.equal(calls, 1);
    assert.ok(watched.includes(candidate));

    fs.writeFileSync(candidate, "export const winner = true;\n", "utf8");
    const second = await api.transformTtsc(
      main,
      source,
      options,
      undefined,
      cache,
      hooks,
    );
    assert.equal(second?.code, "export const output = true;\n");
    assert.equal(calls, 2);
  } finally {
    TtscCompiler.prototype.transform = original;
  }
}
