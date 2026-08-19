package evidence

import (
  "bytes"
  "context"
  "encoding/json"
  "errors"
  "io/fs"
  "os"
  "os/exec"
  "path/filepath"
  "sort"
  "strings"
  "time"
)

const prismaBridgeTimeout = 60 * time.Second
const prismaBridgeOutputLimit = 64 * 1024 * 1024
const prismaBridgeErrorLimit = 64 * 1024

// prismaSetID names the one schema set this graph parses.
//
// A project declares one Prisma schema. Prisma itself enforces that — two
// `datasource` blocks in one parse are its own error — so splitting the
// configured files into several independent parses would invent a topology the
// tool being wrapped does not have. Every configured Prisma glob, claim and
// reference alike, therefore contributes to a single ordered set, and the
// identity round-trips through the bridge so a contract drift is caught rather
// than silently reassigned.
const prismaSetID = "schema"

const prismaBridgeScript = `
const path = require("node:path");
const { createRequire } = require("node:module");

const root = process.argv[1];
const projectRequire = createRequire(path.join(root, "package.json"));
const manifest = projectRequire.resolve("@ttsc/evidence/package.json");
const pluginRequire = createRequire(manifest);
const loader = pluginRequire(
  path.join(path.dirname(manifest), "lib", "internal", "loadPrismaModels.js"),
);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const result = await loader.loadPrismaModels(JSON.parse(input));
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
`

type prismaNormalizationRequest struct {
  Root string             `json:"root"`
  Sets []prismaSetRequest `json:"sets"`
}

type prismaSetRequest struct {
  ID    string   `json:"id"`
  Files []string `json:"files"`
}

type prismaNormalizationResult struct {
  Documents []prismaSetInventory `json:"documents"`
  Problems  []prismaSetProblem   `json:"problems"`
}

// prismaSetInventory is one parsed schema set.
//
// Digest is the composition the loader itself computed from the bytes it read,
// and it is what the result is remembered under. Hashing there rather than
// trusting the digest this process took beforehand is what makes the key exact:
// the loader runs in another process and opens the files again, so a write
// landing between the two reads would otherwise bind one schema's models to
// another schema's bytes.
type prismaSetInventory struct {
  ID     string        `json:"id"`
  Models []prismaModel `json:"models"`
  Digest string        `json:"digest"`
}

// prismaSetProblem is a set the parser refused. Digest carries the same meaning
// as on an inventory, so a schema that cannot be parsed is remembered as a
// failure rather than re-parsed on every later cycle.
type prismaSetProblem struct {
  ID      string `json:"id"`
  Message string `json:"message"`
  Digest  string `json:"digest"`
}

type prismaModel struct {
  Name          string `json:"name"`
  Documentation string `json:"documentation"`
  // Digest is the model's own declaration, hashed by the bridge that parsed it,
  // with its documentation and its fields left out. A field is a unit of its
  // own and the scope composes them, so folding them in here would make one
  // field's edit expire a review of every sibling.
  Digest string        `json:"digest"`
  Fields []prismaField `json:"fields"`
}

type prismaField struct {
  Name          string `json:"name"`
  Symbol        string `json:"symbol"`
  Documentation string `json:"documentation"`
  // Digest is the field's own declaration, with its documentation left out.
  // Its type, its attributes, and their arguments reach no other part of this
  // process, so this is the only place a change to them is visible.
  Digest string `json:"digest"`
}

