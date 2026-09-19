/**
 * Public entry of `ttsc/binary`.
 *
 * The rules that find ttsc's platform binary (an absolute `TTSC_BINARY`, the
 * per-platform package, then the repository's own dev layout) are ttsc's alone.
 * A tool host that runs one of that binary's helper commands, as
 * `@ttsc/unplugin` runs its Linux watch helper (samchon/ttsc#1426), imports
 * them from here, so the helper always comes from the binary ttsc itself uses
 * and no consumer carries a copy of the rules.
 */
export { resolveBinary } from "../compiler/internal/resolveBinary";
