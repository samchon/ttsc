import { pathToFileURL } from "node:url";
import { TtscCompiler } from "ttsc";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  child_process,
  fs,
  goPath,
  nativeBinary,
  os,
  path,
  setupLintProject,
  spawn,
  tsgoBinary,
  ttscBin,
} from "../../internal/plugin-corpus";
import {
  TtscserverClient,
  initializeTtscserverClient,
  shutdownTtscserverClient,
} from "../../internal/ttscserver";

type PublishDiagnosticsParams = {
  uri: string;
  diagnostics?: {
    code?: unknown;
    message?: string;
    source?: string;
  }[];
};

const guardContributor = `package guard

import (
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/samchon/ttsc/packages/lint/rule"
)

type projectGuard struct{}

type projectBinding struct {
  identity rule.ProjectIdentity
  marker string
  sources int
}

func (projectGuard) Name() string { return "guard/project" }
func (projectGuard) ProjectInputs(ctx *rule.ProjectInputContext) []rule.ProjectInput {
  return []rule.ProjectInput{{
    Kind: rule.ProjectInputFile,
    Pattern: "guard-state.txt",
  }}
}
func (projectGuard) Check(ctx *rule.ProjectContext) {
  ctx.SetState(&projectBinding{
    identity: ctx.Identity,
    marker: filepath.Join(ctx.Identity.PhysicalProjectRoot, "guard-state.txt"),
    sources: len(ctx.Sources),
  })
}

func (binding *projectBinding) Revalidate() error {
  marker, err := os.ReadFile(binding.marker)
  if err != nil {
    return err
  }
  if strings.TrimSpace(string(marker)) != "blocked" {
    return nil
  }
  return fmt.Errorf(
    "project blocked logical=%s physical=%s invocation=%s lifecycle=%s explicit=%s origin=%s sources=%d",
    binding.identity.LogicalConfigPath,
    binding.identity.PhysicalConfigPath,
    binding.identity.InvocationCwd,
    binding.identity.LifecycleID,
    binding.identity.ExplicitProjectRoot,
    binding.identity.PluginConfigOrigin,
    binding.sources,
  )
}

type guardedProjectIO struct{}

func (guardedProjectIO) Name() string { return "guard/project-io" }
func (guardedProjectIO) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (guardedProjectIO) Check(ctx *rule.Context, node *shimast.Node) {
  result := ctx.ProjectResult("guard/project")
  switch result.Status {
  case rule.ProjectRuleAbsent, rule.ProjectRuleOff, rule.ProjectRuleFailed:
    return
  }
  binding, ok := result.State.(*projectBinding)
  if !ok {
    result.Report("project binding missing from live result")
    return
  }
  if err := binding.Revalidate(); err != nil {
    result.Report(err.Error())
    result.Report(err.Error())
    return
  }
}

type independentAST struct{}

func (independentAST) Name() string { return "guard/ast" }
func (independentAST) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (independentAST) Check(ctx *rule.Context, node *shimast.Node) {
  ctx.Report(node, "guard AST rule remained independent")
}

func init() {
  rule.RegisterProject(projectGuard{})
  rule.Register(guardedProjectIO{})
  rule.Register(independentAST{})
}
`;

const unrelatedContributor = `package unrelated

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "github.com/samchon/ttsc/packages/lint/rule"
)

type independentAST struct{}

func (independentAST) Name() string { return "unrelated/ast" }
func (independentAST) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (independentAST) Check(ctx *rule.Context, node *shimast.Node) {
  ctx.Report(node, "unrelated AST rule remained independent")
}

func init() { rule.Register(independentAST{}) }
`;