// loadPrismaInventories materializes one inventory per configured schema file.
//
// The population comes from Prisma's own parser and the locations come from a
// native scan, and the split is load-bearing rather than convenient. The parser
// answers what exists — including which fields are relations, which no amount
// of reading text recovers cheaply, because a back-reference carries no
// attribute at all — but its payload has no line, column, or even file for
// anything it returns. The scan answers only where a name is written, and it
// can neither add a unit nor remove one, so a scan that misses costs a precise
// location and never a silently smaller coverage denominator.
func loadPrismaInventories(
  root string,
  config graphConfig,
) (map[string]*artifactInventory, []string) {
  // A graph that names no Prisma glob never pays for one. The walk below is
  // cheap on such a project — every directory fails the descendant test and is
  // skipped at once — but "cheap" is still a full listing of the project root
  // on every cycle of every consumer who does not use this artifact kind.
  if !configuresPrisma(config) {
    return map[string]*artifactInventory{}, nil
  }
  addresses, failedBases, problems := configuredPrismaAddressesWithHealth(config)
  inventories := map[string]*artifactInventory{}
  for _, base := range failedBases {
    recordPopulationFailure(inventories, artifactPrisma, base)
  }
  for _, address := range addresses {
    inventories[address.Key] = &artifactInventory{
      Path: address.Display,
      Type: artifactPrisma,
    }
  }
  // The set is composed of physical files, deduplicated across bases by what
  // each address is on disk. Prisma parses one schema at a time and a file
  // listed twice is a duplicate declaration to its own parser, so two
  // populations that reach one file through different roots contribute it
  // once and are both served by that one parse.
  set := distinctPrismaSources(root, addresses)
  if len(set.Sources) == 0 {
    return inventories, problems
  }

  // Parsing costs a Node process, and the process start dominates it — a
  // ten-model schema and a two-hundred-model one pay nearly the same. A
  // resident host repeats this every cycle, so an unchanged schema would
  // otherwise be re-parsed on every TypeScript keystroke that rebuilds.
  digest := prismaContentDigest(root, set.Sources)
  if outcome, hit := prismaSchemas.lookup(digest); hit {
    return inventories, append(
      problems,
      prismaUnitsFromOutcome(root, set, inventories, outcome)...,
    )
  }

  result, err := normalizePrismaSet(root, set.Sources)
  if err != nil {
    message := "Evidence graph could not run its Prisma schema loader: " + causeText(err) + ". Prisma references require Node.js and a resolvable @prisma/prisma-schema-wasm."
    return inventories, append(problems, failPrismaSet(inventories, set, message))
  }

  outcome, problem := prismaOutcomeOf(result)
  if problem != "" {
    return inventories, append(problems, failPrismaSet(inventories, set, problem))
  }
  problems = append(
    problems,
    prismaUnitsFromOutcome(root, set, inventories, outcome)...,
  )
  rememberPrismaSchema(outcome.digest, outcome)
  return inventories, problems
}

// prismaOutcomeOf reduces one bridge answer to the single set that was asked
// for, and reports a contract drift rather than guessing past it.
//
// Every branch here describes a bridge that answered something other than what
// it was asked. None of them can be repaired by editing a schema, so each names
// the installation instead — and none may fall through to "no models", which is
// a schema whose every obligation is vacuously satisfied.
func prismaOutcomeOf(result prismaNormalizationResult) (prismaSetOutcome, string) {
  drift := "Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree."
  if len(result.Documents)+len(result.Problems) != 1 {
    return prismaSetOutcome{}, "Evidence graph Prisma loader answered " +
      decimal(len(result.Documents)+len(result.Problems)) +
      " schema sets for one request. " + drift
  }
  for _, document := range result.Documents {
    if document.ID != prismaSetID {
      return prismaSetOutcome{}, "Evidence graph Prisma loader returned an unconfigured schema set '" + document.ID + "'. " + drift
    }
    return prismaSetOutcome{Models: document.Models, digest: document.Digest}, ""
  }
  problem := result.Problems[0]
  if problem.ID != prismaSetID {
    return prismaSetOutcome{}, "Evidence graph Prisma loader rejected an unconfigured schema set '" + problem.ID + "'. " + drift
  }
  return prismaSetOutcome{
    Rejected: true,
    Problem:  problem.Message,
    digest:   problem.Digest,
  }, ""
}

// configuredPrismaAddresses lists the schema files every configured Prisma glob
// selects, claim and reference alike, once per population base.
//
// Order is the digest's, so it must not depend on filesystem enumeration.
func configuredPrismaAddresses(
  config graphConfig,
) ([]artifactAddress, []string) {
  addresses, _, problems := configuredPrismaAddressesWithHealth(config)
  return addresses, problems
}

