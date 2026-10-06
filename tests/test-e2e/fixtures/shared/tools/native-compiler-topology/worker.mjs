const [routineUrl, root] = process.argv.slice(2);
let result;
try {
  const { nativeCompilerTopologyCorpus } = await import(routineUrl);
  await nativeCompilerTopologyCorpus(root);
  result = { ok: true };
} catch (error) {
  result = { ok: false, error: String(error?.stack ?? error), causes: error instanceof AggregateError ? error.errors.map((cause) => String(cause?.stack ?? cause)) : [] };
}
// Close this actual observer owner only after the complete body settles. The
// parent joins the exit/PID receipt rather than certifying backend close calls.
process.stdout.write(JSON.stringify(result) + "\n", () => process.exit(result.ok ? 0 : 1));
