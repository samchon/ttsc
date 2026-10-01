import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { deliverPass } from "../../../../internal/unplugin/internal/transform-delivery-epoch/deliverPass";
import { startDeliveryPassSession } from "../../../../internal/unplugin/internal/transform-delivery-epoch/startDeliveryPassSession";

/**
 * Verifies shared build passes distinguish irrelevant changes and admitted inputs.
 *
 * An existing undeclared text file and a newly created ignored directory exercise
 * different halves of the pass proof: content and membership. Both preserve the
 * same captured native output. Delivered and undelivered source edits then replace
 * that output, as do source addition, removal, return and kind change. The two
 * irrelevant cases run independently; later dependent transitions are reported
 * as blocked if their preceding state cannot be established.
 *
 * 1. Plant both text files and capture one graph-bearing native generation.
 * 2. Rewrite undeclared text and create four ignored directories without compiling.
 * 3. Edit delivered and type-only inputs, add a source, remove irrelevant text,
 *    then add, remove, restore and change the kind of another admitted source.
 *    Finally edit the descriptor between two deliveries of one module in a pass.
 * 4. Assert literal invocation counts, retain each failure identity and release
 *    the shared cache in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification deliverPass asserts every original module's output in the phases that originally delivered all modules. The native log stays one for undeclared edits and ignored directories, reaches two for delivered-source edit and reuse, three for an undelivered type-only edit, four for appeared.ts creation and notes.txt removal, then five/six/seven/eight for extra.ts creation/removal/return/directory conversion. The type-only and appeared.ts phases deliver only the first module. In a final pass, the first module returns output at eight captures; a descriptor edit followed by that same module in the same pass requires output and exactly nine captures.
 * @evidence contracts/testing.md#independent-expectations The fixture admits TypeScript sources but never the planted text or ignored emitted JavaScript. Literal successive counts require exactly one replacement per admitted content or membership transition and none for irrelevant changes, independently of adapter digests. Counts are fixed expectations, never computed from observed earlier results.
 * @evidence contracts/testing.md#distinguishing-cases Owns undeclared text edit/removal, ignored-directory appearance, delivered-source edit and reuse, an undelivered type-only edit, absent-to-present source membership, source removal/return and a same-name file-to-directory change holding inner.ts. Repeated delivery after a descriptor edit contrasts with the first-delivery pass shortcut. Positive transitions reject unconditional reuse; both irrelevant controls reject arbitrary directory or content invalidation.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner discovers this single native transform entry. Its named phases own all assertions formerly in the two build-pass ignores entries, four recompiles entries for module edit, type-only edit, membership change and membership removal, and a_repeated_delivery_inside_a_pass_revalidates. Direct source metadata memo semantics remain in test-unplugin units.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API launches the counting Go sidecar and consumes its graph across real delivery-pass boundaries. The invocation log proves native envelope admission and generation reuse; this synthetic producer does not establish native compiler graph semantics.
 * @evidence contracts/e2e.md#shared-execution Exactly one startDeliveryPassSession, root, options, log and cache serve all seven original cases. Seven original cold captures become one, reducing fifteen native invocations to nine while retaining each required invalidation. The repeated-delivery phase reuses the eighth captured generation in a new pass and requires a ninth only after its descriptor edit. The sidecar source and artifact use the existing shared cache without per-phase installation or producer setup.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both original text files exist before the common capture. Negative phases mutate disjoint irrelevant paths and both run despite assertion failure. Each subsequent admitted-input phase requires its predecessor's exact literal count; if that phase fails, later dependent phases are reported as blocked rather than claiming coverage against an unknown state. finally resets the cache and releases trackers; TestProject owns temporary roots until runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original mutation bytes, path identities, compile-count distinctions and module-output assertions remain in their named phases. Repeated per-case cold counts share one initial assertion. Undelivered input cases still deliver only the first module; membership removal still delivers every original module after each mutation. Repeated delivery preserves both result assertions, the exact plugin.cjs append and the absence of a pass boundary between those deliveries. Every original failure identity is retained, with blocked dependent phases named explicitly.
 */