func configuredPrismaAddressesWithHealth(
  config graphConfig,
) ([]artifactAddress, []populationBase, []string) {
  addresses := []artifactAddress{}
  failedBases := []populationBase{}
  problems := []string{}
  for _, base := range configuredBases(config, artifactPrisma) {
    if problem := baseDirectoryProblem(base, artifactPrisma); problem != "" {
      problems = append(problems, problem)
      failedBases = append(failedBases, base)
      continue
    }
    baseFailed := false
    from, resolved := resolvedBaseDirectory(base)
    if !resolved {
      problems = append(problems, unresolvedBaseProblem(base, artifactPrisma))
      failedBases = append(failedBases, base)
      continue
    }
    err := filepath.WalkDir(from, func(current string, entry fs.DirEntry, walkErr error) error {
      if walkErr != nil {
        // The walk root belongs to its population by construction, so a
        // failure to list it is a failure of the population. The relevance test
        // below is written for an entry inside the base and reached the base
        // itself only by accident, on a decision the glob shape made;
        // `loadMarkdownBase` records that history in full. Leaving this
        // exemption in one walker would decide an identical filesystem state by
        // artifact kind.
        if current == from {
          return walkErr
        }
        problem, relevant := unreadableEntryProblem(
          base,
          from,
          "Prisma",
          current,
          walkErr,
          func(relative string) bool {
            return matchesConfiguredPrismaFile(config, base, relative) ||
              couldContainConfiguredPrisma(config, base, relative)
          },
        )
        if relevant {
          baseFailed = true
          problems = append(problems, problem)
        }
        return filepath.SkipDir
      }
      if entry.IsDir() {
        if current == from {
          return nil
        }
        relative, ok := relativeProjectPath(from, current)
        if !ok || !couldContainConfiguredPrisma(config, base, relative) {
          return filepath.SkipDir
        }
        return nil
      }
      relative, ok := relativeProjectPath(from, current)
      if !ok || !matchesConfiguredPrismaFile(config, base, relative) {
        return nil
      }
      addresses = append(addresses, base.addressOf(relative))
      return nil
    })
    if err != nil {
      baseFailed = true
      problems = append(problems, unlistableBaseProblem(base, "Prisma", err))
    }
    if baseFailed {
      failedBases = append(failedBases, base)
    }
  }
  sort.Slice(addresses, func(left int, right int) bool {
    return addresses[left].Key < addresses[right].Key
  })
  return addresses, failedBases, problems
}

// prismaSourceSet is the parser's input: one spelling per physical schema file,
// beside every spelling the configuration reached that file by.
//
// Prisma parses a set, and a file handed to it twice is a duplicate declaration
// to its own parser — so the set has to be one entry per file on disk, not one
// per configured address. The spellings are kept because everything the parse
// produces is addressed by the entry that was sent, while the inventories
// waiting for it are addressed by whichever root each population reached the
// file through.
type prismaSourceSet struct {
  // Sources is the ordered set handed to the parser, the digest, and the
  // locator, one entry per physical file.
  Sources []string
  // Spellings maps each entry of Sources to every address display naming the
  // same file, that entry included.
  Spellings map[string][]string
}

