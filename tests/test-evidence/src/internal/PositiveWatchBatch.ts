import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { positiveWatchCases } from "./positiveWatchCases";
import { FIRST_BUILD_TIMEOUT, assertStatus, createProject, privatizeLibrary, startWatch, type IRunResult, type ITtscEvidenceProject } from "./index";
import type { ICreateProjectProps } from "./ICreateProjectProps";

/**
 * Owns one real positive watcher and its independently checked mutation phases.
 *
 * Original fixture corpora activate sequentially at their original primary roots.
 * Config and source-topology changes legitimately reload the Program; Markdown-only
 * residency is measured within its phase. Staged keeps its first position and name;
 * changed parser capability is isolated in a detached private Evidence library.
 *
 * @evidence contracts/common.md#principled-implementation Original primary graph settings, compiler options, include populations and authored mutation bytes exercise the same actual watcher; an independent canonical cold check keeps identical physical inputs. Plain default consumer configs remain plain, typed named consumers retain their public type checks, and file-qualified links retain their original primary/sibling layout.
 * @evidence contracts/common.md#clear-and-simple-design One owner prepares the consumer/library, exposes mutation and settled-cycle operations, collects phase/assertion failures and independently joins watcher and fixture cleanup before throwing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No result, PID, count, cache proof, source identity or watcher is replaced. The canonical live producer is selected from startup to preserve the original cold exception without package-junction changes; real library deletion occurs only after verified detachment.
 * @evidence contracts/common.md#meaningful-documentation Explains first-claim identity, same-directory cold oracle, bounded settle/reset behavior, config-driven Program reloads and final irreversible private loader revocation.
 * @evidence contracts/performance.md#efficient-algorithms Activation visits the previous and next finite authored file maps once, mutation resets read only tracked changed paths, and settling examines at most eight real cycles per request. Empty owned directories remain until final cleanup rather than recursively scanning each transition.
 * @evidence contracts/performance.md#reuse-equivalent-work Watch consumers share one canonical producer, workspace and watcher lifetime. Original source/config/include populations change only at genuine phase boundaries and may reload Programs; the three identical Alpha cases retain one phase Program, one necessary fresh cold Program remains, and one private parser-library copy serves both last-phase cache controls with independent original source filters.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One workspace, private library and native watcher remain until all phases finish. Watch closure and strict project cleanup are independently attempted; failures aggregate rather than report successful release. Session transcript retention belongs to startWatch.
 * @evidence contracts/portability.md#os-neutral-implementation Native path APIs construct exact owned roots, existing helpers own junction detachment and Node process execution, and source/protocol literals remain platform-neutral. Physical ancestor targets stay outside compiler project membership.
 */
