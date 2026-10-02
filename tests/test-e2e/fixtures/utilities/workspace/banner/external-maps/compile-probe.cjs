module.exports = (context) => ({
  name: context.plugin.name ?? "real-envelope-compile-probe",
  source: context.plugin.fixtureSource,
});