// distinctPrismaSources reduces the configured addresses to the physical files
// the parser is handed, in one stable order.
//
// Identity is the file's own, taken from the filesystem rather than from the
// path that named it. Two populations reach one schema through different roots
// precisely when their spellings differ — a package rooted at its installed
// location and at its source checkout is the layout a package manager produces
// — so a spelling-keyed set sends that file to the parser twice and the parser
// rejects the whole set for a model declared twice. `os.SameFile` answers for
// the link, the junction, the hard link, and the case-insensitive volume
// alike, none of which a comparison of two strings can see.
//
// A file that cannot be stat'ed stands alone under its own spelling, which is
// the behavior every set had before identity was physical: the digest declines
// it and the loader reports it unreadable at its own path.
//
// The cost is one `os.Stat` per distinct configured address, and on Windows one
// file open beside it for each address that reaches a comparison, because
// `os.SameFile` loads the volume and file index there through `CreateFile`
// rather than from the stat — once per result, since the id is cached on it.
// Against that, the digest now reads one file per physical file rather than one
// per address, so in the very layout this exists for the reads go down as the
// stats go up. Both are per load of this artifact kind, of which a pass
// performs two — the claim-side populations and then the whole configuration —
// over a set an adopter counts in files.
func distinctPrismaSources(root string, addresses []artifactAddress) prismaSourceSet {
  type physicalSchema struct {
    identity  os.FileInfo
    spellings []string
  }
  files := []*physicalSchema{}
  seen := map[string]bool{}
  for _, address := range addresses {
    if seen[address.Display] {
      continue
    }
    seen[address.Display] = true
    identity, err := os.Stat(resolveProjectPath(root, address.Display))
    var host *physicalSchema
    if err == nil {
      for _, file := range files {
        if file.identity != nil && os.SameFile(file.identity, identity) {
          host = file
          break
        }
      }
    }
    if host == nil {
      host = &physicalSchema{}
      if err == nil {
        host.identity = identity
      }
      files = append(files, host)
    }
    host.spellings = append(host.spellings, address.Display)
  }
  set := prismaSourceSet{
    Sources:   []string{},
    Spellings: map[string][]string{},
  }
  for _, file := range files {
    // The set's own order is sorted below, but which spelling represents a
    // file is what every unit, declaration, and diagnostic of it will be
    // addressed by. Taking the smallest makes that choice a property of the
    // configuration rather than of the order a walk happened to produce.
    sort.Strings(file.spellings)
    set.Sources = append(set.Sources, file.spellings[0])
    set.Spellings[file.spellings[0]] = file.spellings
  }
  sort.Strings(set.Sources)
  return set
}

// prismaInventoriesBySource indexes the inventories waiting on each entry of
// the parsed set.
//
// This is where one parse result becomes every population's. The parse, the
// locations, and the comment scan all speak the set's spelling; an inventory
// speaks its own population's. Resolving the second through the first is what
// keeps a schema reached by two roots from serving only the root that happened
// to sort first.
func prismaInventoriesBySource(
  inventories map[string]*artifactInventory,
  set prismaSourceSet,
) map[string][]*artifactInventory {
  byDisplay := prismaInventoriesByDisplay(inventories)
  indexed := map[string][]*artifactInventory{}
  for _, source := range set.Sources {
    // Every source is the spelling of an address, and every address owns an
    // inventory, so no entry here is empty. It is written as an unconditional
    // fan-out rather than guarded against a state that cannot arise, because a
    // guard over one would say the opposite of what the loader guarantees.
    for _, spelling := range set.Spellings[source] {
      indexed[source] = append(indexed[source], byDisplay[spelling]...)
    }
  }
  return indexed
}

// prismaInventoriesByDisplay indexes the inventories that share one spelling of
// one physical file.
//
// Two populations reaching one schema through different roots own separate
// inventories of it, because each answers a different set of globs — while the
// file itself is parsed once and its models are located once. Everything derived
// from those bytes therefore has to reach every inventory of the file rather
// than one of them, which is what `prismaInventoriesBySource` composes on top
// of this index; a population whose root spells the file differently is not
// visible here.
func prismaInventoriesByDisplay(
  inventories map[string]*artifactInventory,
) map[string][]*artifactInventory {
  indexed := map[string][]*artifactInventory{}
  for _, inventory := range inventories {
    if inventory == nil {
      continue
    }
    indexed[inventory.Path] = append(indexed[inventory.Path], inventory)
  }
  return indexed
}