export namespace PositiveWatchBatch {
  /** Executes one real watcher and preserves each original case's failure identity. */
  export async function run(): Promise<void> {
    const failures: unknown[] = [];
    const check = (assertion: () => void): void => { try { assertion(); } catch (error) { failures.push(error); } };
    let project: ITtscEvidenceProject | undefined;
    let watcher: ReturnType<typeof startWatch> | undefined;
    try {
      const authored = watchScenes();
      // The default canonical workspace producer is the original cold oracle's
      // producer. Keeping it from startup preserves same-root identity.
      project = createProject({ ...authored[0].props, name: "positive-watch-batch" });
      const owned = project;
      const library = privatizeLibrary(owned.directory);
      assert.ok(!fs.lstatSync(library).isSymbolicLink(), "Loader revocation requires an actual detached private directory.");
      watcher = startWatch(owned.directory, { diagnostics: true });
      const session = watcher;
      console.log("Positive watch owned workspace: " + owned.workspace + "; private library: " + library);
      const next = async (status: number, marker?: string, first = false): Promise<IRunResult> => {
        let last: IRunResult | undefined;
        for (let cycle = 0; cycle < 8; cycle++) {
          last = await session.nextBuild(first && cycle === 0 ? FIRST_BUILD_TIMEOUT : undefined);
          try {
            await session.expectNoBuild(300);
            return last;
          } catch (error) {
            if (!(error instanceof Error) || !error.message.startsWith("Expected no rebuild within")) throw error;
          }
        }
        throw new Error("Watch did not settle to the requested actual cycle: " + status + " " + marker + "\n" + last?.output);
      };
      const baseline = await next(0, undefined, true);
      check(() => assertStatus(baseline, 0, "The original Alpha inputs must pass the actual initial Program."));
      const telemetry = baseline.output.match(/@ttsc\/lint resident check: pid=(\d+) programLoads=(\d+)/);
      check(() => assert.ok(telemetry !== null, "The baseline must report the real resident PID and Program-load count."));
      console.log("Positive watch baseline resident: " + telemetry?.[0]);
      let previous = authored[0].props;
      for (const phase of authored) {
        const localRoot = owned.directory;
        const outsideRoot = owned.workspace;
        const originals = new Map<string, string>();
        const write = (relative: string, bytes: string, outside = false): void => {
          const file = path.join(outside ? outsideRoot : localRoot, relative);
          if (!originals.has(file)) originals.set(file, fs.readFileSync(file, "utf8"));
          fs.writeFileSync(file, bytes, "utf8");
        };
        try {
          let phaseBaseline = baseline;
          if (phase.props.name !== "positive-alpha") {
            activate(owned, previous, phase.props);
            previous = phase.props;
            phaseBaseline = await next(0);
          }
          for (const external of Object.keys(phase.props.workspaceFiles ?? {})) {
            const physical = fs.realpathSync.native(path.join(owned.workspace, external));
            check(() => assert.ok(!physical.startsWith(fs.realpathSync.native(owned.directory) + path.sep), "An external fixture must remain physically outside the compiler project: " + physical));
          }
          check(() => assertStatus(phaseBaseline, 0, "The original watch inputs must pass before mutation: " + phase.props.name));
          console.log("Positive watch " + phase.props.name + " resident: " + phaseBaseline.output.match(/@ttsc\/lint resident check: pid=\d+ programLoads=\d+/)?.[0]);
          const context: positiveWatchCases.Context = { project: owned, localRoot, outsideRoot, library, baseline: phaseBaseline, write, next, quiet: milliseconds => session.expectNoBuild(milliseconds), check };
          for (const mutate of phase.cases) {
            const before = failures.length;
            try { await mutate(context); } catch (error) { failures.push(new Error(mutate.name + " phase failed", { cause: error })); }
            if (mutate !== positiveWatchCases.caches) {
              try {
                let changed = false;
                for (const [file, bytes] of originals) if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== bytes) {
                  fs.writeFileSync(file, bytes, "utf8");
                  if (file !== path.join(localRoot, "README.md")) changed = true;
                }
                if (changed) {
                  const reset = await next(0);
                  check(() => assertStatus(reset, 0, "Original bytes must restore the actual graph."));
                }
              } catch (error) { failures.push(new Error(mutate.name + " reset failed", { cause: error })); }
            }
            console.log("Positive watch " + mutate.name + ": " + (failures.length === before ? "PASS" : "FAILED"));
          }
        } catch (error) { failures.push(new Error(phase.props.name + " preparation failed", { cause: error })); }
      }
    } catch (error) { failures.push(error); }
    finally {
      try { await watcher?.close(); } catch (error) { failures.push(error); }
      try {
        if (project) {
          project.cleanup();
          assert.ok(!fs.existsSync(project.workspace), "The owned positive-watch workspace must be removed after process closure.");
          console.log("Positive watch cleanup removed: " + project.workspace);
        }
      } catch (error) { failures.push(error); }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "Positive Evidence phases and cleanup failed.");
  }
}

/** Replaces only recorded authored files, retaining original phase Program roots. */
function activate(project: ITtscEvidenceProject, previous: ICreateProjectProps, next: ICreateProjectProps): void {
  const replace = (root: string, before: Record<string, string>, after: Record<string, string>): void => {
    for (const relative of Object.keys(before)) if (!Object.hasOwn(after, relative)) {
      const file = path.join(root, relative);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    for (const [relative, bytes] of Object.entries(after)) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes, "utf8");
    }
  };
  replace(project.directory, previous.files, next.files);
  replace(project.workspace, previous.workspaceFiles ?? {}, next.workspaceFiles ?? {});
  const configurationFile = path.join(project.directory, "tsconfig.json");
  const configuration = JSON.parse(fs.readFileSync(configurationFile, "utf8")) as { include: readonly string[] };
  const include = next.include ?? ["src", "lint.config.ts"];
  if (JSON.stringify(configuration.include) !== JSON.stringify(include)) {
    configuration.include = include;
    fs.writeFileSync(configurationFile, JSON.stringify(configuration, null, 2), "utf8");
  }
  fs.writeFileSync(path.join(project.directory, "lint.config.ts"), next.lintConfig, "utf8");
}

interface IWatchScene {
  readonly props: ICreateProjectProps;
  readonly cases: readonly ((context: positiveWatchCases.Context) => Promise<void>)[];
}

