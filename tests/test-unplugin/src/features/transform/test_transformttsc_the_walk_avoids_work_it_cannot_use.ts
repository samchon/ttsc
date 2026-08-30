import { assertTheWalkAvoidsWorkItCannotUse } from "../../internal/transform-program-membership";

/**
 * See {@link assertTheWalkAvoidsWorkItCannotUse} for what this proves and why
 * the previous behaviour was wrong (samchon/ttsc#1307).
 */
export const test_transformttsc_the_walk_avoids_work_it_cannot_use =
  async () => {
    await assertTheWalkAvoidsWorkItCannotUse();
  };
