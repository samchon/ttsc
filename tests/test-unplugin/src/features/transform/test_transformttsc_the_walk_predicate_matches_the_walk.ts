import { assertTheWalkPredicateMatchesTheWalk } from "../../internal/transform-program-membership";

/**
 * See {@link assertTheWalkPredicateMatchesTheWalk}: the walk and the predicate
 * that decides what the walk covers must agree, or an input the compiler read
 * lands in neither snapshot (samchon/ttsc#1307).
 */
export const test_transformttsc_the_walk_predicate_matches_the_walk =
  async () => {
    await assertTheWalkPredicateMatchesTheWalk();
  };
