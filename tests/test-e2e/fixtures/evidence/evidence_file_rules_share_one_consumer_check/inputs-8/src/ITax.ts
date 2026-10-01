/**
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not this type.
 * @evidenceExcludeReview docs/spec.md#tax Read the section: every rule in it names a tax authority.
 * @evidenceExclude docs/spec.md#audit The audit log owns this.
 * @evidenceReview docs/spec.md#audit Filed under the wrong question.
 */
export interface ITax {
  rate: number;
}
