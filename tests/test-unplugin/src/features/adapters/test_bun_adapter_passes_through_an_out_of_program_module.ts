import { assertBunAdapterPassesThroughAnOutOfProgramModule } from "../../internal/adapter-bun";

/**
 * Verifies the Bun bundler adapter passes an out-of-program module through.
 *
 * See {@link assertBunAdapterPassesThroughAnOutOfProgramModule}:
 * samchon/ttsc#1308 asked for its pass-through contract to be proven per
 * adapter, and samchon/ttsc#1317 records that only the core and Metro were
 * pinned.
 */
export const test_bun_adapter_passes_through_an_out_of_program_module =
  async () => {
    await assertBunAdapterPassesThroughAnOutOfProgramModule();
  };
