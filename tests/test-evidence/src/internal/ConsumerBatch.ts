import type { IRunResult } from "./IRunResult";
import { consumerCases } from "./consumerCases";

/**
 * Assembles authored consumer configurations without changing their source
 * membership.
 *
 * The runtime root imports each original configuration, verifies its real
 * plugin export, and projects one original graph at a time. File rules remain
 * scoped to their original scene. Excluding the runtime root from the Program
 * prevents its imports from pulling deliberately excluded config files into
 * it.
 *
 * @evidence contracts/common.md#principled-implementation Original sources, options and assertion callbacks remain executable inputs; disjoint local and genuinely external roots plus one active original graph prevent neighboring scenes from granting coverage. Unrooted TypeScript references remain Program-only, package references retain actual top-level package resolution, and Swagger keeps its exact-file channel.
 * @evidence contracts/common.md#clear-and-simple-design One assembly owner returns project inputs and scene metadata; the real runtime config loads original config exports, while callers own the single check and collected assertions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operation never substitutes a compiler result or invokes assertion callbacks during assembly. Scoped results contain only real emitted diagnostic chunks and retain the actual cycle status. Independent graphs cannot be unioned because their shared alias space and Prisma parser would change the authored behavior.
 * @evidence contracts/common.md#meaningful-documentation Explains original Program membership, excluded runtime-root imports, distinct path channels and ownership of transported assertions.
 */
export namespace ConsumerBatch {
  /**
   * Names of authored scenes that originally required a successful compiler
   * verdict.
   */
  export const successNames = new Set([
    "swagger-outside",
    "central-exclusion-carriers",
    "overlapping-prisma-claims",
    "swagger-file",
    "typed-config",
    "selected-hosts-inactive",
    "prisma-graph",
    "hierarchical-targets",
    "root-markdown",
    "composed-graph",
    "prisma-carrier-confined",
    "repeated-positive-evidence",
    "markdown-checklist-accepted",
    "reference-policy-accepted",
    "link-import-scope",
    "readme-cite",
    "readme-configure",
    "readme-markdown-citation",
    "package-population-complete",
    "singular-declarations",
  ]);

  /**
   * Materializes immutable scenes and sequential graph settings for one
   * resident consumer.
   */
  export function assemble(
    succeeds: boolean,
    base: {
      files?: Record<string, string>;
      workspaceFiles?: Record<string, string>;
      include?: string[];
      claims?: readonly unknown[];
      previous?: string;
    } = {},
  ): {
    files: Record<string, string>;
    workspaceFiles: Record<string, string>;
    include: string[];
    lintConfig: string;
    previous?: string;
    scenes: readonly IScene[];
    phases: readonly { scene: IScene; lintConfig: string }[];
  } {
    const files = { ...base.files };
    const workspaceFiles = { ...base.workspaceFiles };
    const include = [...(base.include ?? [])];
    const scenes = consumerCases
      .filter((scenario) => successNames.has(scenario.props.name) === succeeds)
      .map((scenario) => ({
        scenario,
        local: "fixtures/" + scenario.props.name,
        external: "../external/" + scenario.props.name,
      }));
    const previous = base.previous;
    const write = (
      target: Record<string, string>,
      name: string,
      source: string,
    ): void => {
      if (target[name] !== undefined && target[name] !== source)
        throw new Error(
          "Consumer scenes have conflicting authored bytes at " + name,
        );
      target[name] = source;
    };
    for (const [index, scene] of scenes.entries()) {
      const { props } = scene.scenario;
      for (const [relative, source] of Object.entries(props.files))
        write(
          files,
          relative.startsWith("node_modules/")
            ? relative
            : scene.local + "/" + relative,
          source,
        );
      for (const [relative, source] of Object.entries(
        props.workspaceFiles ?? {},
      ))
        write(
          workspaceFiles,
          "external/" + props.name + "/" + relative,
          source,
        );
      write(files, scene.local + "/lint.config.ts", props.lintConfig);
      for (const pattern of props.include ?? ["src", "lint.config.ts"])
        include.push(scene.local + "/" + pattern);
      const scope = "consumer-scope-" + index + ".ts";
      files[scope] = [
        "import original from " +
          JSON.stringify("./" + scene.local + "/lint.config.js") +
          ";",
        "export default {",
        "files: " + JSON.stringify([scene.local + "/**"]) + ",",
        'rules: Object.fromEntries(Object.entries(original.rules).filter(([name]) => name !== "evidence/graph")),',
        "};",
      ].join("\n");
    }
    return {
      files,
      workspaceFiles,
      include,
      scenes,
      previous,
      phases: scenes.map((scene) => ({
        scene,
        lintConfig: graphPhase(
          scene.scenario.props.name,
          "./" + scene.local + "/lint.config.js",
          "consumer-scope-" + scenes.indexOf(scene) + ".ts",
        ),
      })),
      lintConfig: [
        'import publicDefault, { evidence } from "@ttsc/evidence";',
        ROOT_PROJECTION,
        "const claims: unknown[] = " + JSON.stringify(base.claims ?? []) + ";",
        'export default { plugins: { evidence }, rules: { "evidence/graph": ["error", { claims }] },' +
          (previous === undefined
            ? ""
            : " extends: " + JSON.stringify("./" + previous)) +
          " };",
      ].join("\n"),
    };
  }

