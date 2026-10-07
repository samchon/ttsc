const [routineUrl, root] = process.argv.slice(2);
function describe(error, depth = 0) {
  if (depth > 8) return { error: String(error) };
  return {
    error: String(error?.stack ?? error),
    ...(error?.actual !== undefined ? { actual: error.actual } : {}),
    ...(error?.expected !== undefined ? { expected: error.expected } : {}),
    ...(error?.cause !== undefined ? { cause: describe(error.cause, depth + 1) } : {}),
    ...(error instanceof AggregateError ? { causes: error.errors.map((cause) => describe(cause, depth + 1)) } : {}),
  };
}
let result;
try {
  const { nativeCompilerTopologyCorpus } = await import(routineUrl);
  await nativeCompilerTopologyCorpus(root);
  result = { ok: true };
} catch (error) {
  result = { ok: false, ...describe(error) };
}
// Close this actual observer owner only after the complete body settles. The
// parent joins the exit/PID receipt rather than certifying backend close calls.
process.stdout.write(JSON.stringify(result) + "\n", () => process.exit(result.ok ? 0 : 1));
