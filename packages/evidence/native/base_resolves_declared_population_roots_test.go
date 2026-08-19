package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// runRootedGraph drives the graph rule inside a workspace whose project sits one
// directory down, so a population can declare a root that ascends out of it.
//
// The layout is the whole point. `runIndexRule` makes the temp directory the
// project root, which leaves nowhere above it a case may write to without
// littering a directory other tests share — and "above the project" is exactly
// the location this property exists to reach.
//
// Keys are workspace-relative. Files under `project/` become the ttsc program;
// everything else is a sibling of it.
func runRootedGraph(
  t *testing.T,
  files map[string]string,
  config string,
) []string {
  t.Helper()
  return runRootedGraphIn(t, t.TempDir(), files, config)
}

// runRootedGraphIn drives the same workspace from a caller-owned directory, for
// the cases whose configuration has to name that directory.
//
// An absolute declared root cannot be written into a literal config string
// against a workspace the helper allocates for itself, and it is the one form
// where the declared spelling and the derived one differ — so the property those
// cases exist to prove is unreachable without the caller owning the workspace.
func runRootedGraphIn(
  t *testing.T,
  workspace string,
  files map[string]string,
  config string,
) []string {
  t.Helper()
  root := filepath.Join(workspace, "project")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  paths := make([]string, 0, len(files))
  for path := range files {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  sources := []*shimast.SourceFile{}
  for _, relative := range paths {
    content := files[relative]
    absolute := filepath.Join(workspace, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
    if !strings.HasPrefix(relative, "project/") ||
      !isTypeScriptTestPath(relative) {
      continue
    }
    kind := shimcore.ScriptKindTS
    if strings.HasSuffix(strings.ToLower(relative), ".tsx") {
      kind = shimcore.ScriptKindTSX
    }
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: filepath.ToSlash(absolute)},
      content,
      kind,
    ))
  }
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(
    rule.ProjectIdentity{PhysicalProjectRoot: root},
    sources,
    nil,
    rule.SeverityError,
    json.RawMessage(config),
    reporter,
  ))
  sort.Strings(reporter.messages)
  return reporter.messages
}

/**
 * Verifies a Markdown population above the project resolves, and that its
 * targets are spelled relative to the declared root.
 *
 * This is the whole feature in one case. A monorepo keeps one requirements set
 * that several packages implement, and before `root` the ceiling was the ttsc
 * project root — so the only ways to compile were duplicating the documents per
 * package or gating one package and leaving the rest open. Root-relative
 * addressing is what makes the escape worth having: the same citation text
 * works in every package that declares the same base, so adopting a shared
 * document set costs nothing but the `root` line.
 *
 *  1. Place a requirements document beside the project rather than inside it.
 *  2. Cite it by its path inside the declared root, with no `..` in the target.
 *  3. Assert the graph closes.
 */
func TestAncestorRootedMarkdownPopulationResolves(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount rules follow this section. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../docs",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies a rooted population is still addressed from its own base when the
 * project-relative spelling would also be legal.
 *
 * The negative twin of the case above. A resolver that quietly kept
 * project-relative targets would pass that case only if the author happened to
 * write `../docs/...`, and would then bind every citation to the citing
 * package's distance from the documents — which is the coupling this design
 * exists to remove. Naming the document the other way must fail.
 *
 *  1. Keep the same rooted population.
 *  2. Cite the document through the project-relative path instead.
 *  3. Assert the target does not resolve.
 */
func TestRootedTargetsRefuseTheProjectRelativeSpelling(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence ../docs/requirements/pricing.md#discounts Discount rules follow this section. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../docs",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Unresolved evidence target '../docs/requirements/pricing.md#discounts'",
  )
}

/**
 * Verifies a diagnostic about a rooted population names the file through the
 * project rather than through the root alone.
 *
 * A missing acknowledgement has to be repairable from the message, and the
 * target alone cannot do that here: `requirements/pricing.md` names no path a
 * reader can open from the project directory. The location therefore ascends,
 * while the target stays root-relative — the two answer different questions and
 * collapsing them would break one of them.
 *
 *  1. Leave a selected section uncited.
 *  2. Read the missing-acknowledgement diagnostic.
 *  3. Assert it carries the root-relative target and the ascending location.
 */
func TestRootedDiagnosticsNameBothTheTargetAndTheLocation(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":          "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../docs",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'requirements/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at ../docs/requirements/pricing.md:1")
}