/** Original source, compiler and reference populations for each watch phase. */
function watchScenes(): [IWatchScene, ...IWatchScene[]] {
  const graph = (claims: readonly unknown[], typing: "plain" | "consumer" | "graph" = "plain"): string => [
    ...(typing === "plain" ? ['import evidence from "@ttsc/evidence";'] : [
      'import type { ITtscLintConfig } from "@ttsc/lint";',
      typing === "graph" ? 'import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";' : 'import { evidence } from "@ttsc/evidence";',
    ]),
    ...(typing === "graph" ? ["const graph: ITtscEvidenceGraphConfig = { claims: " + JSON.stringify(claims) + " };"] : []),
    'export default { plugins: { evidence }, rules: { "evidence/graph": ["error", ' + (typing === "graph" ? "graph" : "{ claims: " + JSON.stringify(claims) + " }") + "] } }" + (typing === "plain" ? ";" : " satisfies ITtscLintConfig;"),
    "",
  ].join("\n");
  const members = "/** @evidence POST:/members Creates members through the declared API operation. */\nexport interface IMemberCreation {}\n";
  const swaggerClaim = { type: "typescript", files: ["src/members.ts"], symbol: "type", reference: { type: "swagger", file: "api/swagger.json" } };
  return [
    {
      props: { name: "positive-alpha", lintConfig: graph([{ type: "typescript", files: ["src/**/*.ts"], symbol: "type", reference: { type: "markdown", files: ["docs/**/*.md"], symbol: "h2" } }]), files: {
        "README.md": "# Fixture\n", "docs/spec.md": positiveWatchCases.alpha,
        "src/implementation.ts": "/** @evidence docs/spec.md#alpha Implements the current specification section. */\nexport interface Implementation {}\n",
      } },
      cases: [positiveWatchCases.markdown, positiveWatchCases.cold],
    },
    {
      props: { name: "positive-swagger", lintConfig: graph([{ ...swaggerClaim, files: ["src/**/*.ts"] }]), files: { "api/swagger.json": positiveWatchCases.swagger(["post"]), "src/members.ts": members } },
      cases: [positiveWatchCases.swaggerRefresh],
    },
    {
      props: { name: "positive-outside", lintConfig: graph([{ type: "typescript", files: ["src/**/*.ts"], symbol: "type", reference: [{ type: "markdown", root: "../docs", files: ["requirements/**"], symbol: "h2" }, { type: "swagger", file: "../contracts/swagger.json" }] }]), files: {
        "src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount stacking follows this section. */\n/** @evidence POST:/members Creates members through the shared API contract. */\nexport interface ISale {}\n",
      }, workspaceFiles: { "docs/requirements/pricing.md": "## Discount Policy {#discounts}\n", "contracts/swagger.json": positiveWatchCases.swagger(["post"], "/members", true) } },
      cases: [positiveWatchCases.outside],
    },
    {
      props: { name: "positive-code-link", lintConfig: graph([{ type: "markdown", files: ["review.md"], symbol: "h2", reference: { type: "typescript", root: "../api", files: ["*.ts"], symbol: "property" } }], "consumer"), files: {
        "src/project.ts": "export {};\n", "review.md": "## Review\n<!-- @link ../api/example.ts#value Reviews the value. -->\n",
      }, workspaceFiles: { "api/example.ts": "export const value = 1;\n" } },
      cases: [positiveWatchCases.codeLink],
    },
    {
      props: { name: "positive-staged", include: ["src"], lintConfig: graph([
        { type: "typescript", name: "Staged", disabled: true, files: ["src/staged.ts"], symbol: "type", reference: { type: "markdown", files: ["missing-docs/**/*.md"], symbol: "h2" } },
        { type: "typescript", name: "Live", files: ["src/live.ts"], symbol: "type", reference: { type: "markdown", files: ["docs/live.md"], symbol: "h2" } },
      ], "graph").replace('"disabled":true', "disabled: true"), files: {
        "docs/live.md": "## Live Requirement {#live}\n", "src/live.ts": "/** @evidence docs/live.md#live Implements the live requirement. */\nexport interface ILive {}\n", "src/staged.ts": "export interface IStaged {}\n",
      } },
      cases: [positiveWatchCases.staged],
    },
    {
      props: { name: "positive-cache", lintConfig: graph([
        { type: "typescript", files: ["src/sale.ts"], symbol: "type", reference: { type: "prisma", files: ["prisma/**/*.prisma"] } }, swaggerClaim,
      ]), files: {
        "prisma/schema.prisma": positiveWatchCases.schema(["Sale"]), "src/sale.ts": "/** @evidence prisma:Sale This contract materializes the sale row. */\nexport interface ISale {}\n",
        "api/swagger.json": positiveWatchCases.swagger(["post"]), "src/members.ts": members, "src/unrelated.ts": "export const version = 1;\n",
      } },
      cases: [positiveWatchCases.caches],
    },
  ];
}
