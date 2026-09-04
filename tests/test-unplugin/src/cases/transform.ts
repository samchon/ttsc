export const TRANSFORM_CASES = {
  case_resolveoptions_keeps_only_the_public_ttsc_adapter_contract: async () => {
    const { assertResolveOptionsKeepsOnlyPublicContract } =
      await import("../internal/options-contract");
    const execute = async () => {
      await assertResolveOptionsKeepsOnlyPublicContract();
    };
    return await execute();
  },
  case_transformttsc_a_build_pass_ignores_an_appearing_output_directory:
    async () => {
      const { assertAPassIgnoresAnAppearingOutputDirectory } =
        await import("../internal/transform-delivery-epoch");
      const execute = async () => {
        await assertAPassIgnoresAnAppearingOutputDirectory();
      };
      return await execute();
    },
  case_transformttsc_a_build_pass_ignores_an_undeclared_project_file_edit:
    async () => {
      const { assertAPassIgnoresAnUndeclaredProjectFileEdit } =
        await import("../internal/transform-delivery-epoch");
      const execute = async () => {
        await assertAPassIgnoresAnUndeclaredProjectFileEdit();
      };
      return await execute();
    },
  case_transformttsc_a_build_pass_recompiles_after_a_membership_change:
    async () => {
      const { assertAPassRecompilesAfterAMembershipChange } =
        await import("../internal/transform-delivery-epoch");
      const execute = async () => {
        await assertAPassRecompilesAfterAMembershipChange();
      };
      return await execute();
    },
  case_transformttsc_a_build_pass_recompiles_after_a_membership_removal:
    async () => {
      const { assertAPassRecompilesAfterAMembershipRemoval } =
        await import("../internal/transform-delivery-epoch");
      const execute = async () => {
        await assertAPassRecompilesAfterAMembershipRemoval();
      };
      return await execute();
    },
  case_transformttsc_a_build_pass_recompiles_after_a_module_edit: async () => {
    const { assertAPassRecompilesAfterAModuleEdit } =
      await import("../internal/transform-delivery-epoch");
    const execute = async () => {
      await assertAPassRecompilesAfterAModuleEdit();
    };
    return await execute();
  },
  case_transformttsc_a_build_pass_recompiles_after_a_type_only_input_edit:
    async () => {
      const { assertAPassRecompilesAfterATypeOnlyInputEdit } =
        await import("../internal/transform-delivery-epoch");
      const execute = async () => {
        await assertAPassRecompilesAfterATypeOnlyInputEdit();
      };
      return await execute();
    },
  case_transformttsc_a_failed_compile_watches_and_reports_plainly: async () => {
    const { assertAFailedCompileWatchesAndReportsPlainly } =
      await import("../internal/transform-program-output");
    const execute = async () => {
      await assertAFailedCompileWatchesAndReportsPlainly();
    };
    return await execute();
  },
  case_transformttsc_a_new_pass_retries_an_unstable_generation: async () => {
    const { assertANewPassRetriesAnUnstableGeneration } =
      await import("../internal/transform-delivery-epoch");
    const execute = async () => {
      await assertANewPassRetriesAnUnstableGeneration();
    };
    return await execute();
  },
  case_transformttsc_a_new_source_is_detected_in_any_directory: async () => {
    const { assertANewSourceIsDetectedInAnyDirectory } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertANewSourceIsDetectedInAnyDirectory();
    };
    return await execute();
  },
  case_transformttsc_a_persistent_host_ignores_emitted_output: async () => {
    const { assertAPersistentHostIgnoresEmittedOutput } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertAPersistentHostIgnoresEmittedOutput();
    };
    return await execute();
  },
  case_transformttsc_a_repeated_delivery_inside_a_pass_revalidates:
    async () => {
      const { assertARepeatedDeliveryInsideAPassRevalidates } =
        await import("../internal/transform-delivery-epoch");
      const execute = async () => {
        await assertARepeatedDeliveryInsideAPassRevalidates();
      };
      return await execute();
    },
  case_transformttsc_absolutizes_relative_plugin_config_paths_in_generated_tsconfig:
    async () => {
      const { assertTransformAbsolutizesPluginConfigPaths } =
        await import("../internal/transform-compiler-options");
      const execute = async () => {
        await assertTransformAbsolutizesPluginConfigPaths();
      };
      return await execute();
    },
  case_transformttsc_absolutizes_relative_plugin_configfile_paths_in_generated_tsconfig:
    async () => {
      const { assertTransformAbsolutizesPluginConfigFilePaths } =
        await import("../internal/transform-compiler-options");
      const execute = async () => {
        await assertTransformAbsolutizesPluginConfigFilePaths();
      };
      return await execute();
    },
  case_transformttsc_accepts_compileroptions_plugins_as_an_inline_override:
    async () => {
      const { assertTransformUsesInlineCompilerOptions } =
        await import("../internal/transform-compiler-options");
      const execute = async () => {
        await assertTransformUsesInlineCompilerOptions();
      };
      return await execute();
    },
  case_transformttsc_adds_no_watch_files_without_plugin_dependencies:
    async () => {
      const { assertTransformWithoutDependenciesAddsOnlyHostWatchFiles } =
        await import("../internal/transform-dependencies");
      const execute = async () => {
        await assertTransformWithoutDependenciesAddsOnlyHostWatchFiles();
      };
      return await execute();
    },
  case_transformttsc_alias_overlay_discovers_project_banner_config:
    async () => {
      const { assertAliasOverlayDiscoversProjectBannerConfig } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertAliasOverlayDiscoversProjectBannerConfig();
      };
      return await execute();
    },
  case_transformttsc_alias_overlay_honors_project_strip_config: async () => {
    const { assertAliasOverlayHonorsProjectStripConfig } =
      await import("../internal/transform-utility-plugin-config");
    const execute = async () => {
      await assertAliasOverlayHonorsProjectStripConfig();
    };
    return await execute();
  },
  case_transformttsc_alias_overlay_ignores_strip_config_planted_in_temp_dir:
    async () => {
      const { assertAliasOverlayIgnoresStripConfigPlantedInTempDir } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertAliasOverlayIgnoresStripConfigPlantedInTempDir();
      };
      return await execute();
    },
  case_transformttsc_alias_overlay_matches_no_alias_strip_output: async () => {
    const { assertAliasOverlayMatchesNoAliasStripOutput } =
      await import("../internal/transform-utility-plugin-config");
    const execute = async () => {
      await assertAliasOverlayMatchesNoAliasStripOutput();
    };
    return await execute();
  },
  case_transformttsc_alias_overlay_merges_paths_from_extended_jsonc_tsconfig:
    async () => {
      const { assertAliasOverlayMergesExtendedJsoncPaths } =
        await import("../internal/transform-alias-resolution");
      const execute = async () => {
        await assertAliasOverlayMergesExtendedJsoncPaths();
      };
      return await execute();
    },
  case_transformttsc_alias_overlay_preserves_unaliased_tsconfig_paths:
    async () => {
      const { assertAliasOverlayPreservesUnaliasedPaths } =
        await import("../internal/transform-alias-resolution");
      const execute = async () => {
        await assertAliasOverlayPreservesUnaliasedPaths();
      };
      return await execute();
    },
  case_transformttsc_alias_overlay_resolves_extends_as_a_file: async () => {
    const { TestProject } = await import("@ttsc/testing");
    const assert: typeof import("node:assert/strict") = (
      await import("node:assert/strict")
    ).default;
    const fs: typeof import("node:fs") = (await import("node:fs")).default;
    const path: typeof import("node:path") = (await import("node:path"))
      .default;
    const { readEffectiveTsconfigPaths } =
      await import("../../../../packages/unplugin/lib/core/tsconfigPaths.js");
    const execute = () => {
      const root = TestProject.tmpdir("ttsc-unplugin-extends-");
      const configDirectory = path.join(root, "config");
      const project = path.join(root, "project");
      fs.mkdirSync(configDirectory, { recursive: true });
      fs.mkdirSync(project, { recursive: true });
      fs.writeFileSync(
        path.join(configDirectory, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: { paths: { "directory/*": ["./directory/*"] } },
        }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(root, "config.json"),
        JSON.stringify({
          compilerOptions: { paths: { "file/*": ["./file/*"] } },
        }),
        "utf8",
      );
      const tsconfig = path.join(project, "tsconfig.json");
      fs.writeFileSync(
        tsconfig,
        JSON.stringify({ extends: "../config", compilerOptions: {} }),
        "utf8",
      );

      assert.deepEqual(readEffectiveTsconfigPaths(tsconfig), {
        "file/*": [path.join(root, "file", "*").replace(/\\/g, "/")],
      });

      fs.unlinkSync(path.join(root, "config.json"));
      assert.deepEqual(readEffectiveTsconfigPaths(tsconfig), {});

      fs.writeFileSync(
        path.join(root, "explicit.json.json"),
        JSON.stringify({
          compilerOptions: { paths: { "double/*": ["./double/*"] } },
        }),
        "utf8",
      );
      fs.writeFileSync(
        tsconfig,
        JSON.stringify({ extends: "../explicit.json", compilerOptions: {} }),
        "utf8",
      );
      assert.deepEqual(
        readEffectiveTsconfigPaths(tsconfig),
        {},
        "an explicit .json target must not probe a double suffix",
      );
    };
    return await execute();
  },
  case_transformttsc_alias_overlay_resolves_package_tsconfig_preset_paths:
    async () => {
      const { assertAliasOverlayResolvesPackageTsconfigPresetPaths } =
        await import("../internal/transform-alias-resolution");
      const execute = async () => {
        await assertAliasOverlayResolvesPackageTsconfigPresetPaths();
      };
      return await execute();
    },
  case_transformttsc_alias_overlay_resolves_relative_configfile: async () => {
    const { assertAliasOverlayResolvesRelativeConfigFile } =
      await import("../internal/transform-utility-plugin-config");
    const execute = async () => {
      await assertAliasOverlayResolvesRelativeConfigFile();
    };
    return await execute();
  },
  case_transformttsc_aliased_candidate_proof_failure_stays_lexical:
    async () => {
      const { assertAliasedCandidateProofFailureStaysLexical } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertAliasedCandidateProofFailureStaysLexical();
      };
      return await execute();
    },
  case_transformttsc_allowjs_decides_javascript_membership: async () => {
    const { assertAllowJsDecidesJavaScriptMembership } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertAllowJsDecidesJavaScriptMembership();
    };
    return await execute();
  },
  case_transformttsc_an_out_of_program_module_does_not_fail_the_pass:
    async () => {
      const { assertAnOutOfProgramModuleDoesNotFailThePass } =
        await import("../internal/transform-terminal-verdict");
      const execute = async () => {
        await assertAnOutOfProgramModuleDoesNotFailThePass();
      };
      return await execute();
    },
  case_transformttsc_an_out_of_program_module_is_passed_through_and_reported:
    async () => {
      const { assertAnOutOfProgramModuleIsPassedThroughAndReported } =
        await import("../internal/transform-program-output");
      const execute = async () => {
        await assertAnOutOfProgramModuleIsPassedThroughAndReported();
      };
      return await execute();
    },
  case_transformttsc_applies_package_discovered_project_plugins: async () => {
    const { assertTransformUsesPackageDiscoveredProjectPlugins } =
      await import("../internal/transform-compiler-options");
    const execute = async () => {
      await assertTransformUsesPackageDiscoveredProjectPlugins();
    };
    return await execute();
  },
  case_transformttsc_applies_top_level_plugin_overrides_in_order: async () => {
    const { assertTransformAppliesOrderedPluginOverrides } =
      await import("../internal/transform-plugin-overrides");
    const execute = async () => {
      await assertTransformAppliesOrderedPluginOverrides();
    };
    return await execute();
  },
  case_transformttsc_avoids_rehashing_the_project_for_each_first_module_delivery:
    async () => {
      const { assertFirstModuleDeliveriesDoNotRehashProject } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertFirstModuleDeliveriesDoNotRehashProject();
      };
      return await execute();
    },
  case_transformttsc_banner_narrows_the_entry_watch_inputs: async () => {
    const { assertBannerNarrowsTheEntryWatchInputs } =
      await import("../internal/transform-linked-completeness");
    const execute = async () => {
      await assertBannerNarrowsTheEntryWatchInputs();
    };
    return await execute();
  },
  case_transformttsc_banner_narrows_through_the_alias_overlay: async () => {
    const { assertBannerNarrowsThroughTheAliasOverlay } =
      await import("../internal/transform-linked-completeness");
    const execute = async () => {
      await assertBannerNarrowsThroughTheAliasOverlay();
    };
    return await execute();
  },
  case_transformttsc_bounds_generation_mutation_witnesses: async () => {
    const { assertGenerationMutationWitnessesStayBounded } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertGenerationMutationWitnessesStayBounded();
    };
    return await execute();
  },
  case_transformttsc_bounds_watch_derivation_probes_per_module: async () => {
    const { assertSiblingDeliveriesDoNotReprobeGraph } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertSiblingDeliveriesDoNotReprobeGraph();
    };
    return await execute();
  },
  case_transformttsc_cache_hits_when_a_plugin_emits_an_out_of_walk_output_key:
    async () => {
      const { assertCacheHitsDespiteOutOfWalkOutputKey } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertCacheHitsDespiteOutOfWalkOutputKey();
      };
      return await execute();
    },
  case_transformttsc_caches_one_compile_across_a_multi_file_project:
    async () => {
      const { assertCacheTransformsMultiFileProjectOnce } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertCacheTransformsMultiFileProjectOnce();
      };
      return await execute();
    },
  case_transformttsc_caches_one_compile_with_unproven_resolution_candidates:
    async () => {
      const { assertUnprovenCandidatesKeepOneCompile } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertUnprovenCandidatesKeepOneCompile();
      };
      return await execute();
    },
  case_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output:
    async () => {
      const { assertCompileSnapshotAbaRaceCannotAuthorizeStaleOutput } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertCompileSnapshotAbaRaceCannotAuthorizeStaleOutput();
      };
      return await execute();
    },
  case_transformttsc_compile_snapshot_race_cannot_authorize_stale_output:
    async () => {
      const { assertCompileSnapshotRaceCannotAuthorizeStaleOutput } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertCompileSnapshotRaceCannotAuthorizeStaleOutput();
      };
      return await execute();
    },
  case_transformttsc_complete_validation_proves_each_input_once: async () => {
    const { assertCompleteValidationProvesEachInputOnce } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertCompleteValidationProvesEachInputOnce();
    };
    return await execute();
  },
  case_transformttsc_completeness_narrows_persistent_cache_validation:
    async () => {
      const { assertCompletenessNarrowsPersistentCacheValidation } =
        await import("../internal/transform-complete");
      const execute = async () => {
        await assertCompletenessNarrowsPersistentCacheValidation();
      };
      return await execute();
    },
  case_transformttsc_composed_plugins_keep_the_wider_bound: async () => {
    const { assertComposedPluginsKeepTheWiderBound } =
      await import("../internal/transform-linked-completeness");
    const execute = async () => {
      await assertComposedPluginsKeepTheWiderBound();
    };
    return await execute();
  },
  case_transformttsc_composes_a_mixed_completeness_envelope_per_file:
    async () => {
      const { assertMixedCompletenessEnvelopeComposesPerFile } =
        await import("../internal/transform-complete");
      const execute = async () => {
        await assertMixedCompletenessEnvelopeComposesPerFile();
      };
      return await execute();
    },
  case_transformttsc_declaration_classification_is_separator_neutral:
    async () => {
      const assert: typeof import("node:assert") = (await import("node:assert"))
        .default;
      const { isDeclarationFile } =
        await import("../../../../packages/unplugin/lib/core/transform.js");
      const execute = () => {
        assert.equal(
          isDeclarationFile("C:\\repo.d.cache\\src\\main.ts"),
          false,
        );
        assert.equal(isDeclarationFile("/repo.d.cache/src/main.ts"), false);
        assert.equal(isDeclarationFile("C:\\repo\\src\\types.d.css.ts"), true);
        assert.equal(isDeclarationFile("/repo/src/types.d.css.ts"), true);
      };
      return await execute();
    },
  case_transformttsc_descriptor_input_race_cannot_authorize_stale_generation:
    async () => {
      const { assertDescriptorInputRaceCannotAuthorizeStaleGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertDescriptorInputRaceCannotAuthorizeStaleGeneration();
      };
      return await execute();
    },
  case_transformttsc_directory_shaped_config_candidate_keeps_the_generation:
    async () => {
      const { assertDirectoryShapedConfigCandidateKeepsTheGeneration } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertDirectoryShapedConfigCandidateKeepsTheGeneration();
      };
      return await execute();
    },
  case_transformttsc_does_not_serve_a_superseded_matching_generation:
    async () => {
      const { assertSupersededMatchingGenerationIsNotServed } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertSupersededMatchingGenerationIsNotServed();
      };
      return await execute();
    },
  case_transformttsc_eviction_keeps_a_newer_generation_for_the_same_key:
    async () => {
      const { assertStaleEvictionKeepsNewerGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertStaleEvictionKeepsNewerGeneration();
      };
      return await execute();
    },
  case_transformttsc_evicts_a_host_exception_transform_and_recovers:
    async () => {
      const { assertHostExceptionTransformIsEvictedAndRecovers } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertHostExceptionTransformIsEvictedAndRecovers();
      };
      return await execute();
    },
  case_transformttsc_evicts_a_rejected_transform_and_recovers: async () => {
    const { assertRejectedTransformIsEvictedAndRecovers } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertRejectedTransformIsEvictedAndRecovers();
    };
    return await execute();
  },
  case_transformttsc_excludes_the_generated_tsconfig_from_watch_files:
    async () => {
      const { assertGeneratedTsconfigIsNotRegistered } =
        await import("../internal/transform-graph");
      const execute = async () => {
        await assertGeneratedTsconfigIsNotRegistered();
      };
      return await execute();
    },
  case_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output:
    async () => {
      const { assertExternalCompileSnapshotAbaRaceCannotAuthorizeStaleOutput } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertExternalCompileSnapshotAbaRaceCannotAuthorizeStaleOutput();
      };
      return await execute();
    },
  case_transformttsc_external_validation_ignores_the_generated_tsconfig:
    async () => {
      const { assertExternalValidationIgnoresGeneratedTsconfig } =
        await import("../internal/transform-external");
      const execute = async () => {
        await assertExternalValidationIgnoresGeneratedTsconfig();
      };
      return await execute();
    },
  case_transformttsc_failed_notifications_fall_back_to_complete_validation:
    async () => {
      const { assertFailedNotificationsFallBackToCompleteValidation } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertFailedNotificationsFallBackToCompleteValidation();
      };
      return await execute();
    },
  case_transformttsc_filesystem_operations_are_cache_local: async () => {
    const { assertFilesystemOperationsAreCacheLocal } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertFilesystemOperationsAreCacheLocal();
    };
    return await execute();
  },
  case_transformttsc_forwards_plugin_dependencies_to_the_watch_hook:
    async () => {
      const { assertTransformForwardsDependenciesToWatchHook } =
        await import("../internal/transform-dependencies");
      const execute = async () => {
        await assertTransformForwardsDependenciesToWatchHook();
      };
      return await execute();
    },
  case_transformttsc_generated_tsconfig_omits_baseurl_and_uses_absolute_alias_targets:
    async () => {
      const { assertGeneratedTsconfigOmitsBaseUrl } =
        await import("../internal/transform-generated-tsconfig-shape");
      const execute = async () => {
        await assertGeneratedTsconfigOmitsBaseUrl();
      };
      return await execute();
    },
  case_transformttsc_hashed_bundle_output_keeps_the_generation: async () => {
    const { assertHashedBundleOutputKeepsTheGeneration } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertHashedBundleOutputKeepsTheGeneration();
    };
    return await execute();
  },
  case_transformttsc_ignores_bundler_virtual_modules: async () => {
    const { assertTransformIgnoresVirtualModules } =
      await import("../internal/transform-virtual-modules");
    const execute = async () => {
      await assertTransformIgnoresVirtualModules();
    };
    return await execute();
  },
  case_transformttsc_predicate_proofs_cover_filesystem_kinds_and_transitions:
    async () => {
      const { assertPredicateProofMatrix } =
        await import("../internal/transform-input-observation");
      assertPredicateProofMatrix();
    },
  case_transformttsc_ignores_completeness_for_a_volatile_file: async () => {
    const { assertVolatileFileIgnoresItsCompletenessDeclaration } =
      await import("../internal/transform-complete");
    const execute = async () => {
      await assertVolatileFileIgnoresItsCompletenessDeclaration();
    };
    return await execute();
  },
  case_transformttsc_incomplete_project_snapshot_retries_within_generation:
    async () => {
      const { assertIncompleteProjectSnapshotRetriesWithinGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertIncompleteProjectSnapshotRetriesWithinGeneration();
      };
      return await execute();
    },
  case_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output:
    async () => {
      const {
        assertIndependentGraphLeafCompileSnapshotAbaRaceCannotAuthorizeStaleOutput,
      } = await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertIndependentGraphLeafCompileSnapshotAbaRaceCannotAuthorizeStaleOutput();
      };
      return await execute();
    },
  case_transformttsc_invalidates_project_cache_through_a_linked_graph_edge:
    async () => {
      const { assertCacheInvalidatesThroughLinkedGraphEdge } =
        await import("../internal/transform-external");
      const execute = async () => {
        await assertCacheInvalidatesThroughLinkedGraphEdge();
      };
      return await execute();
    },
  case_transformttsc_invalidates_project_cache_through_an_external_graph_edge:
    async () => {
      const { assertCacheInvalidatesThroughExternalGraphEdge } =
        await import("../internal/transform-external");
      const execute = async () => {
        await assertCacheInvalidatesThroughExternalGraphEdge();
      };
      return await execute();
    },
  case_transformttsc_invalidates_project_cache_when_a_node_modules_declaration_changes:
    async () => {
      const { assertCacheInvalidatesOnNodeModulesDeclarationChange } =
        await import("../internal/transform-external");
      const execute = async () => {
        await assertCacheInvalidatesOnNodeModulesDeclarationChange();
      };
      return await execute();
    },
  case_transformttsc_invalidates_project_cache_when_an_external_input_changes:
    async () => {
      const { assertCacheInvalidatesOnExternalInputChange } =
        await import("../internal/transform-external");
      const execute = async () => {
        await assertCacheInvalidatesOnExternalInputChange();
      };
      return await execute();
    },
  case_transformttsc_invalidates_project_cache_when_another_project_source_changes:
    async () => {
      const { assertTransformCacheInvalidatesOnProjectSourceChange } =
        await import("../internal/transform-compiler-options");
      const execute = async () => {
        await assertTransformCacheInvalidatesOnProjectSourceChange();
      };
      return await execute();
    },
  case_transformttsc_invalidates_project_cache_when_lib_source_changes:
    async () => {
      const { assertTransformCacheInvalidatesOnLibSourceChange } =
        await import("../internal/transform-compiler-options");
      const execute = async () => {
        await assertTransformCacheInvalidatesOnLibSourceChange();
      };
      return await execute();
    },
  case_transformttsc_invalidates_project_cache_when_source_changes:
    async () => {
      const { assertTransformCacheInvalidatesOnSourceChange } =
        await import("../internal/transform-compiler-options");
      const execute = async () => {
        await assertTransformCacheInvalidatesOnSourceChange();
      };
      return await execute();
    },
  case_transformttsc_invalidates_the_generation_when_a_candidate_appears:
    async () => {
      const { assertAppearingCandidateInvalidatesGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertAppearingCandidateInvalidatesGeneration();
      };
      return await execute();
    },
  case_transformttsc_keeps_generated_tsconfig_outside_the_project_root:
    async () => {
      const { assertGeneratedTsconfigStaysOutsideProjectRoot } =
        await import("../internal/transform-compiler-options");
      const execute = async () => {
        await assertGeneratedTsconfigStaysOutsideProjectRoot();
      };
      return await execute();
    },
  case_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies:
    async () => {
      const { assertCompleteFileWithoutDependenciesKeepsOnlyUniversalInputs } =
        await import("../internal/transform-complete");
      const execute = async () => {
        await assertCompleteFileWithoutDependenciesKeepsOnlyUniversalInputs();
      };
      return await execute();
    },
  case_transformttsc_keeps_the_generation_when_a_non_input_is_written_during_a_compile:
    async () => {
      const { assertNonInputWriteDuringCompileKeepsGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertNonInputWriteDuringCompileKeepsGeneration();
      };
      return await execute();
    },
  case_transformttsc_leaves_source_unchanged_when_plugins_are_disabled:
    async () => {
      const { assertTransformSkipsProjectPlugins } =
        await import("../internal/transform-disable-plugins");
      const execute = async () => {
        await assertTransformSkipsProjectPlugins();
      };
      return await execute();
    },
  case_transformttsc_narrows_watch_inputs_for_a_file_declared_complete:
    async () => {
      const { assertCompleteFileNarrowsToDeclaredAndUniversalInputs } =
        await import("../internal/transform-complete");
      const execute = async () => {
        await assertCompleteFileNarrowsToDeclaredAndUniversalInputs();
      };
      return await execute();
    },
  case_transformttsc_never_signals_volatility_without_a_declaration:
    async () => {
      const { assertNonVolatileFileNeverSignalsVolatility } =
        await import("../internal/transform-volatile");
      const execute = async () => {
        await assertNonVolatileFileNeverSignalsVolatility();
      };
      return await execute();
    },
  case_transformttsc_non_source_host_inputs_are_still_proven: async () => {
    const { assertNonSourceHostInputsAreStillProven } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertNonSourceHostInputsAreStillProven();
    };
    return await execute();
  },
  case_transformttsc_notified_absent_candidate_is_not_reprobed: async () => {
    const { assertNotifiedAbsentCandidateIsNotReprobed } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertNotifiedAbsentCandidateIsNotReprobed();
    };
    return await execute();
  },
  case_transformttsc_notifies_watch_files_on_cached_transforms: async () => {
    const { assertCachedTransformStillNotifiesWatchFiles } =
      await import("../internal/transform-dependencies");
    const execute = async () => {
      await assertCachedTransformStillNotifiesWatchFiles();
    };
    return await execute();
  },
  case_transformttsc_one_failed_tracker_falls_back_to_complete_validation:
    async () => {
      const { assertOneFailedTrackerFallsBackToCompleteValidation } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertOneFailedTrackerFallsBackToCompleteValidation();
      };
      return await execute();
    },
  case_transformttsc_out_of_project_candidate_is_still_probed: async () => {
    const { assertOutOfProjectCandidateIsStillProbed } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertOutOfProjectCandidateIsStillProbed();
    };
    return await execute();
  },
  case_transformttsc_out_of_walk_source_change_stabilizes_within_generation:
    async () => {
      const { assertOutOfWalkSourceChangeStabilizesWithinGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertOutOfWalkSourceChangeStabilizesWithinGeneration();
      };
      return await execute();
    },
  case_transformttsc_out_of_walk_source_outputs_share_one_generation:
    async () => {
      const { assertOutOfWalkSourceOutputsShareGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertOutOfWalkSourceOutputsShareGeneration();
      };
      return await execute();
    },
  case_transformttsc_passes_bundler_aliases_through_compileroptions_paths:
    async () => {
      const { assertTransformPassesBundlerAliases } =
        await import("../internal/transform-vite-aliases");
      const execute = async () => {
        await assertTransformPassesBundlerAliases();
      };
      return await execute();
    },
  case_transformttsc_paths_keeps_the_host_owned_bound: async () => {
    const { assertPathsKeepsTheHostOwnedBound } =
      await import("../internal/transform-linked-completeness");
    const execute = async () => {
      await assertPathsKeepsTheHostOwnedBound();
    };
    return await execute();
  },
  case_transformttsc_persistent_banner_config_edit_invalidates_transform:
    async () => {
      const { assertPersistentBannerConfigEditInvalidatesTransform } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertPersistentBannerConfigEditInvalidatesTransform();
      };
      return await execute();
    },
  case_transformttsc_persistent_banner_config_supersession_invalidates_transform:
    async () => {
      const { assertPersistentBannerConfigSupersessionInvalidatesTransform } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertPersistentBannerConfigSupersessionInvalidatesTransform();
      };
      return await execute();
    },
  case_transformttsc_persistent_cache_validates_inputs_before_first_module_delivery:
    async () => {
      const { assertPersistentCacheValidatesAnUnservedModule } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertPersistentCacheValidatesAnUnservedModule();
      };
      return await execute();
    },
  case_transformttsc_persistent_diagnostics_are_reported_once_per_generation:
    async () => {
      const { assertPersistentDiagnosticsAreReportedOncePerGeneration } =
        await import("../internal/transform-terminal-verdict");
      const execute = async () => {
        await assertPersistentDiagnosticsAreReportedOncePerGeneration();
      };
      return await execute();
    },
  case_transformttsc_persistent_incomplete_project_snapshot_fails_after_bounded_attempts:
    async () => {
      const {
        assertPersistentIncompleteProjectSnapshotFailsAfterBoundedAttempts,
      } = await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertPersistentIncompleteProjectSnapshotFailsAfterBoundedAttempts();
      };
      return await execute();
    },
  case_transformttsc_persistent_strip_defaults_yield_to_an_appearing_config:
    async () => {
      const { assertPersistentStripDefaultsYieldToAnAppearingConfig } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertPersistentStripDefaultsYieldToAnAppearingConfig();
      };
      return await execute();
    },
  case_transformttsc_persistent_utility_config_dependencies_invalidate_the_generation:
    async () => {
      const {
        assertPersistentUtilityConfigDependencyEditInvalidatesTransform,
      } = await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertPersistentUtilityConfigDependencyEditInvalidatesTransform();
      };
      return await execute();
    },
  case_transformttsc_persistent_utility_config_link_retarget_invalidates_generation:
    async () => {
      const { assertPersistentUtilityConfigLinkRetargetInvalidatesTransform } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertPersistentUtilityConfigLinkRetargetInvalidatesTransform();
      };
      return await execute();
    },
  case_transformttsc_persistent_validation_proves_shared_inputs_once:
    async () => {
      const { assertPersistentValidationProvesSharedInputsOnce } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertPersistentValidationProvesSharedInputsOnce();
      };
      return await execute();
    },
  case_transformttsc_persistent_validation_uses_per_file_inputs: async () => {
    const { assertPersistentValidationUsesPerFileInputs } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertPersistentValidationUsesPerFileInputs();
    };
    return await execute();
  },
  case_transformttsc_proven_out_of_walk_source_without_graph_node_keeps_generation:
    async () => {
      const { assertProvenOutOfWalkSourceWithoutGraphNodeKeepsGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertProvenOutOfWalkSourceWithoutGraphNodeKeepsGeneration();
      };
      return await execute();
    },
  case_transformttsc_reads_plugins_from_the_discovered_tsconfig: async () => {
    const { assertTransformReadsDiscoveredTsconfig } =
      await import("../internal/transform-project-config");
    const execute = async () => {
      await assertTransformReadsDiscoveredTsconfig();
    };
    return await execute();
  },
  case_transformttsc_recreated_candidate_directory_invalidates_generation:
    async () => {
      const { assertRecreatedCandidateDirectoryInvalidatesGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertRecreatedCandidateDirectoryInvalidatesGeneration();
      };
      return await execute();
    },
  case_transformttsc_recreating_the_output_directory_costs_nothing:
    async () => {
      const { assertRecreatingTheOutputDirectoryCostsNothing } =
        await import("../internal/transform-program-membership");
      const execute = async () => {
        await assertRecreatingTheOutputDirectoryCostsNothing();
      };
      return await execute();
    },
  case_transformttsc_registers_graph_and_dependencies_as_a_union: async () => {
    const { assertGraphAndDependenciesRegisterAsUnion } =
      await import("../internal/transform-graph");
    const execute = async () => {
      await assertGraphAndDependenciesRegisterAsUnion();
    };
    return await execute();
  },
  case_transformttsc_registers_graph_reach_globals_and_configs_as_watch_files:
    async () => {
      const { assertTransformRegistersGraphReachGlobalsAndConfigs } =
        await import("../internal/transform-graph");
      const execute = async () => {
        await assertTransformRegistersGraphReachGlobalsAndConfigs();
      };
      return await execute();
    },
  case_transformttsc_repeated_build_passes_reuse_one_generation: async () => {
    const { assertRepeatedPassesReuseOneGeneration } =
      await import("../internal/transform-delivery-epoch");
    const execute = async () => {
      await assertRepeatedPassesReuseOneGeneration();
    };
    return await execute();
  },
  case_transformttsc_replays_the_project_cache_when_external_inputs_are_unchanged:
    async () => {
      const { assertCacheReplaysWhenExternalInputsUnchanged } =
        await import("../internal/transform-external");
      const execute = async () => {
        await assertCacheReplaysWhenExternalInputsUnchanged();
      };
      return await execute();
    },
  case_transformttsc_reports_generation_diagnostics_once_per_pass: async () => {
    const { assertGenerationDiagnosticsAreReportedOncePerPass } =
      await import("../internal/transform-terminal-verdict");
    const execute = async () => {
      await assertGenerationDiagnosticsAreReportedOncePerPass();
    };
    return await execute();
  },
  case_transformttsc_reports_native_transform_diagnostics: async () => {
    const { assertTransformReportsNativeDiagnostics } =
      await import("../internal/transform-diagnostics");
    const execute = async () => {
      await assertTransformReportsNativeDiagnostics();
    };
    return await execute();
  },
  case_transformttsc_reports_untranslatable_vite_aliases: async () => {
    const { assertUntranslatableAliasesAreReported } =
      await import("../internal/transform-vite-aliases");
    const execute = async () => {
      await assertUntranslatableAliasesAreReported();
    };
    return await execute();
  },
  case_transformttsc_resolves_a_relative_project_option_from_cwd: async () => {
    const { assertTransformUsesRelativeProjectOption } =
      await import("../internal/transform-project-option");
    const execute = async () => {
      await assertTransformUsesRelativeProjectOption();
    };
    return await execute();
  },
  case_transformttsc_resolves_types_through_alias_overlapping_tsconfig_paths:
    async () => {
      const { assertAliasOverlapResolvesTypes } =
        await import("../internal/transform-alias-resolution");
      const execute = async () => {
        await assertAliasOverlapResolvesTypes();
      };
      return await execute();
    },
  case_transformttsc_retargeted_candidate_link_invalidates_generation:
    async () => {
      const { assertRetargetedCandidateLinkInvalidatesGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertRetargetedCandidateLinkInvalidatesGeneration();
      };
      return await execute();
    },
  case_transformttsc_retries_a_newer_generation_after_a_stale_input_mismatch:
    async () => {
      const { assertStaleMismatchUsesNewerGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertStaleMismatchUsesNewerGeneration();
      };
      return await execute();
    },
  case_transformttsc_returns_code_without_fabricated_source_maps: async () => {
    const { assertTransformResultHasNoSyntheticSourceMap } =
      await import("../internal/transform-compiler-options");
    const execute = async () => {
      await assertTransformResultHasNoSyntheticSourceMap();
    };
    return await execute();
  },
  case_transformttsc_same_tick_derived_rewrite_replaces_the_generation:
    async () => {
      const { assertSameTickDerivedRewriteReplacesTheGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertSameTickDerivedRewriteReplacesTheGeneration();
      };
      return await execute();
    },
  case_transformttsc_same_tick_rewrite_replaces_the_snapshot_generation:
    async () => {
      const { assertSameTickRewriteReplacesTheSnapshotGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertSameTickRewriteReplacesTheSnapshotGeneration();
      };
      return await execute();
    },
  case_transformttsc_same_tick_universal_rewrite_replaces_the_generation:
    async () => {
      const { assertSameTickUniversalRewriteReplacesTheGeneration } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertSameTickUniversalRewriteReplacesTheGeneration();
      };
      return await execute();
    },
  case_transformttsc_separated_stamp_re_earns_its_signature: async () => {
    const { assertSeparatedStampReEarnsItsSignature } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertSeparatedStampReEarnsItsSignature();
    };
    return await execute();
  },
  case_transformttsc_shares_one_compile_across_concurrent_callers: async () => {
    const { assertConcurrentTransformsCompileOnce } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertConcurrentTransformsCompileOnce();
    };
    return await execute();
  },
  case_transformttsc_strip_narrows_the_entry_watch_inputs: async () => {
    const { assertStripNarrowsTheEntryWatchInputs } =
      await import("../internal/transform-linked-completeness");
    const execute = async () => {
      await assertStripNarrowsTheEntryWatchInputs();
    };
    return await execute();
  },
  case_transformttsc_synchronous_membership_change_reaches_the_next_delivery:
    async () => {
      const { assertSynchronousMembershipChangeReachesTheNextDelivery } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertSynchronousMembershipChangeReachesTheNextDelivery();
      };
      return await execute();
    },
  case_transformttsc_the_policy_reports_every_config_it_read: async () => {
    const { assertThePolicyReportsEveryConfigItRead } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertThePolicyReportsEveryConfigItRead();
    };
    return await execute();
  },
  case_transformttsc_the_walk_avoids_work_it_cannot_use: async () => {
    const { assertTheWalkAvoidsWorkItCannotUse } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertTheWalkAvoidsWorkItCannotUse();
    };
    return await execute();
  },
  case_transformttsc_the_walk_predicate_matches_the_walk: async () => {
    const { assertTheWalkPredicateMatchesTheWalk } =
      await import("../internal/transform-program-membership");
    const execute = async () => {
      await assertTheWalkPredicateMatchesTheWalk();
    };
    return await execute();
  },
  case_transformttsc_tracks_superseding_resolution_candidates: async () => {
    const { TestUnpluginProject, TestUnpluginRuntime } =
      await import("@ttsc/testing");
    const assert: typeof import("node:assert/strict") = (
      await import("node:assert/strict")
    ).default;
    const fs: typeof import("node:fs") = (await import("node:fs")).default;
    const path: typeof import("node:path") = (await import("node:path"))
      .default;
    const execute = async () => {
      const root = TestUnpluginProject.createProject({
        plugins: [],
        source:
          'import { winner } from "./value";\nexport const value = winner;\n',
      });
      const tsconfig = path.join(root, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
      config.compilerOptions.allowJs = true;
      fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
      const file = TestUnpluginProject.mainFile(root);
      const candidate = path.join(root, "src", "value.ts");
      fs.writeFileSync(
        path.join(root, "src", "value.js"),
        "export function winner() {}\n",
        "utf8",
      );

      const { createTtscTransformCache, resolveOptions, transformTtsc } =
        await TestUnpluginRuntime.loadUnpluginApi();
      const cache = createTtscTransformCache();
      const watched: string[] = [];
      const first = await transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        resolveOptions({ project: tsconfig }),
        undefined,
        cache,
        { addWatchFile: (input: string) => watched.push(input) },
      );
      assert.equal(first, undefined);
      assert.ok(
        watched.includes(candidate),
        `missing higher-priority candidate from watch inputs: ${watched.join(", ")}`,
      );
      assert.equal(cache.size, 1);
      const firstGeneration = [...cache.values()][0];

      fs.writeFileSync(
        candidate,
        "export function winner(): void {}\n",
        "utf8",
      );
      const second = await transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        resolveOptions({ project: tsconfig }),
        undefined,
        cache,
      );
      assert.equal(second, undefined);
      assert.notStrictEqual(
        [...cache.values()][0],
        firstGeneration,
        "creating a superseding candidate must replace the cached generation",
      );
    };
    return await execute();
  },
  case_transformttsc_unavailable_notifications_keep_the_persistent_cache:
    async () => {
      const { assertUnavailableNotificationsKeepThePersistentCache } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertUnavailableNotificationsKeepThePersistentCache();
      };
      return await execute();
    },
  case_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation:
    async () => {
      const { assertUnnotifiedUtilityConfigLinkRetargetInvalidatesTransform } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertUnnotifiedUtilityConfigLinkRetargetInvalidatesTransform();
      };
      return await execute();
    },
  case_transformttsc_unproven_out_of_walk_source_fails_after_bounded_attempts:
    async () => {
      const { assertUnprovenOutOfWalkSourceFailsAfterBoundedAttempts } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertUnprovenOutOfWalkSourceFailsAfterBoundedAttempts();
      };
      return await execute();
    },
  case_transformttsc_reported_graph_proof_failures_fail_after_bounded_attempts:
    async () => {
      const { assertReportedGraphProofFailuresFailAfterBoundedAttempts } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertReportedGraphProofFailuresFailAfterBoundedAttempts();
      };
      return await execute();
    },
  case_transformttsc_unreadable_graph_input_keeps_the_content_comparison:
    async () => {
      const { assertUnreadableGraphInputKeepsTheContentComparison } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertUnreadableGraphInputKeepsTheContentComparison();
      };
      return await execute();
    },
  case_transformttsc_unreadable_host_input_keeps_the_content_comparison:
    async () => {
      const { assertUnreadableHostInputKeepsTheContentComparison } =
        await import("../internal/transform-project-cache");
      const execute = async () => {
        await assertUnreadableHostInputKeepsTheContentComparison();
      };
      return await execute();
    },
  case_transformttsc_unrelated_file_in_a_probed_directory_keeps_the_generation:
    async () => {
      const { assertUnrelatedFileInAProbedDirectoryKeepsTheGeneration } =
        await import("../internal/transform-utility-plugin-config");
      const execute = async () => {
        await assertUnrelatedFileInAProbedDirectoryKeepsTheGeneration();
      };
      return await execute();
    },
  case_transformttsc_unwatched_absent_candidate_is_still_probed: async () => {
    const { assertUnwatchedAbsentCandidateIsStillProbed } =
      await import("../internal/transform-project-cache");
    const execute = async () => {
      await assertUnwatchedAbsentCandidateIsStillProbed();
    };
    return await execute();
  },
  case_transformttsc_uses_filesystem_path_identity: async () => {
    const { case_transformttsc_uses_filesystem_path_identity: execute } =
      await import("./filesystem-path-identity");
    return await execute();
  },
  case_transformttsc_uses_the_project_option_for_an_alternate_tsconfig:
    async () => {
      const { assertTransformUsesProjectOption } =
        await import("../internal/transform-project-option");
      const execute = async () => {
        await assertTransformUsesProjectOption();
      };
      return await execute();
    },
  case_transformttsc_volatile_file_bypasses_the_transform_cache: async () => {
    const { assertVolatileFileBypassesTransformCache } =
      await import("../internal/transform-volatile");
    const execute = async () => {
      await assertVolatileFileBypassesTransformCache();
    };
    return await execute();
  },
  case_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir: async () => {
    const { assertUndeclaredRunScrubsInheritedPluginConfigDir } =
      await import("../internal/transform-plugin-config-dir-scrub");
    const execute = async () => {
      await assertUndeclaredRunScrubsInheritedPluginConfigDir();
    };
    return await execute();
  },
} satisfies Record<string, () => Promise<unknown>>;
