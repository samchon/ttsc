import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";

/**
 * Verifies native response-file JSX preservation becomes executable at runtime.
 *
 * 1. Configure the automatic JSX runtime and forward preserve in a response file.
 * 2. Execute the real root through ttsx.
 * 3. Require the exact authored component rendering.
 *
 * @evidence contracts/testing.md#behavioral-verification One real ttsx request with @jsx.rsp must render the authored component after the effective preserved JSX mode is converted into executable automatic runtime code.
 * @evidence contracts/testing.md#independent-expectations The authored myjsx implementation and literal div/hello plus b/world determine the HTML independently of option inspection and compiler transforms.
 * @evidence contracts/testing.md#distinguishing-cases Project react-jsx versus response-file preserve exercises native argument precedence and root runtime-only adjustment. The five executable/declaration rendering distinctions belong to TestRuntimeJsxProfiles plus test_runtime_compiler_output_renders_jsx_profiles; exact source units own the policy matrix.
 * @evidence contracts/testing.md#execution-ownership This matching named E2E entry owns one real launcher/compiler/Node request; its JSX modules and response file are inputs, not hidden test entries.
 * @evidence contracts/e2e.md#necessary-boundary The selected native compiler must interpret the actual response file, runtime-only option computation must choose executable emit, and Node must load the automatic runtime. Visible-token units do not exercise that connection.
 * @evidence contracts/e2e.md#shared-execution One response-file root and host retain this unique transport. All other portable rendering profiles share four effective actual compiler library programs and one Node VM unit session, with no product builds or per-profile hosts. The public register survivor owns its unique startup connection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Source, package, response and configuration bytes remain immutable for the synchronous request. TestProject owns retained temporary files until test-process cleanup; no cold or mutation distinction is removed.
 * @evidence contracts/e2e.md#preserved-coverage Original response-file zero status and exact component rendering remain here. All other portable rendering effects execute in labeled actual compiler-output VM profiles with aggregate failures, while exact policy decisions execute in runtimeCompilerArgs units. Public registration still has its real successful rendering/config snapshot owner.
 */
export function test_ttsx_keeps_executable_jsx_modes_and_follows_every_preserved_declaration() {
  const root = TestProject.createProject({
    ...JSX_RUNTIME_PACKAGE,
    "jsx.rsp": "--jsx preserve\n",
    "package.json": JSON.stringify({ name: "jsx-modes", private: true }),
    "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "lib", types: [], jsx: "react-jsx", jsxImportSource: "myjsx" }),
    "src/view.tsx": JSX_COMPONENT_SOURCE,
    "src/main.tsx": 'import { view } from "./view";\nconsole.log(view);\n',
  });
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "@jsx.rsp", "src/main.tsx"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), JSX_COMPONENT_OUTPUT);
}