// failPrismaSet records one whole-set failure against every inventory of every
// file of the set.
//
// The symbol is `*` rather than `model`, and the difference is load-bearing. A
// reference reads an inventory problem only when it selects that problem's
// symbol (`graph.go:169-174`), so a set that failed to parse would look
// problem-free to a reference selecting only columns or relations — which then
// reports that its globs "materialized no selected evidence units", sending the
// author to widen a selector when the schema is what could not be read. A
// failure that belongs to the whole set belongs to every selector over it.
func failPrismaSet(
  inventories map[string]*artifactInventory,
  set prismaSourceSet,
  message string,
) string {
  indexed := prismaInventoriesBySource(inventories, set)
  for _, source := range set.Sources {
    for _, inventory := range indexed[source] {
      inventory.Problems = append(inventory.Problems, inventoryProblem{
        Symbol:  "*",
        Message: message,
      })
      inventory.LoadFailed = true
    }
  }
  return message
}

// configuresPrisma reports whether any claim or reference selects this artifact
// kind at all.
func configuresPrisma(config graphConfig) bool {
  for _, claim := range config.Claims {
    if claim.Type == artifactPrisma {
      return true
    }
    for _, reference := range claim.References {
      if reference.Type == artifactPrisma {
        return true
      }
    }
  }
  return false
}

func matchesConfiguredPrismaFile(
  config graphConfig,
  base populationBase,
  path string,
) bool {
  for _, claim := range config.Claims {
    if claim.Type == artifactPrisma &&
      claim.Base.Absolute == base.Absolute &&
      claim.Files.matches(path) {
      return true
    }
    for _, reference := range claim.References {
      if reference.Type == artifactPrisma &&
        reference.Base.Absolute == base.Absolute &&
        reference.Files.matches(path) {
        return true
      }
    }
  }
  return false
}

func couldContainConfiguredPrisma(
  config graphConfig,
  base populationBase,
  directory string,
) bool {
  for _, claim := range config.Claims {
    if claim.Type == artifactPrisma &&
      claim.Base.Absolute == base.Absolute &&
      claim.Files.couldMatchDescendant(directory) {
      return true
    }
    for _, reference := range claim.References {
      if reference.Type == artifactPrisma &&
        reference.Base.Absolute == base.Absolute &&
        reference.Files.couldMatchDescendant(directory) {
        return true
      }
    }
  }
  return false
}

func normalizePrismaSet(
  root string,
  sources []string,
) (prismaNormalizationResult, error) {
  request, err := json.Marshal(prismaNormalizationRequest{
    Root: root,
    Sets: []prismaSetRequest{{ID: prismaSetID, Files: sources}},
  })
  if err != nil {
    return prismaNormalizationResult{}, err
  }
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node, err = exec.LookPath("node")
    if err != nil {
      return prismaNormalizationResult{}, errors.New("Node.js executable was not found")
    }
  }
  ctx, cancel := context.WithTimeout(context.Background(), prismaBridgeTimeout)
  defer cancel()
  command := exec.CommandContext(ctx, node, "-e", prismaBridgeScript, root)
  command.Dir = root
  command.Stdin = bytes.NewReader(request)
  stdout := &limitedBuffer{Limit: prismaBridgeOutputLimit}
  stderr := &limitedBuffer{Limit: prismaBridgeErrorLimit}
  command.Stdout = stdout
  command.Stderr = stderr
  if err := command.Run(); err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return prismaNormalizationResult{}, errors.New("Prisma schema loader exceeded its 60 second timeout")
    }
    detail := strings.TrimSpace(stderr.String())
    if detail == "" {
      detail = err.Error()
    }
    return prismaNormalizationResult{}, errors.New(detail)
  }
  var result prismaNormalizationResult
  if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
    return prismaNormalizationResult{}, errors.New("Prisma schema loader returned invalid JSON: " + err.Error())
  }
  return result, nil
}

