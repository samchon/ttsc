package projectinput

import (
 "path/filepath"
 "github.com/samchon/ttsc/packages/lint/rule"
)

// topologyRule contributes real file/glob inputs to the native watch protocol.
type topologyRule struct{}
func (topologyRule) Name() string { return "topology/project-input" }
func (topologyRule) Check(*rule.ProjectContext) {}
func (topologyRule) ProjectInputs(ctx *rule.ProjectInputContext) []rule.ProjectInput {
 root := ctx.Identity.PhysicalProjectRoot
 return []rule.ProjectInput{
  {Kind: rule.ProjectInputFile, Pattern: filepath.Join(root, "docs", "spec.md")},
  {Kind: rule.ProjectInputGlob, Pattern: filepath.ToSlash(filepath.Join(root, "api", "**", "*.json"))},
 }
}
func init() { rule.RegisterProject(topologyRule{}) }
