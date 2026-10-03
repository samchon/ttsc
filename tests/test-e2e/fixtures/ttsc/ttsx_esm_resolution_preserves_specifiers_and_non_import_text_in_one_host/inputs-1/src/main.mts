declare const process: { exitCode: number };
export {};
console.log("BEGIN:test_ttsx_rewrites_extensionless_esm_side_effect_imports");
try { await import("./case0/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_rewrites_extensionless_esm_side_effect_imports");
console.log("BEGIN:test_ttsx_rewrites_extensionless_esm_directory_index_imports");
try { await import("./case1/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_rewrites_extensionless_esm_directory_index_imports");
console.log("BEGIN:test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers");
try { await import("./case2/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers");
console.log("BEGIN:test_ttsx_esm_rewrite_leaves_strings_templates_comments_and_regex_literals_untouched");
try { await import("./case3/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_esm_rewrite_leaves_strings_templates_comments_and_regex_literals_untouched");
console.log("BEGIN:test_ttsx_builds_a_dependency_whose_project_declares_no_rootdir");
try { await import("./case4/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_builds_a_dependency_whose_project_declares_no_rootdir");
console.log("BEGIN:test_ttsx_builds_a_raw_ts_dependency_that_type_stripping_cannot_elide");
try { await import("./case5/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_builds_a_raw_ts_dependency_that_type_stripping_cannot_elide");
console.log("BEGIN:test_ttsx_preserves_enum_runtime_object_in_a_built_dependency");
try { await import("./case6/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_preserves_enum_runtime_object_in_a_built_dependency");
console.log("BEGIN:test_ttsx_preserves_runtime_namespace_value_export_in_a_built_dependency");
try { await import("./case7/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_preserves_runtime_namespace_value_export_in_a_built_dependency");
console.log("BEGIN:test_ttsx_runs_an_esm_package_raw_ts_dependency_as_a_module");
try { await import("./case8/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_runs_an_esm_package_raw_ts_dependency_as_a_module");
console.log("BEGIN:test_ttsx_runs_an_esm_package_raw_ts_dependency_that_uses_import_meta");
try { await import("./case9/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_runs_an_esm_package_raw_ts_dependency_that_uses_import_meta");
console.log("BEGIN:test_ttsx_runs_a_commonjs_package_raw_ts_dependency_with_no_module_syntax_as_commonjs");
try { await import("./case10/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_runs_a_commonjs_package_raw_ts_dependency_with_no_module_syntax_as_commonjs");
console.log("BEGIN:test_ttsx_runs_a_published_esm_raw_ts_dependency_with_enums_under_node_modules");
try { await import("./case11/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_runs_a_published_esm_raw_ts_dependency_with_enums_under_node_modules");
console.log("BEGIN:test_ttsx_runs_a_published_mts_dependency_as_a_module");
try { await import("./case12/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_runs_a_published_mts_dependency_as_a_module");
console.log("BEGIN:test_ttsx_resolves_directory_index_imports_in_a_node_modules_raw_ts_dependency");
try { await import("./case13/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_resolves_directory_index_imports_in_a_node_modules_raw_ts_dependency");
console.log("BEGIN:test_ttsx_runs_an_esm_typescript_entry_through_the_emitted_project_path");
try { await import("./case14/src/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_ttsx_runs_an_esm_typescript_entry_through_the_emitted_project_path");
console.log("BEGIN:test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir");
try { await import("./case15/src/main"); } catch(error) { console.log("FAILED:"+String(error)); process.exitCode=1; }
console.log("END:test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir");
console.log("BEGIN:test_runner_corpus_ttsx_keeps_configured_outdir_untouched");
try { await import("./case16/main"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:test_runner_corpus_ttsx_keeps_configured_outdir_untouched");

console.log("BEGIN:test_ttsx_runs_allow_importing_ts_extensions_project");
try { await import("./extension-import/main"); } catch(error) { console.log("FAILED:"+String(error)); process.exitCode=1; }
console.log("END:test_ttsx_runs_allow_importing_ts_extensions_project");

console.log("BEGIN:test_ttsx_runs_a_published_cts_dependency_as_commonjs");
try { await import("./published-cts"); } catch(error) { console.log("FAILED:"+String(error)); process.exitCode=1; }
console.log("END:test_ttsx_runs_a_published_cts_dependency_as_commonjs");

console.log("BEGIN:test_ttsx_runs_an_mts_entry_and_resolves_emitted_mjs_imports");
try { const { message } = await import("./mts-helper.mjs"); console.log(message); } catch(error) { console.log("FAILED:"+String(error)); process.exitCode=1; }
console.log("END:test_ttsx_runs_an_mts_entry_and_resolves_emitted_mjs_imports");

console.log("BEGIN:test_ttsx_runs_the_entry_when_emit_suppressing_flags_are_forwarded");
try { await import("./emit-suppressed"); } catch(error) { console.log("FAILED:"+String(error)); process.exitCode=1; }
console.log("END:test_ttsx_runs_the_entry_when_emit_suppressing_flags_are_forwarded");