export async function test_transformttsc_build_pass_validates_input_transitions(): Promise<void> {
  const session = await startDeliveryPassSession();
  const failures: Error[] = [];
  const phase = async (label: string, run: () => Promise<void>): Promise<boolean> => {
    try {
      await run();
      return true;
    } catch (cause) {
      failures.push(new Error(label, { cause }));
      return false;
    }
  };
  let ready = true;
  const transition = async (label: string, before: number, run: () => Promise<void>): Promise<void> => {
    if (!ready) {
      failures.push(new Error(label + ": blocked by the preceding input transition failure"));
      return;
    }
    ready = await phase(label, async () => {
      assert.equal(session.compiles(), before, "the preceding input state must be established");
      await run();
    });
  };
  try {
    const note = path.join(session.root, "src", "build-log.txt");
    fs.writeFileSync(note, "first\n", "utf8");
    const removedNote = path.join(session.root, "src", "notes.txt");
    fs.writeFileSync(removedNote, "planted before the generation\n", "utf8");
    await deliverPass(session);
    await phase("shared cold generation", async () => {
      assert.equal(session.compiles(), 1);
    });

    await phase("test_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit", async () => {
      fs.writeFileSync(note, "second, longer than the first\n", "utf8");
      await deliverPass(session);
      assert.equal(
        session.compiles(),
        1,
        "a project file the generation never declared as an input must not cost a compile",
      );
    });

    await phase("test_transformttsc_a_build_pass_ignores_an_appearing_output_directory", async () => {
      for (const ignored of ["dist", "out", "coverage", ".cache"]) {
        const directory = path.join(session.root, ignored);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, "bundle.js"), "// emitted", "utf8");
      }
      await deliverPass(session);
      assert.equal(
        session.compiles(),
        1,
        "a bundler creating its own output directory must not void the generation",
      );
    });

    await transition("test_transformttsc_a_build_pass_recompiles_after_a_module_edit", 1, async () => {
      fs.appendFileSync(session.modules[0]!, "\nexport const added = 1;\n", "utf8");
      await deliverPass(session);
      assert.equal(session.compiles(), 2, "an edited module must replace the generation exactly once");
      await deliverPass(session);
      assert.equal(session.compiles(), 2, "the pass after the edit must reuse the replacement");
    });
    await transition("test_transformttsc_a_build_pass_recompiles_after_a_type_only_input_edit", 2, async () => {
      const typeOnly = session.modules[session.modules.length - 1]!;
      fs.appendFileSync(typeOnly, "\nexport const shifted = true;\n", "utf8");
      session.pass();
      assert.ok(await session.deliver(session.modules[0]!));
      assert.equal(session.compiles(), 3, "an edited type-only input must replace the generation before the next pass delivers anything");
    });
    await transition("test_transformttsc_a_build_pass_recompiles_after_a_membership_change", 3, async () => {
      fs.writeFileSync(path.join(session.root, "src", "appeared.ts"), "export const appeared = 1;\n", "utf8");
      session.pass();
      assert.ok(await session.deliver(session.modules[0]!));
      assert.equal(session.compiles(), 4, "a file entering the project must replace the generation");
    });
    await transition("test_transformttsc_a_build_pass_recompiles_after_a_membership_removal", 4, async () => {
      fs.rmSync(removedNote);
      await deliverPass(session);
      assert.equal(session.compiles(), 4, "a file that could not enter the program must not cost a compile when it leaves");
      const source = path.join(session.root, "src", "extra.ts");
      fs.writeFileSync(source, "export const extra: number = 1;", "utf8");
      await deliverPass(session);
      assert.equal(session.compiles(), 5, "a source entering the project must replace the generation");
      fs.rmSync(source);
      await deliverPass(session);
      assert.equal(session.compiles(), 6, "a source leaving the project must replace the generation");
      fs.writeFileSync(source, "export const extra: number = 2;", "utf8");
      await deliverPass(session);
      assert.equal(session.compiles(), 7, "the source returning is a change too");
      fs.rmSync(source);
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, "inner.ts"), "export const inner: number = 1;", "utf8");
      await deliverPass(session);
      assert.equal(session.compiles(), 8, "an entry changing kind must replace the generation");
    });
    await transition("test_transformttsc_a_repeated_delivery_inside_a_pass_revalidates", 8, async () => {
      const first = session.modules[0]!;
      session.pass();
      assert.ok(await session.deliver(first));
      assert.equal(session.compiles(), 8);
      fs.appendFileSync(
        path.join(session.root, "plugin.cjs"),
        "\n// changed inside the pass\n",
        "utf8",
      );
      assert.ok(await session.deliver(first));
      assert.equal(
        session.compiles(),
        9,
        "a module delivered twice in one pass must validate on its second delivery",
      );
    });
    if (failures.length !== 0)
      throw new AggregateError(failures, "Build-pass input transition batch failed");
  } finally {
    session.close();
  }
}
