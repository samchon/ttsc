module.exports = {
  extends: "./tools/resident-config/real.config.ts",
  plugins: { topology: { source: process.env.TTSC_RESIDENT_CONTRIBUTOR } },
};
