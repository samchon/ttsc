/**
 * Native argument base paired with TTSC_TSGO_ARGS. It anchors upstream option
 * and response parsing while the Program and plugin root remain independent.
 * Absence retains the ordinary Program cwd; hosts declare compilerArgsCwd
 * support before the launcher publishes a distinct base.
 */
export const TSGO_ARGS_CWD_ENV = "TTSC_TSGO_ARGS_CWD";
