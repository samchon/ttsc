import { assertNextAdapterWiresBothBundlers } from "../../internal/adapter-next";

/**
 * Verifies `withTtsc` wires Turbopack as well as webpack, with one options set.
 *
 * See {@link assertNextAdapterWiresBothBundlers}: covering webpack alone meant a
 * project on Turbopack, the default bundler in the Next majors this repository
 * pins, silently got no transform at all (samchon/ttsc#1310).
 */
export const test_next_adapter_wires_both_bundlers = async () => {
  await assertNextAdapterWiresBothBundlers();
};