// prismaModelUnits turns one parsed model into its unit and its members'.
//
// A relation is a field, so a two-sided relation is two units, one owned by
// each model — including a self-relation, where both sides belong to the same
// model and share one relation name. Collapsing them by that shared name would
// give one unit two parents, which the hierarchy has no way to express.
func prismaModelUnits(model prismaModel) []*evidenceUnit {
  modelID := "prisma:" + model.Name
  // A schema author marking a model internal has made the same declaration a
  // TypeScript author makes with the same tag, and a model that is out of the
  // surface takes its fields with it.
  modelHidden := commentHidingTag(model.Documentation)
  units := []*evidenceUnit{{
    ID:       modelID,
    Target:   modelID,
    Identity: []string{model.Name},
    Type:     artifactPrisma,
    Symbol:   "model",
    Readable: "Prisma model '" + model.Name + "'",
    Hidden:   modelHidden,
    Digest:   model.Digest,
  }}
  seen := map[string]bool{}
  for _, field := range model.Fields {
    if field.Symbol != "column" && field.Symbol != "relation" {
      continue
    }
    target := modelID + "." + field.Name
    if seen[target] {
      continue
    }
    seen[target] = true
    fieldHidden := modelHidden
    if fieldHidden == "" {
      fieldHidden = commentHidingTag(field.Documentation)
    }
    units = append(units, &evidenceUnit{
      ID:       target,
      ParentID: modelID,
      Target:   target,
      Identity: []string{model.Name, field.Name},
      Type:     artifactPrisma,
      Symbol:   field.Symbol,
      Readable: "Prisma " + field.Symbol + " '" + model.Name + "." + field.Name + "'",
      Hidden:   fieldHidden,
      Digest:   field.Digest,
    })
  }
  return units
}

