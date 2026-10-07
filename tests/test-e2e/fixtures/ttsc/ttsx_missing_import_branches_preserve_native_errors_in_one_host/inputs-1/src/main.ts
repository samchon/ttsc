export {};
let lastError: unknown;
const results: { name: string; code: unknown }[] = [];
try { await import("./case0/main"); results.push({ name: "test_ttsx_preserves_module_not_found_for_a_missing_package_import", code: null }); } catch (error) { lastError = error; results.push({ name: "test_ttsx_preserves_module_not_found_for_a_missing_package_import", code: (error as { code?: unknown }).code }); console.error(String(error)); }
try { await import("./case1/main"); results.push({ name: "test_ttsx_preserves_module_not_found_for_a_missing_extensionless_relative_import", code: null }); } catch (error) { lastError = error; results.push({ name: "test_ttsx_preserves_module_not_found_for_a_missing_extensionless_relative_import", code: (error as { code?: unknown }).code }); console.error(String(error)); }
try { await import("./case2/main"); results.push({ name: "test_ttsx_preserves_module_not_found_for_a_missing_relative_import_with_extension", code: null }); } catch (error) { lastError = error; results.push({ name: "test_ttsx_preserves_module_not_found_for_a_missing_relative_import_with_extension", code: (error as { code?: unknown }).code }); console.error(String(error)); }
console.log(JSON.stringify(results));
if (lastError !== undefined) throw lastError;
