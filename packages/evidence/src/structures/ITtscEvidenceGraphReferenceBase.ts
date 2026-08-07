/**
 * What every evidence population declares: which artifact kind it materializes,
 * and how strictly the owning claim must acknowledge it.
 *
 * Ordinary coverage is deliberately permissive. Either tag can acknowledge a
 * unit, one host may cite any number of units, and one acknowledgement per unit
 * is enough. That is right for a documentary obligation and too weak for a
 * proof obligation, where a single exclusion or a single host citing the whole
 * population discharges it without proving anything.
 *
 * These properties tighten the acknowledgement relation of one reference, never
 * of the graph. A strict operation obligation and an ordinary requirement
 * obligation therefore sit in the same claim without either inheriting the
 * other's intent, and two references over the same files stay independent.
 *
 * Every constraint is opt-in and its zero value is the historical behavior, so
 * a reference that declares none of them is the reference that existed before
 * they did.
 */
export interface ITtscEvidenceGraphReferenceBase<Type extends string> {
  /** Identifies the artifact kind this population materializes. */
  type: Type;

  /**
   * Whether this reference refuses `@evidenceExclude` as an acknowledgement.
   *
   * A refused exclusion is reported where it is written and contributes no
   * coverage here, so its target still owes positive `@evidence`. The same
   * declaration may still acknowledge another reference that allows exclusions,
   * because an exclusion decides one obligation rather than the target itself.
   *
   * Set it where non-applicability is not an answer the population accepts: a
   * published API operation is exercised by its test suite or the suite is
   * incomplete, and "not applicable" is the sentence that hides the second
   * case.
   *
   * @default false
   */
  noEvidenceExclude?: boolean;

  /**
   * Whether at most one claim host may cite each unit of this population.
   *
   * Ordinary coverage lets any number of hosts cite one unit. That is correct
   * for a requirement several modules honor, and wrong for evidence meant to
   * have an owner: without this constraint one thorough host can cite a unit
   * that every other host also names, and nothing records which of them is
   * answerable for it.
   *
   * Distinct semantic hosts are counted, never declarations or tags. Merged
   * declarations and overload sets remain one host, repeated tags on one host
   * count once, and `@evidenceExclude` never contributes a host. A unit no host
   * cites is reported as missing coverage instead.
   *
   * @default false
   */
  uniqueEvidence?: boolean;

  /**
   * Whether each selected claim host must cite exactly one unit of this
   * population.
   *
   * The denominator is the claim's complete selected host population, so a host
   * carrying no `@evidence` tag counts as zero and fails exactly as a host
   * citing two units does. Repeated tags for one unit count once, while an
   * aggregate target contributes every selected descendant in its scope: citing
   * a parent of two selected units counts as two.
   *
   * Set it where one host answers for one thing. A test function that proves
   * one operation stays reviewable; the same function citing eight operations
   * proves only that eight names appear in its JSDoc.
   *
   * @default false
   */
  singleEvidencePerSymbol?: boolean;
}
