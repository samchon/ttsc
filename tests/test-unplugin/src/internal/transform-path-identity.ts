import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TtscCompiler } from "ttsc";

type TransformEnvelope = ReturnType<TtscCompiler["transform"]>;

/** Create a minimal on-disk project without invoking the native compiler. */
function createPathIdentityProject(): {
  main: string;
  root: string;
  tsconfig: string;
  upper: string;
} {
  const root = TestProject.tmpdir("ttsc-unplugin-path-identity-");
  const source = path.join(root, "src");
  fs.mkdirSync(source, { recursive: true });
  const main = path.join(source, "main.ts");
  const upper = path.join(source, "Main.ts");
  fs.writeFileSync(main, "export const lower = 1;\n", "utf8");
  fs.writeFileSync(upper, "export const upper = 2;\n", "utf8");
  const tsconfig = path.join(root, "tsconfig.json");
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({ compilerOptions: {}, include: ["src"] }),
    "utf8",
  );
  return { main, root, tsconfig, upper };
}

/** Change exactly one path character's case without changing any other shape. */
function alternateCase(file: string): string {
  for (let index = 0; index < file.length; ++index) {
    const character = file[index]!;
    if (character >= "a" && character <= "z") {
      return `${file.slice(0, index)}${character.toUpperCase()}${file.slice(
        index + 1,
      )}`;
    }
    if (character >= "A" && character <= "Z") {
      return `${file.slice(0, index)}${character.toLowerCase()}${file.slice(
        index + 1,
      )}`;
    }
  }
  throw new Error(`Could not change path case: ${file}`);
}

/** Run a transform sequence with a synthetic compiler envelope. */
async function withEnvelope<T>(
  envelope: TransformEnvelope,
  body: (calls: () => number) => Promise<T>,
): Promise<T> {
  const original = TtscCompiler.prototype.transform;
  let calls = 0;
  TtscCompiler.prototype.transform = () => {
    calls += 1;
    return envelope;
  };
  try {
    return await body(() => calls);
  } finally {
    TtscCompiler.prototype.transform = original;
  }
}

/** Build one successful envelope with absolute, deliberately non-fast-path keys. */
function envelope(props: {
  config: string;
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  edges?: Record<string, string[]>;
  globals?: string[];
  typescript: Record<string, string>;
  volatile?: string[];
}): TransformEnvelope {
  const { config, edges, globals, ...result } = props;
  return {
    diagnostics: [],
    type: "success",
    ...result,
    graph: {
      configs: [config],
      edges: edges ?? {},
      globals: globals ?? [],
    },
  } as TransformEnvelope;
}

/**
 * Proves that a drive-letter or volume-case spelling difference still names one
 * module on a case-insensitive host throughout the transform/cache/watch path.
 */