/**
 * Verifies project rules retain one live lifecycle and identity contract
 * through package-discovered CLI, public API, LSP, and watch executions.
 *
 * The fixture has no `compilerOptions.plugins`; `@ttsc/lint` is discovered from
 * package metadata, then its config contributes a project rule plus guarded and
 * independent file rules. The project is selected through a junction/symlink so
 * the contributor can prove logical and physical paths remain distinct.
 *
 * 1. Run CLI and assert a file helper turns passed project state into one
 *    deduplicated finding ordered before independent file findings.
 * 2. Run the public API with explicit root/config-origin channels and assert its
 *    structured project diagnostic has `file: null`.
 * 3. Publish the JIT failure over LSP, then clear it with a clean loaded cycle.
 * 4. Trigger two additional watch cycles by changing the contributor-declared
 *    external input and assert the blocked cycles carry distinct lifecycle
 *    ids.
 */
export const test_project_rule_lifecycle_surfaces_through_package_discovery_cli_api_and_watch =
  async (): Promise<void> => {
    const physicalRoot = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(physicalRoot, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/lint": "*" } }),
    );
    fs.writeFileSync(
      path.join(physicalRoot, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          noEmit: true,
          rootDir: "src",
        },
        include: ["src"],
      }),
    );
    fs.rmSync(path.join(physicalRoot, "lint.config.json"), { force: true });
    fs.mkdirSync(path.join(physicalRoot, "contributors", "guard"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(physicalRoot, "contributors", "unrelated"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(physicalRoot, "contributors", "guard", "guard.go"),
      guardContributor,
    );
    fs.writeFileSync(
      path.join(physicalRoot, "contributors", "unrelated", "unrelated.go"),
      unrelatedContributor,
    );
    fs.writeFileSync(
      path.join(physicalRoot, "lint.config.cjs"),
      `const path = require("node:path");
module.exports = {
  plugins: {
    guard: { source: path.join(__dirname, "contributors", "guard") },
    unrelated: { source: path.join(__dirname, "contributors", "unrelated") },
  },
  rules: {
    "guard/project": "error",
    "guard/project-io": "error",
    "guard/ast": "error",
    "unrelated/ast": "error",
  },
};
`,
    );

    const logicalParent = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-project-rule-logical-"),
    );
    const logicalRoot = path.join(logicalParent, "linked-project");
    fs.symlinkSync(
      physicalRoot,
      logicalRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    const logicalConfig = path.join(logicalRoot, "tsconfig.json");
    const physicalConfig = fs.realpathSync(
      path.join(physicalRoot, "tsconfig.json"),
    );
    const guardState = path.join(physicalRoot, "guard-state.txt");
    fs.writeFileSync(guardState, "blocked\n");
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    };

    const cli = spawn(ttscBin, ["--cwd", logicalRoot, "--noEmit"], {
      cwd: logicalRoot,
      env,
    });
    assert.notEqual(cli.status, 0, "project rule should fail the CLI check");
    assert.equal(
      cli.stderr.match(/\[guard\/project\]/g)?.length,
      1,
      `project reporter should deduplicate one CLI finding\n${cli.stderr}`,
    );
    assert.equal(cli.stderr.includes(`logical=${logicalConfig}`), true);
    assert.equal(cli.stderr.includes(`physical=${physicalConfig}`), true);
    assert.equal(cli.stderr.includes(`invocation=${logicalRoot}`), true);
    assert.match(cli.stderr, /lifecycle=\S+/);
    assert.equal(
      cli.stderr.includes("project I/O should have been skipped"),
      false,
    );
    assert.match(cli.stderr, /\[guard\/ast\].*remained independent/s);
    assert.match(cli.stderr, /\[unrelated\/ast\].*remained independent/s);
    assert.equal(
      cli.stderr.indexOf("[guard/project]") < cli.stderr.indexOf("[guard/ast]"),
      true,
      `finalized project finding should precede file findings\n${cli.stderr}`,
    );

    const api = new TtscCompiler({
      binary: tsgoBinary,
      cacheDir: SHARED_PLUGIN_CACHE_DIR,
      cwd: logicalRoot,
      env,
      pluginConfigDir: logicalRoot,
      projectRoot: logicalRoot,
    }).compile();
    assert.equal(api.type, "failure");
    if (api.type !== "failure") return;
    const projectDiagnostic = api.diagnostics.find((diagnostic) =>
      diagnostic.messageText.includes("project blocked"),
    );
    assert.notEqual(projectDiagnostic, undefined);
    assert.equal(projectDiagnostic?.file, null);
    assert.equal(
      projectDiagnostic?.messageText.includes(`explicit=${logicalRoot}`),
      true,
    );
    assert.equal(
      projectDiagnostic?.messageText.includes(`origin=${logicalRoot}`),
      true,
    );

    const file = path.join(physicalRoot, "src", "main.ts");
    const uri = pathToFileURL(path.join(logicalRoot, "src", "main.ts")).href;
    const secondFile = path.join(physicalRoot, "src", "second.ts");
    const secondURI = pathToFileURL(
      path.join(logicalRoot, "src", "second.ts"),
    ).href;
    fs.writeFileSync(secondFile, "export const second = 2;\n");
    const configURI = pathToFileURL(logicalConfig).href;
    const client = TtscserverClient.startLauncher(logicalRoot, {
      env: { TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    try {
      await initializeTtscserverClient(client, logicalRoot);
      const failedPublication =
        client.waitForNotification<PublishDiagnosticsParams>(
          "textDocument/publishDiagnostics",
          (params) =>
            (params.diagnostics ?? []).some(
              (diagnostic) => diagnostic.code === "guard/project",
            ),
          60_000,
        );
      client.notify("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "typescript",
          version: 1,
          text: fs.readFileSync(file, "utf8"),
        },
      });
      const failedParams = await failedPublication;
      assert.equal(failedParams.uri, configURI);
      assert.equal(
        failedParams.diagnostics?.filter(
          (diagnostic) => diagnostic.code === "guard/project",
        ).length,
        1,
      );

      fs.writeFileSync(guardState, "clean\n");
      const cleanPublication =
        client.waitForNotification<PublishDiagnosticsParams>(
          "textDocument/publishDiagnostics",
          (params) =>
            params.uri === configURI && (params.diagnostics ?? []).length === 0,
          60_000,
        );
      client.notify("textDocument/didOpen", {
        textDocument: {
          uri: secondURI,
          languageId: "typescript",
          version: 1,
          text: fs.readFileSync(secondFile, "utf8"),
        },
      });
      await cleanPublication;
    } finally {
      await shutdownTtscserverClient(client);
    }

    fs.writeFileSync(guardState, "blocked\n");

    const child = child_process.spawn(
      process.execPath,
      [ttscBin, "--watch", "--cwd", logicalRoot, "--noEmit"],
      {
        cwd: logicalRoot,
        env: {
          ...process.env,
          ...env,
          TTSC_BINARY: nativeBinary,
          TTSC_TSGO_BINARY: tsgoBinary,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let output = "";
    let cleaned = false;
    let blockedAgain = false;
    let terminated = false;
    const exit = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`project-rule watch timed out\n${output}`));
      }, 120_000);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    const onChunk = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      const cycles = output.match(
        /\[ttsc\] watch build (?:complete|failed)/g,
      )?.length;
      if (!cleaned && (cycles ?? 0) >= 1) {
        cleaned = true;
        fs.writeFileSync(guardState, "clean\n");
      } else if (!blockedAgain && (cycles ?? 0) >= 2) {
        blockedAgain = true;
        fs.writeFileSync(guardState, "blocked\n");
      } else if (!terminated && (cycles ?? 0) >= 3) {
        terminated = true;
        child.kill("SIGTERM");
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    await exit;

    assert.equal(terminated, true, output);
    assert.equal(
      output.match(/\[guard\/project\]/g)?.length,
      2,
      `watch should report only the two blocked external-input cycles\n${output}`,
    );
    const lifecycleIDs = [...output.matchAll(/lifecycle=(\S+)/g)].map(
      (match) => match[1],
    );
    assert.equal(new Set(lifecycleIDs).size, 2, output);
  };
