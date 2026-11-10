package driver

// ContentMapperDependencies returns the current upstream-declared mapper inputs,
// including manifests and dynamic configuration. They are dependency names,
// not proof that the compiler observed particular bytes. A resident consumer
// calls again after edits; a failed declaration must not authorize reuse.
//
// @evidence contracts/common.md#principled-implementation The live project-host dependency API supplies the mapper's own declarations without reconstructing them from suffixes or package names.
// @evidence contracts/common.md#clear-and-simple-design One accessor exposes the existing host dependency boundary to resident consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Reported failures propagate rather than turning an incomplete dependency set into a successful empty set.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes dependency names from observed bytes and explains refresh timing and errors.
// @evidence contracts/portability.md#os-neutral-implementation Upstream supplies native dependency paths and owns any lazy mapper-project opening and protocol IO; this accessor performs no path rewriting.
// @evidence contracts/performance.md#efficient-algorithms Upstream copies and sorts declared names and can perform protocol IO to open dynamic mapper projects; no source or resolution graph is rebuilt.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The upstream project owns its dependency state; each call observes its current declaration after possible edits.
// @evidence contracts/performance.md#bound-retention-and-release-resources Returned paths transfer to the caller; mapper processes opened by the upstream project remain owned by ProjectHosts until Program.Close, without a separate accessor cache.
func (p *Program) ContentMapperDependencies() ([]string, error) {
  if p == nil || p.hosts == nil {
    return nil, nil
  }
  return p.hosts.Dependencies()
}
