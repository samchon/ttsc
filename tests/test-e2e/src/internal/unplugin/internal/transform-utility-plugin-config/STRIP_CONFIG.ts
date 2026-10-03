/**
 * Custom strip config: strips `logger.trace` (which the built-in defaults do
 * not) and nothing else (the defaults would strip `console.log`). Both
 * directions of the assertion therefore distinguish "project config honored"
 * from "silently fell back to defaults".
 */
export const STRIP_CONFIG = JSON.stringify({
  calls: ["logger.trace"],
  statements: [],
});