// prismaDeclarationsFromComments turns the scanned comment runs into
// declarations, and reports every citation that cannot become one.
//
// Silence is the failure this rule exists to remove, so a tag is never simply
// skipped. Which forms may host was settled by measurement rather than by
// preference: `///` and `/* */` both reach the parser's `documentation` and
// both are emitted into the generated client and into prisma-markdown's ERD,
// so both host a citation here. `//` is discarded by Prisma itself and is the
// only form that cannot. A top-level unattached `///` run is the one
// exclusion-only carrier.
// Every other unusable placement — documenting nothing,
// documenting something this graph does not address, or burying the tag behind
// an extra slash — names the move that fixes it.
func prismaDeclarationsFromComments(
  comments []prismaCommentRun,
  hosts map[string]*evidenceUnit,
  inventories map[string][]*artifactInventory,
) []string {
  problems := []string{}
  sequence := 0
  for _, run := range comments {
    location := run.Path + ":" + decimal(run.Line)
    if run.Form != prismaDocComment {
      if prismaCommentCarriesTag(run.Body) {
        problems = append(
          problems,
          "Evidence tag at "+location+" sits in a '//' line comment, which Prisma discards rather than attaching to the declaration below it. Write the citation on a '///' or '/* */' documentation comment directly above the model, column, or relation it grounds.",
        )
      }
      continue
    }
    if run.FileLevel {
      hosted := inventories[run.Path]
      if len(hosted) == 0 {
        continue
      }
      for _, offset := range prismaBuriedTagLines(run.Body) {
        problems = append(
          problems,
          "Evidence tag at "+run.Path+":"+decimal(run.Line+offset)+" is buried behind an extra slash. Prisma reads a fourth slash as content, so the tag no longer opens its documentation line and nothing resolves it. Write exactly three slashes.",
        )
      }
      for _, parsed := range parseCommentDeclarations(run.Body, true) {
        sequence++
        line := run.Line + parsed.LineOffset
        if parsed.Tag == tagEvidence {
          problems = append(
            problems,
            "@evidence at "+run.Path+":"+decimal(line)+" is on a file-level Prisma exclusion carrier. Move ownership evidence directly above the selected model, column, or relation it grounds; only @evidenceExclude may be unattached at file level.",
          )
          continue
        }
        declaration := &evidenceDeclaration{
          ID:               "prisma:" + run.Path + ":" + decimal(line) + ":" + decimal(sequence),
          HostID:           "prisma:" + run.Path + ":file",
          Type:             artifactPrisma,
          Tag:              parsed.Tag,
          Target:           parsed.Target,
          Reason:           parsed.Reason,
          ExclusionCarrier: true,
          Path:             run.Path,
          Line:             line,
          Sequence:         sequence,
        }
        for _, inventory := range hosted {
          inventory.Declarations = append(inventory.Declarations, declaration)
        }
      }
      // An unattached run is the one position that accepts `@evidenceExclude`
      // and never `@evidence`, and a lint-only `.schema` ledger is built out of
      // exactly these. Its exclusions owe a review like any other
      // acknowledgement, so the review has to be readable here too. Collecting
      // it only where a declaration is attached would leave the ledger reporting
      // every exclusion unreviewed forever, with the repair written in a comment
      // nothing reads back — the same dead end the attached case just escaped.
      for _, review := range parseReviews(run.Body) {
        shared := &evidenceReview{
          SemanticHostIDs: []string{"prisma:" + run.Path + ":file"},
          Reviews:         review.Reviews,
          Type:            artifactPrisma,
          Target:          review.Target,
          Fingerprint:     review.Fingerprint,
          Description:     review.Description,
          Path:            run.Path,
          Line:            run.Line + review.LineOffset,
        }
        for _, inventory := range hosted {
          inventory.Reviews = append(inventory.Reviews, shared)
        }
      }
      continue
    }
    if run.Key == "" {
      if prismaCommentCarriesTag(run.Body) {
        problems = append(
          problems,
          "Evidence tag at "+location+" documents no declaration. Prisma attaches a '///' comment to the declaration that immediately follows it, so a blank line before a top-level block, a block attribute, or a closing brace leaves the comment documenting nothing. Move the citation directly above the model, column, or relation it grounds.",
        )
      }
      continue
    }
    host := hosts[run.Key]
    if host == nil {
      if prismaCommentCarriesTag(run.Body) {
        problems = append(
          problems,
          "Evidence tag at "+location+" documents '"+run.Key+"', which is not a model, column, or relation. A model or a view and their members host an evidence citation; an enum, a composite type, and a datasource or generator setting do not.",
        )
      }
      continue
    }
    hosted := inventories[run.Path]
    if len(hosted) == 0 {
      continue
    }
    for _, offset := range prismaBuriedTagLines(run.Body) {
      problems = append(
        problems,
        "Evidence tag at "+run.Path+":"+decimal(run.Line+offset)+" is buried behind an extra slash. Prisma reads a fourth slash as content, so the tag no longer opens its documentation line and nothing resolves it. Write exactly three slashes.",
      )
    }
    for _, parsed := range parseCommentDeclarations(run.Body, true) {
      sequence++
      line := run.Line + parsed.LineOffset
      // One declaration, one identity, shared by every inventory of the
      // file it is written in. Two populations that reached this schema
      // through different roots each need to see it, and giving each its
      // own copy would make one comment two declarations in the map
      // `evaluateEvidenceGraph` keys by ID.
      declaration := &evidenceDeclaration{
        ID:              "prisma:" + run.Path + ":" + decimal(line) + ":" + decimal(sequence),
        HostID:          host.ID,
        SemanticHostIDs: []string{host.ID},
        Type:            artifactPrisma,
        Tag:             parsed.Tag,
        Target:          parsed.Target,
        Reason:          parsed.Reason,
        Hosts:           prismaHostSymbols(host),
        Path:            run.Path,
        Line:            line,
        Sequence:        sequence,
      }
      for _, inventory := range hosted {
        inventory.Declarations = append(inventory.Declarations, declaration)
      }
    }
    // Reviews are read here for the same reason the citations are. Without
    // this, a Prisma claim citing a reference that requires a review reports
    // every citation unreviewed forever, and the repair the message names —
    // write the tag in this documentation comment — has no effect, because
    // nothing reads the tag back out. A diagnostic must never name a repair the
    // author cannot perform.
    for _, review := range parseReviews(run.Body) {
      shared := &evidenceReview{
        SemanticHostIDs: []string{host.ID},
        Reviews:         review.Reviews,
        Type:            artifactPrisma,
        Target:          review.Target,
        Fingerprint:     review.Fingerprint,
        Description:     review.Description,
        Path:            run.Path,
        Line:            run.Line + review.LineOffset,
      }
      for _, inventory := range hosted {
        inventory.Reviews = append(inventory.Reviews, shared)
      }
    }
  }
  return problems
}

