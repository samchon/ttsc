import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import fixture from "../../../internal/ttsc/internal/runtime-decorator-fixture.json" with { type: "json" };

/**
 * Verifies standard decorator fields and accessors preserve initialization.
 *
 * Decorator lowering shares the class-field transform. Private fields,
 * auto-accessors and addInitializer must retain TC39 value and ordering rules.
 *
 * 1. Decorate a private field, an auto-accessor, and a static method.
 * 2. Instantiate the class after its class initializer has run.
 * 3. Assert transformed values and static/class/instance initializer order.
 * @evidence contracts/testing.md#behavioral-verification A real ESNext ESM entry runs private-field and auto-accessor standard decorators; complete value 11 method and static/class/field/accessor ordering remain exact assertions. The same authored CommonJS witness executes the real Go output in the VM unit.
 * @evidence contracts/testing.md#independent-expectations Field 2 plus one and accessor 4 times two yield 11. The authored addInitializer operations specify static method then class then instance field/accessor ordering; a literal shared fixture expectation records these semantics independently of compiler output.
 * @evidence contracts/testing.md#distinguishing-cases This survivor owns real ESM runtime assembly and execution of private member/accessor transforms. The CommonJS effect variant belongs to TestRuntimeDecoratorTargetProfiles members plus test_runtime_compiler_output_preserves_decorator_effects; module/bootstrap distinctions remain separate compatibility boundary cases.
 * @evidence contracts/testing.md#execution-ownership One named E2E entry starts one real public ttsx process for one immutable root. The authored fixture is input, not another test host. The CommonJS library/VM owner belongs only to the unit population and requires no product binary or launcher.
 * @evidence contracts/e2e.md#necessary-boundary Native ESM loading must accept the runtime-lowered member/accessor code and execute its initialization effects; a CommonJS VM cannot establish this ESM bootstrap connection.
 * @evidence contracts/e2e.md#shared-execution The previous CommonJS and ESM roots/hosts are reduced to one ESM root and host. The CommonJS effects use one additional library unit program within the already-existing single Go test process, not another product/contributor build or installed runtime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The ESM fixture has one immutable source/config and no cold/warm mutation protocol. The VM unit has fresh module/context state for its independently emitted CommonJS profile. Synchronous process completion precedes fixture cleanup; no cache state is shared across these layers.
 * @evidence contracts/e2e.md#preserved-coverage Both original zero-status and complete value/initializer-order expectations survive: ESM here, CommonJS in the actual compiler-output VM unit. One original host/compiler program is removed, while one library unit program is added without installation/native-product build or host startup.
 */
export function test_ttsx_standard_decorators_preserve_member_initialization() {
  const module = "esnext";
      const root = TestProject.createProject({
        "package.json": JSON.stringify({
          type: "module",
        }),
        "tsconfig.json": TestProject.tsconfig({
          target: "ESNext",
          module,
          strict: true,
          rootDir: "src",
          outDir: "dist",
        }),
        "src/main.ts": fixture.memberSource,
      });
      const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
        cwd: root,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.trim(),
        fixture.memberExpected,
      );
}
