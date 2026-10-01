import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";
import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies ttsx runs JSX a project preserves for another tool, compiled through
 * the automatic runtime its `jsxImportSource` names.
 *
 * Pins samchon/ttsc#1408. `jsx: "preserve"` is Next.js's default, and
 * `react-native` preserves the same way, so the runtime build kept JSX and Node
 * failed at the first `<` with a `SyntaxError`. The runtime build now picks the
 * executable mode that keeps the project's declared factory, the way it lowers
 * `target: ESNext` for decorators, and leaves the tsconfig untouched.
 *
 * 1. Create a `preserve` project whose `jsxImportSource` is a local runtime, with
 *    a component using elements and a fragment.
 * 2. Run the entry through the public `ttsc/register` preload.
 * 3. Assert rendering and unchanged tsconfig bytes.
 * @evidence contracts/testing.md#behavioral-verification The public ttsc/register preload executes an authored TSX entry whose config preserves JSX with myjsx import-source. Exact HTML and unchanged config bytes distinguish executable runtime-only emission from preserved syntax or caller config mutation.
 * @evidence contracts/testing.md#independent-expectations The authored runtime/component specify the full div hello plus b world output independently of compiler transforms. The original authored preserve config snapshot is compared byte-for-byte after real registration execution.
 * @evidence contracts/testing.md#distinguishing-cases This survivor owns public registration rather than CLI startup. CLI automatic assembly is observed by the existing response-file JSX consumer. Preserved/react-native and classic/development/namespace/import-source policy distinctions belong to the exact runtimeCompilerArgs unit plus actual Go emission/VM rendering profiles; equivalent effective automatic emission is reused only after those policy owners establish it.
 * @evidence contracts/testing.md#execution-ownership One named E2E entry executes one real Node process through the public register artifact. The authored runtime package is a fixture input, not a hidden test host. Compiler/VM effect units run in their separate unit population without installing or starting a product host.
 * @evidence contracts/e2e.md#necessary-boundary Public registration must discover the TSX owning project, select executable JSX and serve the actual module to Node. Direct option computation and VM emission do not certify this registration connection.
 * @evidence contracts/e2e.md#shared-execution Original CLI, registration and equivalent react-native CLI effect requests are reduced to one registration host/root. CLI response transport has its existing survivor; four genuinely distinct library emission profiles share one existing Go unit process and authored input workspace rather than per-profile product builds or hosts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This one preserve fixture remains immutable and the source config snapshot survives unchanged. The removed preserve-to-react-native rewrite produced the same effective automatic code and asserted only HTML, not an invalidation identity or cache miss; those policy/effect distinctions now have explicit units, without claiming a lost cold/mutation protocol. Completion precedes tracked fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Public registration zero status, complete HTML and exact config bytes remain here. The removed CLI HTML/success effects are owned by actual Go/VM automatic and react-native labels plus the existing real CLI response consumer. Every classic/development/namespace/import-source original HTML has a named VM request owner; native runtime registration remains real.
 */
export function test_ttsx_runs_preserved_jsx_through_the_automatic_runtime() {
    const tsconfig = (jsx: string): string =>
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          jsx,
          jsxImportSource: "myjsx",
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      });
    const root = TestProject.createProject({
      ...JSX_RUNTIME_PACKAGE,
      "package.json": JSON.stringify({ name: "preserved-jsx", private: true }),
      "tsconfig.json": tsconfig("preserve"),
      "src/view.tsx": JSX_COMPONENT_SOURCE,
      "src/main.tsx": [
        `import { view } from "./view";`,
        `console.log(view);`,
        ``,
      ].join("\n"),
    });
    linkTtscPackage(root);

    const registered = TestProject.spawn(
      process.execPath,
      ["--require", TTSX_REGISTER, "src/main.tsx"],
      { cwd: root },
    );
    assert.equal(registered.status, 0, registered.stderr);
    assert.equal(registered.stdout.trim(), JSX_COMPONENT_OUTPUT);
    assert.equal(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
      tsconfig("preserve"),
    );

}
