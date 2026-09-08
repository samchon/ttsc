package evidence

import (
  "strings"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// ProjectInputs declares the files this rule reads from outside the Program.
//
// Markdown, Prisma, and Swagger evidence never enters the TypeScript Program,
// so until `@ttsc/lint@0.22.0` shipped this contract the host had no way to
// learn that the graph depended on them. The resulting asymmetry was invisible
// rather than merely inconvenient: a developer editing code saw fresh
// diagnostics, because the TypeScript event drove a cycle that reloaded the
// documents along with it, while a developer editing only a spec section or a
// schema saw the citation that had just gone stale keep reporting green.
//
// The host calls this after resolving options and project identity but before
// loading a Program, so nothing here may read `ctx.Sources`, and nothing here
// may touch the filesystem — this declares configured topology rather than the
// files a successful load happened to reach.
func (graphRule) ProjectInputs(ctx *rule.ProjectInputContext) []rule.ProjectInput {
  if ctx == nil {
    return nil
  }
  // Configuration problems belong to Check, which has a reporter and a source
  // position to name. Declaring the inputs of whichever claims did decode is
  // strictly better than declaring none: a graph the author is midway through
  // repairing is exactly when the editor must keep watching the sources.
  config, _ := decodeGraphConfig(ctx.Options)
  return graphProjectInputs(config)
}

// graphProjectInputs collects the external dependency of every configured
// obligation.
//
// Program sources are already watched. Rooted TypeScript references additionally
// declare the directory containing their disk-loaded export closure.
func graphProjectInputs(config graphConfig) []rule.ProjectInput {
  config = enabledGraphConfig(config)
  inputs := []rule.ProjectInput{}
  for _, claim := range config.Claims {
    switch claim.Type {
    case artifactMarkdown, artifactPrisma:
      inputs = append(inputs, globInputs(claim.Root, claim.Files)...)
    }
    for _, reference := range claim.References {
      switch reference.Type {
      case artifactTypeScript:
        if reference.Rooted {
          // Export traversal can reach a module outside the entry globs, and
          // this pre-Program protocol cannot discover that closure. The root
          // is its explicit boundary, including future files and repairs.
          pattern := "**"
          if reference.Root != "" {
            pattern = strings.TrimSuffix(reference.Root, "/") + "/**"
          }
          inputs = append(inputs, rule.ProjectInput{Kind: rule.ProjectInputGlob, Pattern: pattern})
        }
      case artifactMarkdown, artifactPrisma:
        inputs = append(inputs, globInputs(reference.Root, reference.Files)...)
      case artifactSwagger:
        inputs = append(inputs, localSwaggerInputs(reference.Source)...)
      }
    }
  }
  return inputs
}

// globInputs publishes the positive half of one glob set, anchored on the root
// its population resolves against.
//
// Exclusions are dropped rather than translated, because the host's dependency
// model has no negation — declaring `!docs/private/**` as a glob would watch
// precisely the documents this graph refuses to read. What is left over-selects
// slightly, and that is the safe direction: a spurious rebuild costs one cycle,
// while a missing one leaves a stale citation reporting green, which is the
// whole failure this contract exists to remove.
//
// The declared pattern is the compiled segment form rather than `Raw`, so the
// host receives a pattern with the exclusion marker already stripped, `\`
// already normalized to `/`, and a leading `./` already gone.
//
// The root is prefixed as the author wrote it rather than resolved here. The
// host anchors a relative pattern against the same physical project root this
// rule uses (`linthost/project_inputs.go:151-171`), and it accepts one that
// ascends or is absolute — so `../../docs/**/*.md` and `C:/shared/docs/**/*.md`
// both arrive at the directory `Check` will read. Resolving it here would
// duplicate that arithmetic and make this contract depend on a project identity
// it is supposed to be able to answer without.
func globInputs(root string, globs globSet) []rule.ProjectInput {
  inputs := make([]rule.ProjectInput, 0, len(globs.Patterns))
  for _, pattern := range globs.Patterns {
    if pattern.Exclude {
      continue
    }
    joined := strings.Join(pattern.Segments, "/")
    if root != "" {
      joined = strings.TrimSuffix(root, "/") + "/" + joined
    }
    inputs = append(inputs, rule.ProjectInput{
      Kind:    rule.ProjectInputGlob,
      Pattern: joined,
    })
  }
  return inputs
}

// localSwaggerInputs publishes a Swagger reference only when it names a file.
//
// Withholding the URL form is not a shortcut. The host rejects a remote pattern
// outright (`linthost/project_inputs.go:159-161`), and one rejected input
// discards the whole snapshot for every project rule in the run
// (`linthost/project_inputs.go:113-135`) — so declaring a URL here would take
// this graph's Markdown globs down with it and restore the exact blindness the
// contract removes.
//
// The boundary is also real rather than imposed: a URL has no filesystem event
// to observe, so its freshness is per-evaluation and belongs to the loader.
//
// A local path is published exactly as it normalized, including one that
// ascends out of the project or names an absolute location. The host resolves
// both against the same root this rule reads them from, so a generated document
// in a sibling package is watched on the same terms as one inside the project.
func localSwaggerInputs(source string) []rule.ProjectInput {
  if source == "" || isRemoteSwaggerSource(source) {
    return nil
  }
  return []rule.ProjectInput{{
    Kind:    rule.ProjectInputFile,
    Pattern: source,
  }}
}
