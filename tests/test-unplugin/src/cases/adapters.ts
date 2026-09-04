export const ADAPTER_CASES = {
  case_adapter_entrypoints_expose_the_expected_plugin_factories: async () => {
    const { assertAdapterEntrypointsExposeFactories } =
      await import("../internal/adapter-entrypoints");
    const execute = async () => {
      await assertAdapterEntrypointsExposeFactories();
    };
    return await execute();
  },
  case_adapter_entrypoints_support_node_cjs_require: async () => {
    const { assertAdapterEntrypointsSupportCjsRequire } =
      await import("../internal/adapter-entrypoints");
    const execute = () => {
      assertAdapterEntrypointsSupportCjsRequire();
    };
    return await execute();
  },
  case_adapter_entrypoints_support_node_esm_default_import: async () => {
    const { assertAdapterEntrypointsSupportEsmDefaultImport } =
      await import("../internal/adapter-entrypoints");
    const execute = async () => {
      await assertAdapterEntrypointsSupportEsmDefaultImport();
    };
    return await execute();
  },
  case_bun_adapter_excludes_nul_virtual_ids: async () => {
    const { assertBunAdapterExcludesNulVirtualIds } =
      await import("../internal/adapter-bun");
    const execute = async () => {
      await assertBunAdapterExcludesNulVirtualIds();
    };
    return await execute();
  },
  case_bun_adapter_falls_through_for_excluded_and_unchanged_modules:
    async () => {
      const { assertBunAdapterFallsThroughWhenItDoesNotTransform } =
        await import("../internal/adapter-bun");
      const execute = async () => {
        await assertBunAdapterFallsThroughWhenItDoesNotTransform();
      };
      return await execute();
    },
  case_bun_adapter_forwards_bundler_build_start: async () => {
    const { assertBunAdapterRevalidatesOnBuildStart } =
      await import("../internal/adapter-bun");
    const execute = async () => {
      await assertBunAdapterRevalidatesOnBuildStart();
    };
    return await execute();
  },
  case_bun_adapter_passes_through_an_out_of_program_module: async () => {
    const { assertBunAdapterPassesThroughAnOutOfProgramModule } =
      await import("../internal/adapter-bun");
    const execute = async () => {
      await assertBunAdapterPassesThroughAnOutOfProgramModule();
    };
    return await execute();
  },
  case_bun_adapter_registers_an_onload_transformer_for_typescript_sources:
    async () => {
      const { assertBunAdapterTransformsSource } =
        await import("../internal/adapter-bun");
      const execute = async () => {
        await assertBunAdapterTransformsSource();
      };
      return await execute();
    },
  case_bun_adapter_survives_plugin_reported_dependencies: async () => {
    const { assertBunAdapterSurvivesPluginReportedDependencies } =
      await import("../internal/adapter-bun");
    const execute = async () => {
      await assertBunAdapterSurvivesPluginReportedDependencies();
    };
    return await execute();
  },
  case_bun_adapter_yields_to_configured_in_memory_files: async () => {
    const { assertBunAdapterYieldsToConfiguredInMemoryFiles } =
      await import("../internal/adapter-bun");
    const execute = async () => {
      await assertBunAdapterYieldsToConfiguredInMemoryFiles();
    };
    return await execute();
  },
  case_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order:
    async () => {
      const { assertBunRegisterSameRuntimeExplicitOptionsWin } =
        await import("../internal/adapter-bun-register");
      const execute = async () => {
        await assertBunRegisterSameRuntimeExplicitOptionsWin();
      };
      return await execute();
    },
  case_bun_register_preload_only_registers_a_single_default_plugin:
    async () => {
      const { assertBunRegisterPreloadOnlyRegistersOneDefaultPlugin } =
        await import("../internal/adapter-bun-register");
      const execute = async () => {
        await assertBunRegisterPreloadOnlyRegistersOneDefaultPlugin();
      };
      return await execute();
    },
  case_bun_register_preloads_the_runtime_transform_plugin: async () => {
    const { assertBunRegisterRegistersRuntimePlugin } =
      await import("../internal/adapter-bun-register");
    const execute = async () => {
      await assertBunRegisterRegistersRuntimePlugin();
    };
    return await execute();
  },
  case_bun_runtime_does_not_rehash_the_project_per_module: async () => {
    const { assertBunRuntimeDoesNotRehashProjectPerModule } =
      await import("../internal/adapter-bun");
    const execute = async () => {
      await assertBunRuntimeDoesNotRehashProjectPerModule();
    };
    return await execute();
  },
  case_bun_runtime_passes_through_unchanged_source: async () => {
    const { assertBunRuntimePassesThroughUnchangedSource } =
      await import("../internal/adapter-bun");
    const execute = async () => {
      await assertBunRuntimePassesThroughUnchangedSource();
    };
    return await execute();
  },
  case_esbuild_adapter_runs_the_configured_ttsc_source_transform: async () => {
    const { assertEsbuildAdapterTransformsSource } =
      await import("../internal/adapter-esbuild");
    const execute = async () => {
      await assertEsbuildAdapterTransformsSource();
    };
    return await execute();
  },
  case_next_adapter_does_not_double_register_across_globs: async () => {
    const { assertNextAdapterDoesNotDoubleRegisterAcrossGlobs } =
      await import("../internal/adapter-next");
    const execute = async () => {
      await assertNextAdapterDoesNotDoubleRegisterAcrossGlobs();
    };
    return await execute();
  },
  case_next_adapter_preserves_an_existing_webpack_hook: async () => {
    const { assertNextAdapterPreservesWebpackHook } =
      await import("../internal/adapter-entrypoints");
    const execute = async () => {
      await assertNextAdapterPreservesWebpackHook();
    };
    return await execute();
  },
  case_next_adapter_preserves_turbopack_config: async () => {
    const { assertNextAdapterPreservesTurbopackConfig } =
      await import("../internal/adapter-next");
    const execute = async () => {
      await assertNextAdapterPreservesTurbopackConfig();
    };
    return await execute();
  },
  case_next_adapter_warns_about_a_suppressed_webpack_hook: async () => {
    const { assertNextAdapterWarnsAboutASuppressedWebpackHook } =
      await import("../internal/adapter-next");
    const execute = async () => {
      await assertNextAdapterWarnsAboutASuppressedWebpackHook();
    };
    return await execute();
  },
  case_next_adapter_wires_both_bundlers: async () => {
    const { assertNextAdapterWiresBothBundlers } =
      await import("../internal/adapter-next");
    const execute = async () => {
      await assertNextAdapterWiresBothBundlers();
    };
    return await execute();
  },
  case_package_build_keeps_runtime_dependencies_external: async () => {
    const { assertPackageBuildKeepsRuntimeDependenciesExternal } =
      await import("../internal/adapter-entrypoints");
    const execute = () => {
      assertPackageBuildKeepsRuntimeDependenciesExternal();
    };
    return await execute();
  },
  case_packaged_entrypoints_publish_module_faithful_declarations: async () => {
    const { assertPackedEntrypointsProvideModuleFaithfulDeclarations } =
      await import("../internal/packaged-host-contract");
    const execute = () => {
      assertPackedEntrypointsProvideModuleFaithfulDeclarations();
    };
    return await execute();
  },
  case_packaged_manifest_declares_the_external_ttsc_host: async () => {
    const { assertPackedManifestDeclaresTtscHost } =
      await import("../internal/packaged-host-contract");
    const execute = async () => {
      await assertPackedManifestDeclaresTtscHost();
    };
    return await execute();
  },
  case_rollup_adapter_runs_the_configured_ttsc_source_transform: async () => {
    const { assertRollupAdapterTransformsSource } =
      await import("../internal/adapter-rollup");
    const execute = async () => {
      await assertRollupAdapterTransformsSource();
    };
    return await execute();
  },
  case_rollup_build_registers_plugin_dependencies_as_watch_files: async () => {
    const { assertRollupBuildRegistersDependencyWatchFiles } =
      await import("../internal/transform-dependencies");
    const execute = async () => {
      await assertRollupBuildRegistersDependencyWatchFiles();
    };
    return await execute();
  },
  case_rollup_disposes_at_the_right_boundary: async () => {
    const { assertRollupDisposesAtTheRightBoundary } =
      await import("../internal/adapter-rollup");
    const execute = async () => {
      await assertRollupDisposesAtTheRightBoundary();
    };
    return await execute();
  },
  case_shared_adapter_filter_accepts_source_files_and_skips_declarations:
    async () => {
      const { assertSharedAdapterFilter } =
        await import("../internal/adapter-entrypoints");
      const execute = async () => {
        await assertSharedAdapterFilter();
      };
      return await execute();
    },
  case_turbopack_loader_forwards_rule_options_to_the_transform: async () => {
    const { assertTurbopackLoaderForwardsRuleOptions } =
      await import("../internal/adapter-turbopack");
    const execute = async () => {
      await assertTurbopackLoaderForwardsRuleOptions();
    };
    return await execute();
  },
  case_turbopack_loader_marks_volatile_modules_uncacheable: async () => {
    const { assertTurbopackLoaderMarksVolatileModulesUncacheable } =
      await import("../internal/adapter-turbopack");
    const execute = async () => {
      await assertTurbopackLoaderMarksVolatileModulesUncacheable();
    };
    return await execute();
  },
  case_turbopack_loader_passes_through_an_out_of_program_module: async () => {
    const { assertTurbopackLoaderPassesThroughAnOutOfProgramModule } =
      await import("../internal/adapter-turbopack");
    const execute = async () => {
      await assertTurbopackLoaderPassesThroughAnOutOfProgramModule();
    };
    return await execute();
  },
  case_turbopack_loader_passes_through_declarations_and_node_modules:
    async () => {
      const { assertTurbopackLoaderPassesThroughFilteredPaths } =
        await import("../internal/adapter-turbopack");
      const execute = async () => {
        await assertTurbopackLoaderPassesThroughFilteredPaths();
      };
      return await execute();
    },
  case_turbopack_loader_passes_through_non_source_ids: async () => {
    const { assertTurbopackLoaderPassesThroughNonSourceIds } =
      await import("../internal/adapter-turbopack");
    const execute = async () => {
      await assertTurbopackLoaderPassesThroughNonSourceIds();
    };
    return await execute();
  },
  case_turbopack_loader_registers_no_dependencies_without_a_report:
    async () => {
      const { assertTurbopackLoaderRegistersNoDependenciesWithoutReport } =
        await import("../internal/adapter-turbopack");
      const execute = async () => {
        await assertTurbopackLoaderRegistersNoDependenciesWithoutReport();
      };
      return await execute();
    },
  case_turbopack_loader_registers_plugin_dependencies_as_file_dependencies:
    async () => {
      const { assertTurbopackLoaderRegistersPluginDependencies } =
        await import("../internal/adapter-turbopack");
      const execute = async () => {
        await assertTurbopackLoaderRegistersPluginDependencies();
      };
      return await execute();
    },
  case_turbopack_loader_registers_plugin_dependencies_on_cache_hit:
    async () => {
      const { assertTurbopackLoaderRegistersDependenciesOnCacheHit } =
        await import("../internal/adapter-turbopack");
      const execute = async () => {
        await assertTurbopackLoaderRegistersDependenciesOnCacheHit();
      };
      return await execute();
    },
  case_turbopack_loader_transforms_source_through_the_webpack_loader_contract:
    async () => {
      const { assertTurbopackLoaderTransformsSource } =
        await import("../internal/adapter-turbopack");
      const execute = async () => {
        await assertTurbopackLoaderTransformsSource();
      };
      return await execute();
    },
  case_turbopack_loader_transforms_without_an_add_dependency_context:
    async () => {
      const { assertTurbopackLoaderTransformsWithoutAddDependency } =
        await import("../internal/adapter-turbopack");
      const execute = async () => {
        await assertTurbopackLoaderTransformsWithoutAddDependency();
      };
      return await execute();
    },
  case_vite_adapter_runs_the_configured_ttsc_source_transform: async () => {
    const { assertViteAdapterTransformsSource } =
      await import("../internal/adapter-vite");
    const execute = async () => {
      await assertViteAdapterTransformsSource();
    };
    return await execute();
  },
  case_vite_build_disposes_the_generation_at_build_end: async () => {
    const { assertViteBuildDisposesTheGenerationAtBuildEnd } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertViteBuildDisposesTheGenerationAtBuildEnd();
    };
    return await execute();
  },
  case_vite_build_end_disposes_the_last_overlapping_cache_owner: async () => {
    const { assertViteBuildEndDisposesTheLastOverlappingCacheOwner } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertViteBuildEndDisposesTheLastOverlappingCacheOwner();
    };
    return await execute();
  },
  case_vite_build_tolerates_missing_resolution_candidates: async () => {
    const assert: typeof import("node:assert/strict") = (
      await import("node:assert/strict")
    ).default;
    const { buildFixture, createLinkedWorkspaceFixture } =
      await import("../internal/adapter-vite-serve");
    const execute = async () => {
      const fixture = createLinkedWorkspaceFixture();
      const code = await buildFixture(fixture);
      assert.match(code, /linked/);
    };
    return await execute();
  },
  case_vite_build_watch_disposes_the_generation_on_close_watcher: async () => {
    const { assertViteBuildWatchDisposesOnCloseWatcher } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertViteBuildWatchDisposesOnCloseWatcher();
    };
    return await execute();
  },
  case_vite_build_watch_reuses_the_generation_across_rebuilds: async () => {
    const { assertViteBuildWatchReusesTheGenerationAcrossRebuilds } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertViteBuildWatchReusesTheGenerationAcrossRebuilds();
    };
    return await execute();
  },
  case_vite_close_watcher_mid_pass_keeps_the_counter_sound: async () => {
    const { assertCloseWatcherMidPassKeepsTheCounterSound } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertCloseWatcherMidPassKeepsTheCounterSound();
    };
    return await execute();
  },
  case_vite_serve_first_request_survives_missing_resolution_candidates:
    async () => {
      const assert: typeof import("node:assert/strict") = (
        await import("node:assert/strict")
      ).default;
      const fs: typeof import("node:fs") = (await import("node:fs")).default;
      const path: typeof import("node:path") = (await import("node:path"))
        .default;
      const {
        assertFixtureDerivesMissingCandidate,
        createLinkedWorkspaceFixture,
        mainModuleNode,
        requestMainModule,
        spyReloadEvents,
        startViteServer,
        waitFor,
      } = await import("../internal/adapter-vite-serve");
      const execute = async () => {
        const fixture = createLinkedWorkspaceFixture();
        await assertFixtureDerivesMissingCandidate(fixture);
        const server = await startViteServer(fixture);
        try {
          await requestMainModule(server);
          const node = await mainModuleNode(server);
          assert.ok(
            node.transformResult !== null && node.transformResult !== undefined,
            "the first request must leave a cached transform on the module node",
          );
          const events = spyReloadEvents(server);

          const generatedTypes = path.join(fixture.typeRoot, "generated");
          fs.mkdirSync(generatedTypes);
          fs.writeFileSync(
            path.join(generatedTypes, "index.d.ts"),
            "declare const generatedTypeRootMember: unique symbol;\n",
            "utf8",
          );
          await waitFor(
            () =>
              node.transformResult === null ||
              node.transformResult === undefined,
            "the importer to be invalidated after automatic type-root membership changed",
          );
          assert.ok(
            events.some((event) => event.type === "full-reload"),
            "changing automatic type-root membership must announce a full reload",
          );
          await requestMainModule(server);
        } finally {
          await server.close();
        }
      };
      return await execute();
    },
  case_vite_serve_ignores_an_unrelated_missing_file_creation: async () => {
    const assert: typeof import("node:assert/strict") = (
      await import("node:assert/strict")
    ).default;
    const fs: typeof import("node:fs") = (await import("node:fs")).default;
    const path: typeof import("node:path") = (await import("node:path"))
      .default;
    const {
      createLinkedWorkspaceFixture,
      mainModuleNode,
      requestMainModule,
      startViteServer,
    } = await import("../internal/adapter-vite-serve");
    const execute = async () => {
      const fixture = createLinkedWorkspaceFixture();
      const server = await startViteServer(fixture);
      try {
        await requestMainModule(server);
        const node = await mainModuleNode(server);
        assert.ok(
          node.transformResult !== null && node.transformResult !== undefined,
          "the first request must leave a cached transform on the module node",
        );

        fs.writeFileSync(
          // Keep this outside the project root. A new included source under
          // `src` changes the compiler's recorded project-membership listing
          // and must invalidate; this case is the negative twin that proves a
          // creation outside every recorded predicate does not.
          path.join(path.dirname(fixture.app), "unrelated.ts"),
          "export const unrelated: number = 1;\n",
          "utf8",
        );
        // Several multiples of the 500ms poll interval: long enough for a
        // wrongly registered poller to have fired.
        await new Promise((resolve) => setTimeout(resolve, 1_600));
        assert.ok(
          node.transformResult !== null && node.transformResult !== undefined,
          "an unrelated file creation must not invalidate the entry module",
        );
      } finally {
        await server.close();
      }
    };
    return await execute();
  },
  case_vite_serve_registers_existing_watch_inputs_when_the_server_watches:
    async () => {
      const assert: typeof import("node:assert/strict") = (
        await import("node:assert/strict")
      ).default;
      const path: typeof import("node:path") = (await import("node:path"))
        .default;
      const { collectServeWatchRegistrations, createLinkedWorkspaceFixture } =
        await import("../internal/adapter-vite-serve");
      const execute = async () => {
        const fixture = createLinkedWorkspaceFixture();
        const watched = await collectServeWatchRegistrations(fixture, {
          watching: true,
        });
        const tsconfig = path.join(fixture.app, "tsconfig.json");
        assert.ok(
          watched.some((file) => path.resolve(file) === tsconfig),
          `a watching server must receive the tsconfig registration; watched: ${watched.join(", ")}`,
        );
      };
      return await execute();
    },
  case_vite_serve_registers_no_watch_inputs_without_a_watcher: async () => {
    const assert: typeof import("node:assert/strict") = (
      await import("node:assert/strict")
    ).default;
    const { collectServeWatchRegistrations, createLinkedWorkspaceFixture } =
      await import("../internal/adapter-vite-serve");
    const execute = async () => {
      const fixture = createLinkedWorkspaceFixture();
      const watched = await collectServeWatchRegistrations(fixture, {
        watching: false,
      });
      assert.deepEqual(
        watched,
        [],
        `a watcherless server must receive no watch-input registration; watched: ${watched.join(", ")}`,
      );
    };
    return await execute();
  },
  case_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears:
    async () => {
      const assert: typeof import("node:assert/strict") = (
        await import("node:assert/strict")
      ).default;
      const fs: typeof import("node:fs") = (await import("node:fs")).default;
      const {
        createLinkedWorkspaceFixture,
        mainModuleNode,
        requestMainModule,
        spyReloadEvents,
        startViteServer,
        waitFor,
      } = await import("../internal/adapter-vite-serve");
      const execute = async () => {
        const fixture = createLinkedWorkspaceFixture();
        const server = await startViteServer(fixture);
        try {
          await requestMainModule(server);
          const node = await mainModuleNode(server);
          assert.ok(
            node.transformResult !== null && node.transformResult !== undefined,
            "the first request must leave a cached transform on the module node",
          );
          const events = spyReloadEvents(server);

          fs.writeFileSync(
            fixture.supersedingSource,
            'export const linked: string = "ts";\n',
            "utf8",
          );
          await waitFor(
            () =>
              node.transformResult === null ||
              node.transformResult === undefined,
            "the importer to be invalidated after the candidate appeared",
          );
          assert.ok(
            events.some((event) => event.type === "full-reload"),
            "creating the superseding candidate must announce a full reload",
          );
          await requestMainModule(server);
        } finally {
          await server.close();
        }
      };
      return await execute();
    },
  case_vite_serve_survives_missing_candidates_after_a_server_restart:
    async () => {
      const {
        assertFixtureDerivesMissingCandidate,
        createLinkedWorkspaceFixture,
        requestMainModule,
        startViteServer,
      } = await import("../internal/adapter-vite-serve");
      const execute = async () => {
        const fixture = createLinkedWorkspaceFixture();
        await assertFixtureDerivesMissingCandidate(fixture);
        const server = await startViteServer(fixture);
        try {
          await requestMainModule(server);
          await server.restart();
          await requestMainModule(server);
        } finally {
          await server.close();
        }
      };
      return await execute();
    },
  case_vite_serve_with_a_watcher_keeps_persistent_validation: async () => {
    const { assertWatchingServeKeepsPersistentValidation } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertWatchingServeKeepsPersistentValidation();
    };
    return await execute();
  },
  case_vite_serve_without_a_watcher_revalidates_a_repeated_module: async () => {
    const { assertWatcherlessServeRevalidatesARepeatedModule } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertWatcherlessServeRevalidatesARepeatedModule();
    };
    return await execute();
  },
  case_vite_serve_without_a_watcher_serves_the_startup_generation: async () => {
    const { assertViteServeWithoutAWatcherServesTheStartupGeneration } =
      await import("../internal/adapter-vite");
    const execute = async () => {
      await assertViteServeWithoutAWatcherServesTheStartupGeneration();
    };
    return await execute();
  },
  case_vite_serve_without_a_watcher_takes_the_build_scoped_cache: async () => {
    const { assertWatcherlessServeTakesTheBuildScopedCache } =
      await import("../internal/adapter-vite-lifecycle");
    const execute = async () => {
      await assertWatcherlessServeTakesTheBuildScopedCache();
    };
    return await execute();
  },
  case_webpack_filesystem_cache_control_serves_stale_without_a_graph:
    async () => {
      const { assertWebpackFilesystemCacheServesStaleWithoutGraph } =
        await import("../internal/adapter-webpack");
      const execute = async () => {
        await assertWebpackFilesystemCacheServesStaleWithoutGraph();
      };
      return await execute();
    },
  case_webpack_filesystem_cache_rebuilds_through_a_type_only_edge: async () => {
    const { assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge } =
      await import("../internal/adapter-webpack");
    const execute = async () => {
      await assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge();
    };
    return await execute();
  },
  case_webpack_filesystem_cache_serves_stale_for_an_under_declared_complete_file:
    async () => {
      const {
        assertWebpackFilesystemCacheServesStaleForUnderDeclaredComplete,
      } = await import("../internal/adapter-webpack");
      const execute = async () => {
        await assertWebpackFilesystemCacheServesStaleForUnderDeclaredComplete();
      };
      return await execute();
    },
  case_webpack_watch_rebuilds_through_a_type_only_edge: async () => {
    const { assertWebpackWatchRebuildsThroughTypeOnlyEdge } =
      await import("../internal/adapter-webpack");
    const execute = async () => {
      await assertWebpackWatchRebuildsThroughTypeOnlyEdge();
    };
    return await execute();
  },
  case_webpack_watch_reuses_the_generation_across_rebuilds: async () => {
    const { assertWebpackWatchReusesTheGenerationAcrossRebuilds } =
      await import("../internal/adapter-webpack");
    const execute = async () => {
      await assertWebpackWatchReusesTheGenerationAcrossRebuilds();
    };
    return await execute();
  },
} satisfies Record<string, () => Promise<unknown>>;