  /**
   * Projects one actual original config, keeping project graph options
   * unscoped.
   */
  export function graphPhase(
    sceneName: string,
    originalModule: string,
    previous?: string,
  ): string {
    return [
      'import publicDefault, { evidence } from "@ttsc/evidence";',
      "import original from " + JSON.stringify(originalModule) + ";",
      ROOT_PROJECTION,
      "const config = record(original);",
      'if (![evidence, publicDefault].includes(record(config.plugins).evidence as typeof evidence)) throw new Error("The authored public plugin export differs");',
      'const setting = record(config.rules)["evidence/graph"];',
      'const graph = setting === undefined ? {} : { "evidence/graph": ["error", { claims: (record((setting as unknown[])[1]).claims as unknown[]).map((value, index) => claim(' +
        JSON.stringify(sceneName) +
        ", value, index)) }] };",
      "export default { plugins: { evidence }, rules: graph," +
        (previous === undefined
          ? ""
          : " extends: " + JSON.stringify("./" + previous)) +
        " };",
    ].join("\n");
  }

  /** Separates real compiler banners, including unanchored project diagnostics. */
  export function diagnostics(result: IRunResult): string[] {
    return result.output
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replaceAll("\\", "/")
      .split(
        /(?=^(?:[^\r\n]*(?:\(\d+,\d+\):|:\d+:\d+\s+-)\s*)?(?:error|warning)\s+TS\d+:)/m,
      );
  }

  /**
   * Runs every original assertion against that scene's genuinely emitted
   * findings.
   */
  export function verify(
    result: IRunResult,
    scenes: readonly IScene[],
    check: (assertion: () => void) => void,
  ): void {
    const chunks = diagnostics(result);
    for (const scene of scenes) {
      const selected = chunks.filter(
        (chunk) =>
          chunk.includes(scene.local + "/") ||
          chunk.includes(scene.external + "/") ||
          chunk.includes("('" + scene.scenario.props.name + ":"),
      );
      const scoped = { ...result, output: selected.join("\n") };
      if (!successNames.has(scene.scenario.props.name))
        check(() => {
          if (
            !selected.some((chunk) =>
              /^(?:[^\r\n]*(?:\(\d+,\d+\):|:\d+:\d+\s+-)\s*)?error\s+TS\d+:/m.test(
                chunk,
              ),
            )
          )
            throw new Error(
              "A negative scene must contribute its own actual error: " +
                scene.scenario.props.name +
                "\n" +
                result.output,
            );
        });
      const location = (original: string): string => {
        const relative = original.replace(/^at /, "");
        return (
          "at " +
          (relative.startsWith("../")
            ? scene.external + "/" + relative.slice(3)
            : scene.local + "/" + relative)
        );
      };
      scene.scenario.verify(scoped, check, location);
    }
  }
}

interface IScene {
  readonly scenario: (typeof consumerCases)[number];
  readonly local: string;
  readonly external: string;
}

/**
 * The real config loader executes this projection over original imported
 * exports.
 */
const ROOT_PROJECTION = `
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an authored configuration object");
  return value as Record<string, unknown>;
}
function root(scene: string, original: unknown = "."): string {
  if (typeof original !== "string") throw new Error("Expected an authored relative root");
  if (original === ".." || original.startsWith("../")) return "../external/" + scene + (original.length === 2 ? "" : "/" + original.slice(3));
  return "fixtures/" + scene + (original === "." ? "" : "/" + original);
}
function reference(scene: string, value: unknown): Record<string, unknown> {
  const item = record(value);
  if (item.type === "swagger") {
    if (typeof item.file !== "string") throw new Error("Expected an authored Swagger file or URL");
    return { ...item, file: /^https?:/.test(item.file) ? item.file : root(scene, item.file) };
  }
  if (item.type === "typescript" && item.root === undefined) {
    if (item.package !== undefined) return { ...item };
    const files = item.files;
    const prefix = (file: unknown): string => {
      if (typeof file !== "string") throw new Error("Expected an authored TypeScript glob");
      return "fixtures/" + scene + "/" + file;
    };
    return { ...item, files: Array.isArray(files) ? files.map(prefix) : prefix(files) };
  }
  return { ...item, root: root(scene, item.root) };
}
function claim(scene: string, value: unknown, index: number): Record<string, unknown> {
  const item = record(value);
  const refs = item.reference;
  return { ...item, root: root(scene, item.root), reference: Array.isArray(refs) ? refs.map((value) => reference(scene, value)) : reference(scene, refs) };
}
`;
