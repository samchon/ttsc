export const NATIVE_CASES = {
  case_real_native_envelope_candidate_appearance_replaces_generation:
    async () => {
      const { assertRealEnvelopeCandidateAppearanceReplacesGeneration } =
        await import("../internal/real-native-envelope");
      const execute = async () => {
        await assertRealEnvelopeCandidateAppearanceReplacesGeneration();
      };
      return await execute();
    },
  case_real_native_envelope_declaration_change_replaces_generation:
    async () => {
      const { assertRealEnvelopeDeclarationChangeReplacesGeneration } =
        await import("../internal/real-native-envelope");
      const execute = async () => {
        await assertRealEnvelopeDeclarationChangeReplacesGeneration();
      };
      return await execute();
    },
  case_real_native_envelope_failed_compile_costs_one_compile_per_pass:
    async () => {
      const { assertAFailedCompileCostsOneCompilePerPass } =
        await import("../internal/transform-terminal-verdict");
      const execute = async () => {
        await assertAFailedCompileCostsOneCompilePerPass();
      };
      return await execute();
    },
  case_real_native_envelope_failed_compile_without_a_pass_is_still_evicted:
    async () => {
      const { assertAFailedCompileWithoutAPassIsStillEvicted } =
        await import("../internal/transform-terminal-verdict");
      const execute = async () => {
        await assertAFailedCompileWithoutAPassIsStillEvicted();
      };
      return await execute();
    },
  case_real_native_envelope_fixed_compile_succeeds_on_the_next_pass:
    async () => {
      const { assertAFixedCompileSucceedsOnTheNextPass } =
        await import("../internal/transform-terminal-verdict");
      const execute = async () => {
        await assertAFixedCompileSucceedsOnTheNextPass();
      };
      return await execute();
    },
  case_real_native_envelope_input_race_stabilizes_within_shared_generation:
    async () => {
      const { assertRealEnvelopeInputRaceStabilizesWithinSharedGeneration } =
        await import("../internal/real-native-envelope");
      const execute = async () => {
        await assertRealEnvelopeInputRaceStabilizesWithinSharedGeneration();
      };
      return await execute();
    },
  case_real_native_envelope_new_pass_retries_a_failed_compile: async () => {
    const { assertANewPassRetriesAFailedCompile } =
      await import("../internal/transform-terminal-verdict");
    const execute = async () => {
      await assertANewPassRetriesAFailedCompile();
    };
    return await execute();
  },
  case_real_native_envelope_serves_sibling_modules_from_one_compile:
    async () => {
      const { assertRealEnvelopeServesSiblingModulesFromOneCompile } =
        await import("../internal/real-native-envelope");
      const execute = async () => {
        await assertRealEnvelopeServesSiblingModulesFromOneCompile();
      };
      return await execute();
    },
} satisfies Record<string, () => Promise<unknown>>;
