import { assertTurbopackLoaderPassesThroughAnOutOfProgramModule } from "../../internal/adapter-turbopack";

/**
 * Verifies the turbopack loader passes an out-of-program module through.
 *
 * See {@link assertTurbopackLoaderPassesThroughAnOutOfProgramModule}:
 * samchon/ttsc#1308 asked for its pass-through contract to be proven per
 * adapter, and samchon/ttsc#1317 records that only the core and Metro were
 * pinned.
 */
export const test_turbopack_loader_passes_through_an_out_of_program_module =
  async () => {
    await assertTurbopackLoaderPassesThroughAnOutOfProgramModule();
  };
