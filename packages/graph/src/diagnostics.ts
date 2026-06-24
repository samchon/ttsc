import fs from "node:fs";
import { createRequire } from "node:module";

/**
 * Background worker that computes the project's plugin diagnostics and writes
 * them where the ttscgraph server reads them.
 *
 * The graph binary runs only the TypeScript semantic pass. Everything a plugin
 * adds — `@ttsc/lint` rule violations and transform-plugin (typia, nestia, …)
 * findings — comes from `ttsc`'s own check, which runs whatever plugins the
 * project configured. This worker invokes that check through the public
 * `TtscCompiler`, so nothing here is specific to any plugin: it forwards
 * whatever diagnostics ttsc produces.
 *
 * A native plugin reports its findings with a string `code` (tsc uses numeric
 * codes), so the string-coded diagnostics are exactly the plugin/lint set the
 * graph does not already have. They are serialized with code 0 and the rule
 * folded into the message, the shape ttscgraph's injected-diagnostics provider
 * consumes.
 *
 * Every failure is swallowed: a missing `ttsc`, a go toolchain that cannot
 * build a plugin, a project that does not compile — any of these simply leaves
 * no file, and the graph shows its tsc diagnostics alone. The worker must never
 * be able to break the server it feeds.
 */
export function runDiagnosticsWorker(
  argv: readonly string[] = process.argv.slice(2),
): void {
  const [cwd, tsconfig, outPath] = argv;
  if (!cwd || !outPath) {
    return;
  }
  try {
    const ttscPackageJson = require.resolve("ttsc/package.json", {
      paths: [cwd],
    });
    const fromProject = createRequire(ttscPackageJson);
    const { TtscCompiler } = fromProject("ttsc") as {
      TtscCompiler: new (context: { cwd: string; tsconfig?: string }) => {
        compile: () => unknown;
      };
    };

    const result = new TtscCompiler({
      cwd,
      tsconfig: tsconfig || undefined,
    }).compile();

    const raw: ReadonlyArray<Record<string, unknown>> =
      result &&
      typeof result === "object" &&
      Array.isArray((result as { diagnostics?: unknown }).diagnostics)
        ? (result as { diagnostics: Record<string, unknown>[] }).diagnostics
        : [];

    const out = raw
      .filter(
        (d) =>
          typeof d.file === "string" &&
          (typeof d.line === "number" || typeof d.start === "number"),
      )
      .map((d) => ({
        file: d.file as string,
        // A byte offset when the structured lane gives one; otherwise null and
        // the server attributes by line. @ttsc/lint and transform plugins reach
        // the result through ttsc's text banner, which carries a line but no
        // offset.
        start: typeof d.start === "number" ? (d.start as number) : null,
        line: typeof d.line === "number" ? (d.line as number) : 1,
        column: typeof d.character === "number" ? (d.character as number) : 1,
        // tsc diagnostics use numeric codes; @ttsc/lint and native plugins hash
        // their rule to a code >= 9000. A rare string id is marked non-tsc (the
        // server then drops the "TS" prefix); the rule name travels in the
        // message regardless.
        code: typeof d.code === "number" ? (d.code as number) : 9000,
        message: String(d.messageText ?? ""),
      }));

    // Atomic publish: write to a sibling temp file and rename, so the server
    // never reads a half-written file (a partial read would drop every finding
    // for that query).
    const tmp = `${outPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, outPath);
  } catch {
    // Resilient by contract: no file means the graph shows tsc-only diagnostics.
  }
}

if (require.main === module) {
  runDiagnosticsWorker();
}