// prismaHostSymbols reports the host kinds a declaration on this unit satisfies.
//
// A unit withdrawn from the surface by its own documentation tag hosts nothing:
// it is not a selected claim host, and with no host kind it is not an exclusion
// carrier either. The declaration is still recorded, so the citation on it is
// reported rather than silently discarded.
func prismaHostSymbols(host *evidenceUnit) symbolSet {
  if host == nil || host.Hidden != "" {
    return nil
  }
  return symbolSet{host.Symbol: true}
}

// prismaCommentCarriesTag reports whether a comment body opens a citation on
// any of its lines.
func prismaCommentCarriesTag(body string) bool {
  for _, line := range strings.Split(body, "\n") {
    trimmed := strings.TrimSpace(line)
    if _, _, found := declarationLine(trimmed); found {
      return true
    }
    if prismaBuriedTag(trimmed) {
      return true
    }
  }
  return false
}

// prismaBuriedTagLines lists the offsets of lines whose citation is buried
// behind extra slashes.
//
// A fourth slash is content, not syntax: Prisma's `(!"///") ~ "//"` lookahead
// makes `//// @evidence ...` a doc comment whose text begins `/ @evidence ...`.
// The tag therefore no longer opens its line, so nothing parses it — and
// nothing reported it either, which made a one-keystroke slip the quietest
// failure in this artifact kind. The comment is real, the schema keeps it, and
// an author reading the file sees a citation that does nothing.
func prismaBuriedTagLines(body string) []int {
  offsets := []int{}
  for offset, line := range strings.Split(body, "\n") {
    trimmed := strings.TrimSpace(line)
    if _, _, found := declarationLine(trimmed); found {
      continue
    }
    if prismaBuriedTag(trimmed) {
      offsets = append(offsets, offset)
    }
  }
  return offsets
}

// prismaBuriedTag reports whether a line would open a citation once its leading
// comment punctuation is removed.
//
// Two shapes bury a tag, and both are one keystroke from a citation that works.
// A fourth slash makes `//// @evidence` a doc comment whose text begins with a
// slash, and a JSDoc-style block hands Prisma its own asterisks as content:
// measured, `/** @evidence x */` reaches the parser's documentation as
// `* @evidence x`, and the multi-line form keeps a leading asterisk on every
// line of it. In both the tag no longer opens its line, so nothing parses it —
// and until this stripped asterisks too, nothing reported it either. A schema
// author arriving from JSDoc writes the second shape by habit.
//
// Only leading punctuation is stripped, so prose that merely mentions the tag
// somewhere in a sentence is untouched. Over-reporting an ordinary comment
// would teach an author to stop reading these diagnostics, which costs more
// than the case being caught.
func prismaBuriedTag(trimmed string) bool {
  stripped := strings.TrimSpace(strings.TrimLeft(trimmed, "/"))
  if stripped == trimmed {
    return false
  }
  _, _, found := declarationLine(stripped)
  return found
}

// prismaNormalizationFailure words a rejected schema identically whether the
// rejection arrived from the parser this cycle or from memory.
//
// The parser's own report is preserved rather than summarized, because it is
// the only place a location survives: a successful parse carries no positions
// at all, while a rejection names the file and line the author has to open.
func prismaNormalizationFailure(message string) string {
  reason := causeReason(strings.TrimSpace(message))
  if reason == "" {
    reason = "the parser reported no reason"
  }
  return "Evidence graph could not parse the configured Prisma schema: " +
    reason +
    ". Fix the schema so Prisma can read it."
}