/**
 * Verifies a root that names no directory is reported as a root rather than as
 * an empty glob match.
 *
 * The likeliest mistake this property introduces is a root off by one segment,
 * and the population it selects is then empty for a reason no pattern explains.
 * The diagnostic therefore names both spellings: the property the author edits
 * and the location it actually landed on.
 *
 *  1. Declare a root one segment away from the documents.
 *  2. Read the diagnostics.
 *  3. Assert the root is named as written and as resolved.
 */
func TestAnUnreadableRootIsReportedAsARoot(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":          "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not read the markdown root '../documents', which resolves to '",
  )
  if countProblemsContaining(messages, "matched no markdown files") != 0 {
    t.Fatalf(
      "an unreadable root must not cascade into a healthy empty-match diagnostic:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies one document reached through two roots owns one target per root.
 *
 * Inventories are keyed by file and by base together, and this is the case that
 * proves why. Two populations that reach the same document through different
 * roots address it differently, so a key that named only the file would let the
 * second population overwrite the first — and the citations of whichever lost
 * would stop resolving with nothing in the configuration to explain it.
 *
 *  1. Reference one document twice, once through the project and once rooted.
 *  2. Cite it under both addresses from the same claim.
 *  3. Assert both obligations close.
 */
func TestOneDocumentReachedThroughTwoRootsKeepsBothAddresses(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts": "/** @evidence docs/pricing.md#discounts The project population is cited here. */\n" +
      "/** @evidence pricing.md#discounts The rooted population is cited here too. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":[
      {"type":"markdown","files":["docs/**"],"symbol":"h2"},
      {"type":"markdown","root":"docs","files":["**"],"symbol":"h2"}
    ]
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies a Prisma population collects schema files above the project, and
 * that one file reached through two roots joins the parser's set once.
 *
 * The set is what makes Prisma different from Markdown here. Every configured
 * file is parsed together as one schema, so a file listed twice is a duplicate
 * declaration to Prisma's own parser — a file reachable through two roots must
 * therefore own two inventories and still contribute one source. The walk is
 * exercised rather than the whole loader because the parse crosses a process
 * boundary the e2e suite owns.
 *
 *  1. Place one schema beside the project and one inside it.
 *  2. Collect the addresses of a rooted population and a project-rooted one
 *     that overlap on the inner schema.
 *  3. Assert both files are addressed and the shared one is sent once.
 */
func TestRootedPrismaPopulationsCollectAcrossBasesWithoutDuplicating(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  for _, relative := range []string{
    "schema/main.prisma",
    "project/prisma/local.prisma",
  } {
    absolute := filepath.Join(workspace, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte("model Sale {\n  id String @id\n}\n"), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"prisma","root":"../schema","files":["**/*.prisma"]},
      {"type":"prisma","files":["prisma/**/*.prisma"]},
      {"type":"prisma","root":"prisma","files":["**/*.prisma"]}
    ]
  }]}`)
  addresses, problems := configuredPrismaAddresses(config)
  if len(problems) != 0 {
    t.Fatalf("configured roots must be readable, got %v", problems)
  }
  displays := []string{}
  for _, address := range addresses {
    displays = append(displays, address.Display)
  }
  sort.Strings(displays)
  // Three populations, three addresses: the inner schema is reached through
  // the project base and through its own root, and each owns its own globs.
  want := "../schema/main.prisma\nprisma/local.prisma\nprisma/local.prisma"
  if strings.Join(displays, "\n") != want {
    t.Fatalf("addressed schemas:\n%s\nwant:\n%s", strings.Join(displays, "\n"), want)
  }
  sources := distinctPrismaSources(addresses)
  if strings.Join(sources, "\n") != "../schema/main.prisma\nprisma/local.prisma" {
    t.Fatalf("parser set = %v; a file reached twice must be parsed once", sources)
  }
}

/**
 * Verifies `root` is refused on references whose existing selectors already
 * own their location.
 *
 * A TypeScript claim may change the base of source files already supplied by
 * ttsc, but a TypeScript reference selects a Program entry, Program globs, or
 * an installed package. A Swagger reference already carries its location in
 * `file`, where the escape is visible without a second property.
 *
 *  1. Declare `root` on TypeScript and Swagger references.
 *  2. Decode each configuration.
 *  3. Assert each diagnostic points at the channel that works instead.
 */
func TestRootIsRefusedOnTypeScriptAndSwaggerReferences(t *testing.T) {
  _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"typescript",
      "root":"../shared",
      "files":["src/**"]
    }
  }]}`))
  if !strings.Contains(strings.Join(problems, "\n"), "only a TypeScript claim accepts 'root'") {
    t.Fatalf("a TypeScript reference root must name the supported claim boundary, got %v", problems)
  }

  _, problems = decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"swagger","root":"../contracts","file":"swagger.json"}
  }]}`))
  if !strings.Contains(strings.Join(problems, "\n"), "write the ancestor-relative or absolute location in 'file'") {
    t.Fatalf("a Swagger root must name the file channel, got %v", problems)
  }
}

/**
 * Verifies the root grammar: one directory, ascending or absolute, never a glob
 * and never drive-relative.
 *
 * `..` is admitted here precisely because it is refused inside `files`. The
 * escape belongs in one declared place rather than inside every pattern, which
 * is what keeps it auditable — and it is unambiguous once resolved against a
 * known base. A drive-relative path is not: `C:docs` resolves against whatever
 * directory that drive currently sits on, which is the same rejection
 * `TestGlobRejectsWindowsDrivePaths` records for `files`.
 *
 *  1. Normalize the accepted spellings.
 *  2. Normalize each refused spelling.
 *  3. Assert acceptance, canonical form, and refusal.
 */
func TestRootGrammarAcceptsAscentAndRefusesAmbiguity(t *testing.T) {
  accepted := map[string]string{
    "docs":              "docs",
    "./docs":            "docs",
    `..\..\docs`:        "../../docs",
    "../docs/":          "../docs",
    "/srv/contracts":    "/srv/contracts",
    "C:/shared/schema":  "C:/shared/schema",
    "docs/../packaging": "packaging",
    // A drive root keeps its separator. `path.Clean` reads `C:` as an
    // ordinary segment and strips the slash behind it, after which the
    // Windows path API calls the result relative and resolves it against the
    // project — a silently different directory.
    "C:/": "C:/",
  }
  for value, want := range accepted {
    got, problem := normalizeRootPath(value)
    if problem != "" {
      t.Fatalf("root %q was refused: %s", value, problem)
    }
    if got != want {
      t.Fatalf("root %q normalized to %q, want %q", value, got, want)
    }
  }
  // `.` is the project root spelled out, so it is the default base rather than
  // a second base that addresses the same files identically.
  if got, problem := normalizeRootPath("."); got != "" || problem != "" {
    t.Fatalf("root '.' normalized to %q with %q, want the default base", got, problem)
  }
  for _, value := range []string{"", " docs", "docs ", "docs/**", "spec?", "C:docs", "C:"} {
    if _, problem := normalizeRootPath(value); problem == "" {
      t.Fatalf("root %q was accepted", value)
    }
  }
}

/**
 * Verifies a resolved base carries the two spellings a diagnostic needs, and
 * that a root naming the project is the default base.
 *
 * The relative display is what a reader compares against every other path this
 * rule prints, and it must survive ascending. The default collapse matters
 * because `root: "."` and an omitted root would otherwise become two bases that
 * address the same files identically — two inventories, two obligations, one
 * document.
 *
 *  1. Resolve an ascending root, an absolute one, and one naming the project.
 *  2. Read the resolved absolute and display spellings.
 *  3. Assert the ascent survives and the project root collapses to the default.
 */
func TestPopulationBaseResolutionKeepsBothSpellings(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "packages", "backend")
  ascending := resolvePopulationBase(root, "../../docs")
  if ascending.Default {
    t.Fatal("an ascending root is not the default base")
  }
  if ascending.Display != "../../docs" {
    t.Fatalf("ascending display = %q", ascending.Display)
  }
  if want := filepath.Join(workspace, "docs"); ascending.Absolute != want {
    t.Fatalf("ascending absolute = %q, want %q", ascending.Absolute, want)
  }
  for _, declared := range []string{"", ".", root, "../backend"} {
    if base := resolvePopulationBase(root, declared); !base.Default {
      t.Fatalf("root %q must resolve to the default base, got %+v", declared, base)
    }
  }
}

/**
 * Verifies an inventory address round-trips inside its own base and is refused
 * by every other one.
 *
 * Composition and inversion are one contract, and both halves fail silently
 * when they disagree: an address the matcher cannot invert simply matches
 * nothing, which reads exactly like a glob that selects nothing. The default
 * base's address must also stay the bare project-relative path, because that is
 * the whole TypeScript path space as well as every unit identity written before
 * this property existed.
 *
 *  1. Compose one address under the default base and one under a declared root.
 *  2. Invert each under its own base and under the other.
 *  3. Assert each round-trips only under the base that composed it.
 */
func TestInventoryAddressesRoundTripWithinTheirOwnBase(t *testing.T) {
  root := filepath.Join(t.TempDir(), "packages", "backend")
  project := resolvePopulationBase(root, "")
  shared := resolvePopulationBase(root, "../../docs")

  if got := project.address("docs/spec.md"); got != "docs/spec.md" {
    t.Fatalf("default address = %q, want the bare project-relative path", got)
  }
  for _, entry := range []struct {
    base     populationBase
    relative string
  }{{project, "docs/spec.md"}, {shared, "requirements/pricing.md"}} {
    address := entry.base.address(entry.relative)
    got, owned := entry.base.relativeOf(address)
    if !owned || got != entry.relative {
      t.Fatalf("address %q did not round-trip: %q, %v", address, got, owned)
    }
  }
  if _, owned := project.relativeOf(shared.address("requirements/pricing.md")); owned {
    t.Fatal("the default base claimed an address composed for a declared root")
  }
  if _, owned := shared.relativeOf(project.address("docs/spec.md")); owned {
    t.Fatal("a declared root claimed an address composed for the default base")
  }
}

/**
 * Verifies a rooted population publishes the root along with its patterns.
 *
 * The escape must not widen what the graph watches beyond what the author
 * declared, and it equally must not narrow it: a document above the project
 * that no host watches leaves a stale citation reporting green, which is the
 * one failure the input contract exists to remove. The host anchors a relative
 * pattern against the same project root this rule reads from and accepts one
 * that ascends, so the joined spelling is what reaches the right directory.
 *
 *  1. Configure Markdown and Prisma populations with declared roots.
 *  2. Publish the rule's project inputs.
 *  3. Assert each pattern arrives joined to the root it resolves against.
 */
func TestRootedPopulationsPublishTheirResolvedGlobs(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"markdown",
    "root":"../../docs",
    "files":["ledger/**"],
    "symbol":"file",
    "reference":[
      {"type":"markdown","root":"../../docs","files":["requirements/**"],"symbol":"h2"},
      {"type":"prisma","root":"C:/shared/schema","files":["**/*.prisma"]},
      {"type":"markdown","files":["docs/**"],"symbol":"h2"}
    ]
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputGlob, []string{
    "../../docs/ledger/**",
    "../../docs/requirements/**",
    "C:/shared/schema/**/*.prisma",
    "docs/**",
  })
}

/**
 * Verifies a local Swagger document outside the project is accepted and still
 * declared as a watched file.
 *
 * The rule already accepts an arbitrary http(s) URL on any host, so refusing
 * `../contracts/swagger.json` refused the one form an author can pin, version,
 * and diff. Publishing it is what keeps the escape honest: an OpenAPI document
 * regenerated in a sibling package has a filesystem event, and withholding it
 * would trade a compile error for a silently stale one.
 *
 *  1. Configure ancestor-relative and absolute Swagger references.
 *  2. Decode them and publish the rule's project inputs.
 *  3. Assert both normalize as written and arrive as exact file dependencies.
 */
func TestOutOfProjectSwaggerDocumentsAreAcceptedAndWatched(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"swagger","file":"../contracts/swagger.json"},
      {"type":"swagger","file":"C:/shared/contracts/openapi.yaml"}
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("an out-of-project Swagger document must decode, got %v", problems)
  }
  sources := []string{
    config.Claims[0].References[0].Source,
    config.Claims[0].References[1].Source,
  }
  if sources[0] != "../contracts/swagger.json" ||
    sources[1] != "C:/shared/contracts/openapi.yaml" {
    t.Fatalf("Swagger sources = %v", sources)
  }
  // A drive root and a bare separator name directories, and both survive
  // `path.Clean` looking like ordinary paths. Reporting them as missing
  // documents would send the author to generate a file at a location that
  // cannot hold one.
  for _, directory := range []string{"C:/", "/", "../contracts/", ".."} {
    if _, problem := normalizeSwaggerSource(directory); problem == "" {
      t.Fatalf("Swagger source %q was accepted as a document", directory)
    }
  }
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"swagger","file":"../contracts/swagger.json"},
      {"type":"swagger","file":"C:/shared/contracts/openapi.yaml"}
    ]
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputFile, sources)
}

/**
 * Verifies an out-of-project Swagger document is located on disk rather than
 * under the project.
 *
 * The path arithmetic is the whole of what a local Swagger reference does with
 * its root, and it fails in the quietest possible way: joining an absolute path
 * onto the project produces a location that does not exist, which arrives as a
 * missing document instead of as the resolution bug it is.
 *
 *  1. Resolve an ancestor-relative source and an absolute one.
 *  2. Compare each against the location its spelling names.
 *  3. Assert the ascent is applied and the absolute path is left alone.
 */
func TestSwaggerSourcePathsResolveOutsideTheProject(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "packages", "backend")
  ascending := swaggerSourcePath(root, "../contracts/swagger.json")
  if want := filepath.Join(workspace, "packages", "contracts", "swagger.json"); ascending != want {
    t.Fatalf("ascending source path = %q, want %q", ascending, want)
  }
  absolute := filepath.Join(workspace, "shared", "contracts", "openapi.yaml")
  if got := swaggerSourcePath(root, filepath.ToSlash(absolute)); got != absolute {
    t.Fatalf("absolute source path = %q, want %q", got, absolute)
  }
}

/**
 * Verifies an unresolvable TypeScript claim root is reported as a root.
 *
 * The Markdown half of this pair has always worked, because its loader meets
 * the root before it lists anything. TypeScript materializes from ctx.Sources
 * and walks nothing, so the population came back healthy and empty and the
 * author was answered with `matched no typescript files` and a lecture on glob
 * syntax — for a mistake that is one directory name, and after the rule had
 * already computed the right sentence and used it as a boolean.
 *
 *  1. Declare a TypeScript claim rooted at a directory that does not exist.
 *  2. Read the diagnostics.
 *  3. Assert the root is named and the glob diagnostic is suppressed.
 */
func TestAnUnresolvableTypeScriptClaimRootIsReportedAsARoot(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../nowhere",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "found no directory at the typescript root '../nowhere', which resolves to '",
  )
  if countProblemsContaining(messages, "matched no typescript files") != 0 {
    t.Fatalf(
      "an unresolvable root must not cascade into a healthy empty-match diagnostic:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies an unreadable Markdown claim root survives the whole rule.
 *
 * The unit test over activation now records the population failure itself,
 * because that is what the loader hands it, and a fixture that builds its own
 * inputs can drift from the pipeline that fills them. This runs the real rule
 * so the claim-side path is proved rather than assumed: the claim must stay
 * active long enough for the root to be named, and the empty-match diagnostic
 * must not arrive beside it.
 *
 *  1. Root a Markdown claim at a directory that does not exist.
 *  2. Run the rule.
 *  3. Assert the root is named and no empty-match diagnostic follows.
 */
func TestAnUnreadableMarkdownClaimRootSurvivesTheWholeRule(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[{
    "type":"markdown",
    "root":"../nowhere",
    "files":["**/*.md"],
    "symbol":"h2",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h3"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not read the markdown root '../nowhere', which resolves to '",
  )
  if countProblemsContaining(messages, "matched no markdown files for") != 0 {
    t.Fatalf(
      "an unreadable claim root must not cascade into an empty-match diagnostic:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a resolvable TypeScript root that selects nothing stays silent.
 *
 * This is the negative twin of the two cases above, and it guards the property
 * the repair could most easily overrun. A root that exists and simply admits no
 * Program source is an empty population, not a broken one: the claim
 * deactivates and owes no message. Reporting here would turn every staged or
 * sibling-package claim into build output.
 *
 *  1. Root a TypeScript claim at a directory that exists and holds no source.
 *  2. Read the diagnostics.
 *  3. Assert neither a root nor an empty-match diagnostic is produced.
 */
func TestAResolvableTypeScriptRootSelectingNothingStaysSilent(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "shared/.keep":            "",
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../shared",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  if len(messages) != 0 {
    t.Fatalf(
      "a resolvable root selecting no host must deactivate in silence:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}

/**
 * Verifies a resolvable declared root stays quiet while its reference speaks.
 *
 * Both halves need a declared root to mean anything. A claim with no `root` has
 * the default base, which `missingBaseDirectoryProblem` returns on before it
 * stats anything and which `Check` has already validated, so an absence
 * assertion there could not fail however the new pass behaved. With a declared
 * root that exists, the pass genuinely evaluates it and produces nothing — while
 * the reference-side empty-match diagnostic, which the claim-side removal must
 * not have widened onto, still fires.
 *
 * The root also has to differ from the project root, which resolves as the
 * default base and short-circuits before the stat for that reason alone.
 *
 *  1. Root a claim above the project, where its own source still matches.
 *  2. Point its reference at a path no document occupies.
 *  3. Assert the reference names its globs and the root names nothing.
 */
func TestAResolvableRootStaysQuietWhileItsReferenceSpeaks(t *testing.T) {
  messages := runRootedGraph(t, map[string]string{
    "project/src/sale.ts": "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"..",
    "files":["project/src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "matched no markdown files for ['docs/**']")
  if countProblemsContaining(messages, "found no directory at") != 0 {
    t.Fatalf(
      "a root that exists must not be reported as missing:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
