import { assertAPersistentHostIgnoresEmittedOutput } from "../../internal/transform-program-membership";

/**
 * See {@link assertAPersistentHostIgnoresEmittedOutput} for what this proves and
 * why the previous behaviour was wrong (samchon/ttsc#1307).
 */
export const test_transformttsc_a_persistent_host_ignores_emitted_output =
  async () => {
    await assertAPersistentHostIgnoresEmittedOutput();
  };
