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
 *
 * A Markdown reference declares one more, `checklist`, which is not a peer of
 * these. They tighten a count inside the per-reference obligation; that one
 * gives the obligation a host dimension, and it is documented on the Markdown
 * reference because no other artifact kind is read item by item.
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
   * A reference whose population came back empty is reported as empty and
   * judges no host, because there is no unit any host could have cited.
   *
   * Set it where one host answers for one thing. A test function that proves
   * one operation stays reviewable; the same function citing eight operations
   * proves only that eight names appear in its JSDoc.
   *
   * @default false
   */
  singleEvidencePerSymbol?: boolean;

  /**
   * Whether every acknowledgement of this population must carry a reviewed,
   * unexpired review of its own kind.
   *
   * The reason on a citation says why this declaration answers for a target.
   * Nothing asks what was actually checked, so an unverified citation and a
   * verified one are byte-identical in the source. This asks, and it makes the
   * answer expire: the review carries a `#`-prefixed fingerprint of the cited
   * scope's content, and when that content changes the fingerprint stops
   * matching and the build fails again with the new value in the diagnostic.
   *
   * Expiry is the point. Without it a review is written once and stays green
   * forever, and on a second pass over a large citation set there is no way to
   * tell which reviews were written against content that has since moved.
   *
   * What this proves is narrow and worth stating plainly. It proves a
   * separately addressed statement exists and was written against the cited
   * content as it now stands. It does not prove anyone read that content,
   * because the diagnostic states the expected fingerprint, and it does not
   * judge whether the prose is sincere.
   *
   * The fingerprint covers the cited unit and its structural subtree, so it is
   * a property of the address a citation names rather than of the reference
   * that demanded it. One tag therefore carries one fingerprint no matter how
   * many references it acknowledges.
   *
   * Expect a citation of a TypeScript symbol to expire on any change inside
   * that declaration, including one behind a withdrawal tag. A declaration's
   * digest is its own text and a nested member sits inside it, so the subtree
   * cannot be carved out the way a Markdown section's subsections can. Cite the
   * narrowest symbol that actually answers for the requirement if that breadth
   * is unwelcome.
   *
   * The withdrawal tags are named in the tag guide rather than here, on
   * purpose: `stripInternal` is on for this package, so writing one of them
   * inside a published doc comment deletes the property it documents from the
   * emitted declarations. That is how this very property went missing once.
   *
   * Every reference kind accepts this. A Swagger or Prisma reference used to be
   * refused at decode, because those loaders reported unit identities and
   * nothing else; each bridge now digests a unit's content on the side that
   * understands it, which for an operation is its normalized definition and for
   * a Prisma model or member is its parsed declaration without the
   * documentation comment a review of it is written in.
   *
   * @default false
   */
  requireReview?: boolean;
}
