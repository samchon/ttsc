/**
 * The descriptor shim's emitted source.
 *
 * Exported so a regression can inspect the same bytes ttsx executes. This
 * template consumes its own escapes, so reading this file's text instead would
 * check characters no consumer ever sees — and a dropped backslash turns an
 * escape into the character it was escaping: a raw line terminator inside a
 * string literal, which stops the shim parsing and takes every descriptor load
 * with it. Its `@ttsc/lint` twin has carried that guard since the same defect
 * shipped there.
 */
export const PLUGIN_DESCRIPTOR_SHIM_SOURCE = [
  `// @ts-nocheck`,
  `import { writeFileSync } from "node:fs";`,
  `import { pathToFileURL } from "node:url";`,
  // The import is inside the try, not above it. A descriptor that cannot be
  // found, or whose module body throws, fails exactly where a descriptor
  // whose factory throws does, and a caller deserves the same reason for
  // both — "Cannot find module ./missing" is as actionable as anything the
  // factory could have said.
  `try {`,
  // Runtime hooks are installed before this shim loads. Arm their internal
  // side channel only for the descriptor import itself, after this shim's own
  // imports have resolved, so ttsc implementation files never become project
  // cache inputs.
  `  process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE = "1";`,
  `  const mod = await import(pathToFileURL(process.env.TTSC_PLUGIN_ENTRY).href);`,
  `  const context = JSON.parse(process.env.TTSC_PLUGIN_CONTEXT);`,
  `  const candidate = mod.createTtscPlugin ?? mod.default ?? mod.plugin ?? mod;`,
  `  const descriptor =`,
  `    typeof candidate === "function" ? candidate(context) : candidate;`,
  `  writeFileSync(process.env.TTSC_PLUGIN_DESCRIPTOR_OUT, JSON.stringify(descriptor));`,
  `} catch (error) {`,
  // The stack streams to the user's stderr on its own. This puts the reason
  // a caller can act on into the channel the parent already reads, so the
  // failure is not reduced to a bare exit status.
  // The escape is doubled on purpose: this template consumes one level, so
  // `\\n` here is what puts the two-character escape into the emitted shim.
  // A single `\n` would put a raw line terminator inside a string literal,
  // and the shim would stop parsing — taking every descriptor load with it.
  `  process.stderr.write((error instanceof Error && error.stack ? error.stack : String(error)) + "\\n");`,
  `  try {`,
  `    writeFileSync(process.env.TTSC_PLUGIN_DESCRIPTOR_OUT, JSON.stringify({ __ttscLoaderError: error instanceof Error ? error.message : String(error) }));`,
  `  } catch {}`,
  `  process.exit(1);`,
  `}`,
  ``,
].join("\n");