async function assertCaseInsensitivePathIdentity(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const core = await import(TestUnpluginRuntime.libUrl("core/transform"));
  const project = createPathIdentityProject();
  const alternate = alternateCase(project.main);
  if (core.pathIdentityKey(project.main) !== core.pathIdentityKey(alternate)) {
    return;
  }

  const dependency = path.join(project.root, "outside", "dependency.d.ts");
  const dependencyAlternate = alternateCase(dependency);
  const edge = path.join(project.root, "outside", "edge.d.ts");
  const global = path.join(project.root, "outside", "global.d.ts");
  const watched: string[] = [];
  const transformed = envelope({
    config: project.tsconfig,
    dependencies: {
      [project.main]: [alternate, dependency, dependencyAlternate],
    },
    dependenciesComplete: [project.main],
    edges: { [project.main]: [edge] },
    globals: [global],
    typescript: { [project.main]: "export const transformed = true;\n" },
    volatile: [project.main],
  });

  await withEnvelope(transformed, async (calls) => {
    const result = await api.transformTtsc(
      `${alternate}?raw`,
      fs.readFileSync(project.main, "utf8"),
      api.resolveOptions({
        project: path.relative(process.cwd(), project.tsconfig),
      }),
      undefined,
      undefined,
      {
        addWatchFile: (file: string) => watched.push(file),
        markVolatile: () => watched.push("volatile"),
      },
    );
    assert.equal(result?.code, "export const transformed = true;\n");
    assert.equal(calls(), 1);
  });
  assert.deepEqual(
    watched.filter((entry) => entry !== "volatile").sort(),
    [dependency, edge, global, project.tsconfig].sort(),
  );
  assert.equal(watched.filter((entry) => entry === "volatile").length, 1);
  assert.equal(
    Object.keys(
      api.collectExternalInputHashes([dependency, dependencyAlternate]),
    ).length,
    1,
  );

  const completeWatched: string[] = [];
  const complete = envelope({
    config: project.tsconfig,
    dependencies: { [project.main]: [dependency] },
    dependenciesComplete: [project.main],
    edges: { [project.main]: [edge] },
    globals: [global],
    typescript: { [project.main]: "export const complete = true;\n" },
  });
  await withEnvelope(complete, async (calls) => {
    const cache = api.createTtscTransformCache();
    const options = api.resolveOptions({
      project: path.relative(process.cwd(), project.tsconfig),
    });
    const first = await api.transformTtsc(
      project.main,
      fs.readFileSync(project.main, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: (file: string) => completeWatched.push(file) },
    );
    const second = await api.transformTtsc(
      alternate,
      fs.readFileSync(project.main, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: (file: string) => completeWatched.push(file) },
    );
    assert.equal(first?.code, "export const complete = true;\n");
    assert.equal(second?.code, "export const complete = true;\n");
    assert.equal(calls(), 1);
  });
  assert.deepEqual(
    [...new Set(completeWatched)].sort(),
    [dependency, project.tsconfig].sort(),
  );
  assert.equal(
    core.pathIdentityKey(`${project.main}${path.sep}`),
    core.pathIdentityKey(project.main),
  );
  if (process.platform === "win32") {
    assert.equal(
      core.pathIdentityKey("\\\\server\\share\\src\\main.ts"),
      core.pathIdentityKey("\\\\SERVER\\share\\src\\main.ts"),
    );
  }
}

/**
 * Proves a case-sensitive host keeps two real, case-distinct modules separate.
 */
async function assertCaseSensitivePathIdentity(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const core = await import(TestUnpluginRuntime.libUrl("core/transform"));
  const project = createPathIdentityProject();
  if (
    core.pathIdentityKey(project.main) === core.pathIdentityKey(project.upper)
  ) {
    return;
  }

  const lowerDependency = path.join(project.root, "outside", "lower.d.ts");
  const upperDependency = path.join(project.root, "outside", "upper.d.ts");
  const lowerEdge = path.join(project.root, "outside", "lower-edge.d.ts");
  const upperEdge = path.join(project.root, "outside", "upper-edge.d.ts");
  const result = envelope({
    config: project.tsconfig,
    dependencies: {
      [project.main]: [lowerDependency],
      [project.upper]: [upperDependency],
    },
    edges: {
      [project.main]: [lowerEdge],
      [project.upper]: [upperEdge],
    },
    typescript: {
      [project.main]: "export const lowerOutput = true;\n",
      [project.upper]: "export const upperOutput = true;\n",
    },
  });
  const lowerWatched: string[] = [];
  const upperWatched: string[] = [];

  await withEnvelope(result, async (calls) => {
    const cache = api.createTtscTransformCache();
    const options = api.resolveOptions({ project: project.tsconfig });
    const lower = await api.transformTtsc(
      project.main,
      fs.readFileSync(project.main, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: (file: string) => lowerWatched.push(file) },
    );
    const upper = await api.transformTtsc(
      project.upper,
      fs.readFileSync(project.upper, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: (file: string) => upperWatched.push(file) },
    );
    assert.equal(lower?.code, "export const lowerOutput = true;\n");
    assert.equal(upper?.code, "export const upperOutput = true;\n");
    assert.equal(calls(), 2);
  });
  assert.deepEqual(lowerWatched.sort(), [lowerDependency, lowerEdge].sort());
  assert.deepEqual(upperWatched.sort(), [upperDependency, upperEdge].sort());
  assert.equal(
    Object.keys(
      api.collectExternalInputHashes([lowerDependency, upperDependency]),
    ).length,
    2,
  );
}

/** Run the host-appropriate half of the path identity invariant. */
export async function assertTransformUsesFilesystemPathIdentity(): Promise<void> {
  await assertCaseInsensitivePathIdentity();
  await assertCaseSensitivePathIdentity();
}
