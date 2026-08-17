package evidence

import (
  "bytes"
  "encoding/json"
  "fmt"
  "net/url"
  "path"
  "sort"
  "strings"
)

func decodeGraphConfig(raw json.RawMessage) (graphConfig, []string) {
  var config graphConfig
  if len(bytes.TrimSpace(raw)) == 0 {
    return config, []string{
      "Invalid evidence/graph configuration: the rule requires an ITtscEvidenceGraphConfig options object. Configure it as ['error', { claims: [...] }].",
    }
  }
  object, problem := decodeObject(raw, "configuration")
  if problem != "" {
    return config, []string{problem}
  }
  problems := rejectUnknownFields(object, []string{"claims"}, graphRuleName, "configuration")
  claimRaw, exists := object["claims"]
  if !exists {
    problems = append(problems, "Invalid evidence/graph configuration at claims: the required claim array is missing.")
    return config, problems
  }
  var claims []json.RawMessage
  if err := json.Unmarshal(claimRaw, &claims); err != nil {
    problems = append(problems, "Invalid evidence/graph configuration at claims: expected an array of Markdown or TypeScript claims.")
    return config, problems
  }
  if len(claims) == 0 {
    problems = append(problems, "Invalid evidence/graph configuration at claims: at least one claim is required; an empty graph cannot establish evidence coverage.")
    return config, problems
  }
  for index, claimRaw := range claims {
    claim, claimProblems := decodeClaim(claimRaw, index)
    problems = append(problems, claimProblems...)
    if len(claimProblems) == 0 {
      config.Claims = append(config.Claims, claim)
    }
  }
  return config, problems
}

func decodeClaim(raw json.RawMessage, index int) (claimSpec, []string) {
  path := fmt.Sprintf("claims[%d]", index)
  object, problem := decodeObject(raw, path)
  if problem != "" {
    return claimSpec{}, []string{problem}
  }
  problems := rejectUnknownFields(
    object,
    []string{"type", "name", "disabled", "root", "files", "evidenceExcludeCarriers", "symbol", "reference"},
    graphRuleName,
    path,
  )
  kind, kindProblem := decodeArtifactKind(object["type"], path+".type", false)
  if kindProblem != "" {
    problems = append(problems, kindProblem)
  }
  name := ""
  if rawName, exists := object["name"]; exists {
    if err := json.Unmarshal(rawName, &name); err != nil {
      problems = append(problems, "Invalid evidence/graph configuration at "+path+".name: expected a diagnostic-only string label.")
    }
  }
  disabled := false
  if rawDisabled, exists := object["disabled"]; exists {
    switch string(bytes.TrimSpace(rawDisabled)) {
    case "true":
      disabled = true
    case "false":
    default:
      problems = append(problems, "Invalid evidence/graph configuration at "+path+".disabled: expected a boolean.")
    }
  }
  root, rootProblems := decodeClaimRoot(object["root"], kind, path+".root")
  problems = append(problems, rootProblems...)
  files, fileProblems := decodeFiles(object["files"], path+".files")
  problems = append(problems, fileProblems...)
  carriers := globSet{}
  if raw, exists := object["evidenceExcludeCarriers"]; exists {
    decoded, carrierProblems := decodeFiles(raw, path+".evidenceExcludeCarriers")
    problems = append(problems, carrierProblems...)
    carriers = decoded
  }
  symbols, symbolProblems := decodeSymbols(object["symbol"], kind, false, graphRuleName, path+".symbol")
  problems = append(problems, symbolProblems...)
  references, referenceProblems := decodeReferences(kind, object["reference"], path+".reference")
  problems = append(problems, referenceProblems...)
  problems = append(problems, rejectChecklistCarriers(carriers, references, path)...)
  if len(problems) != 0 {
    return claimSpec{}, problems
  }
  return claimSpec{
    Index:             index,
    Type:              kind,
    Name:              name,
    Disabled:          disabled,
    Root:              root,
    Files:             files,
    ExclusionCarriers: carriers,
    Symbols:           symbols,
    References:        references,
  }, nil
}

// enabledGraphConfig removes explicitly staged claims after their public
// configuration has been validated. Keeping the filter separate from decoding
// preserves original claim indexes and prevents disabled entries from hiding a
// malformed shape.
func enabledGraphConfig(config graphConfig) graphConfig {
  claims := make([]claimSpec, 0, len(config.Claims))
  for _, claim := range config.Claims {
    if claim.Disabled {
      continue
    }
    claims = append(claims, claim)
  }
  config.Claims = claims
  return config
}

func decodeReferences(
  claimKind artifactKind,
  raw json.RawMessage,
  path string,
) ([]referenceSpec, []string) {
  if len(bytes.TrimSpace(raw)) == 0 {
    return nil, []string{"Invalid evidence/graph configuration at " + path + ": the required evidence reference is missing."}
  }
  trimmed := bytes.TrimSpace(raw)
  elements := []json.RawMessage{}
  switch trimmed[0] {
  case '{':
    elements = append(elements, raw)
  case '[':
    if err := json.Unmarshal(raw, &elements); err != nil {
      return nil, []string{"Invalid evidence/graph configuration at " + path + ": expected one reference object or an array of reference objects."}
    }
    if len(elements) == 0 {
      return nil, []string{"Invalid evidence/graph configuration at " + path + ": an empty reference array creates no coverage obligation; provide at least one evidence reference."}
    }
  default:
    return nil, []string{"Invalid evidence/graph configuration at " + path + ": expected one reference object or an array of reference objects."}
  }
  references := make([]referenceSpec, 0, len(elements))
  problems := []string{}
  for index, element := range elements {
    referencePath := path
    if len(elements) > 1 || trimmed[0] == '[' {
      referencePath += "[" + decimal(index) + "]"
    }
    reference, referenceProblems := decodeReference(
      claimKind,
      element,
      index,
      referencePath,
    )
    problems = append(problems, referenceProblems...)
    if len(referenceProblems) == 0 {
      references = append(references, reference)
    }
  }
  return references, problems
}

func decodeReference(
  claimKind artifactKind,
  raw json.RawMessage,
  index int,
  path string,
) (referenceSpec, []string) {
  object, problem := decodeObject(raw, path)
  if problem != "" {
    return referenceSpec{}, []string{problem}
  }
  problems := rejectUnknownFields(
    object,
    []string{
      "type",
      "noEvidenceExclude",
      "uniqueEvidence",
      "singleEvidencePerSymbol",
      "requireReview",
      "checklist",
      "package",
      "root",
      "file",
      "files",
      "symbol",
    },
    graphRuleName,
    path,
  )
  kind, kindProblem := decodeArtifactKind(object["type"], path+".type", true)
  if kindProblem != "" {
    problems = append(problems, kindProblem)
  }
  if problem := rejectForeignTypeScriptReference(claimKind, kind, path); problem != "" {
    problems = append(problems, problem)
  }
  root, rootProblems := decodeRoot(object["root"], kind, path+".root")
  problems = append(problems, rootProblems...)
  policy, policyProblems := decodeReferencePolicy(object, kind, path)
  problems = append(problems, policyProblems...)
  files := globSet{}
  source := ""
  packageName := ""
  symbols := symbolSet{}
  if kind != artifactTypeScript {
    if _, exists := object["package"]; exists {
      problems = append(
        problems,
        "Invalid evidence/graph configuration at "+path+".package: only a TypeScript reference can select an installed package; Markdown and Swagger evidence lives in this project.",
      )
    }
  }
  if kind == artifactTypeScript {
    reference, referenceProblems := decodeTypeScriptReference(object, path)
    problems = append(problems, referenceProblems...)
    files = reference.Files
    packageName = reference.Package
    var symbolProblems []string
    symbols, symbolProblems = decodeSymbols(object["symbol"], kind, true, graphRuleName, path+".symbol")
    problems = append(problems, symbolProblems...)
  } else if kind == artifactSwagger {
    if _, exists := object["files"]; exists {
      problems = append(
        problems,
        "Invalid evidence/graph configuration at "+path+".files: a Swagger reference owns one document; use singular 'file' and a reference array for multiple documents.",
      )
    }
    if _, exists := object["symbol"]; exists {
      problems = append(
        problems,
        "Invalid evidence/graph configuration at "+path+".symbol: Swagger references select every operation and do not accept a symbol selector.",
      )
    }
    var sourceProblem string
    source, sourceProblem = decodeSwaggerSource(object["file"], path+".file")
    if sourceProblem != "" {
      problems = append(problems, sourceProblem)
    }
    symbols["operation"] = true
  } else {
    if _, exists := object["file"]; exists {
      problems = append(
        problems,
        "Invalid evidence/graph configuration at "+path+".file: singular 'file' is only supported by Swagger references; Markdown and TypeScript references use 'files' globs.",
      )
    }
    var fileProblems []string
    files, fileProblems = decodeFiles(object["files"], path+".files")
    problems = append(problems, fileProblems...)
    var symbolProblems []string
    symbols, symbolProblems = decodeSymbols(object["symbol"], kind, true, graphRuleName, path+".symbol")
    problems = append(problems, symbolProblems...)
  }
  if len(problems) != 0 {
    return referenceSpec{}, problems
  }
  return referenceSpec{
    Index:   index,
    Type:    kind,
    Policy:  policy,
    Root:    root,
    Files:   files,
    Source:  source,
    Package: packageName,
    Symbols: symbols,
  }, nil
}

// decodeReferencePolicy validates the reference-local acknowledgement options
// before a disabled claim is filtered. Each option is a flat boolean whose
// false value means "not configured", so an omitted option and an explicit
// false preserve the original behavior identically.
//
// The reference kind is read only by `checklist`, which the other four do not
// need: they tighten a count that every artifact kind has, while a per-host
// obligation is a statement about a document that is read item by item.
func decodeReferencePolicy(
  object map[string]json.RawMessage,
  kind artifactKind,
  path string,
) (referencePolicy, []string) {
  policy := referencePolicy{}
  problems := []string{}
  decodeFlag := func(name string, target *bool) {
    value, exists := object[name]
    if !exists {
      return
    }
    // A JSON null decodes into Go's false without complaint, which would
    // make a broken generator's output indistinguishable from an option
    // nobody wrote. Only the two literals are the contract.
    switch string(bytes.TrimSpace(value)) {
    case "true":
      *target = true
    case "false":
    default:
      problems = append(problems, configurationProblem(
        graphRuleName,
        path+"."+name,
        "expected a boolean.",
      ))
    }
  }
  decodeFlag("noEvidenceExclude", &policy.NoExclude)
  decodeFlag("uniqueEvidence", &policy.UniqueEvidence)
  decodeFlag("singleEvidencePerSymbol", &policy.SingleEvidencePerSymbol)
  decodeFlag("requireReview", &policy.RequireReview)
  decodeFlag("checklist", &policy.Checklist)
  problems = append(problems, rejectChecklistConflicts(policy, kind, path)...)
  return policy, problems
}

// rejectChecklistCarriers refuses a checklist beside gathered exclusion
// carriers, which is the third combination no author can satisfy.
//
// The two state opposite intents. Carriers gather every exclusion a claim owns
// into one file so a reviewer reads them by opening it; a checklist makes every
// acknowledgement one host's own answer. Together they leave every host outside
// the carrier globs with no way to say an item does not apply: the tag written
// beside the host is refused as misplaced, and the tag written in the carrier
// answers for no host. Measured, the two diagnostics name each other's file, so
// an author following either repair is sent back to the other.
//
// Refused here rather than as coverage for the same reason the cardinality
// pairs are: it is a property of the configuration, and a claim whose every
// host happens to sit in a carrier file satisfies it by accident.
func rejectChecklistCarriers(
  carriers globSet,
  references []referenceSpec,
  path string,
) []string {
  if len(carriers.Patterns) == 0 {
    return nil
  }
  for _, reference := range references {
    // A reference refusing exclusions outright has nothing for the carriers to
    // confine, so the impossibility this refuses does not arise there and the
    // carriers are governing some other reference's exclusions, which is the
    // ledger the property exists for. Refusing that pair would contradict the
    // published guidance that `checklist` and `noEvidenceExclude` are the
    // intended pairing.
    if !reference.Policy.Checklist || reference.Policy.NoExclude {
      continue
    }
    where := path + ".reference"
    if len(references) > 1 {
      where += "[" + decimal(reference.Index) + "]"
    }
    return []string{configurationProblem(
      graphRuleName,
      path+".evidenceExcludeCarriers",
      "a checklist reference cannot be gathered into exclusion carriers: "+where+
        " makes every acknowledgement one host's own answer, while these globs confine exclusions to other files, so no host outside them can record that an item does not apply. Drop the carriers, drop `checklist` from that reference, or give it `noEvidenceExclude` so it accepts no exclusion to gather.",
    )}
  }
  return nil
}

// rejectChecklistConflicts refuses the two combinations no author can satisfy
// and the artifact kinds a checklist is not a statement about.
//
// The kind refusal is silent when the kind itself failed to decode, the way
// rejectForeignTypeScriptReference is: naming an artifact the author did not
// successfully spell would send them to the wrong line.
//
// The two cardinality refusals are unsatisfiability, not preference. A
// checklist makes every selected host cite every unit, so uniqueEvidence's
// one-host-per-unit ceiling breaks the moment a claim has two hosts, and
// singleEvidencePerSymbol's exactly-one-unit-per-host breaks the moment the
// population has two units. Both are reported at decode rather than as
// coverage failures, because a population of one unit and one host satisfies
// them by accident and would let a contradictory configuration ship until the
// day a second file arrives.
func rejectChecklistConflicts(
  policy referencePolicy,
  kind artifactKind,
  path string,
) []string {
  if !policy.Checklist {
    return nil
  }
  if kind != artifactMarkdown && kind != "" {
    return []string{configurationProblem(
      graphRuleName,
      path+".checklist",
      "only a Markdown reference can be a checklist; a "+string(kind)+
        " population has no reading order in which a host answers one item at a time. Drop the option, or move the items into a Markdown document this reference selects.",
    )}
  }
  problems := []string{}
  if policy.UniqueEvidence {
    problems = append(problems, configurationProblem(
      graphRuleName,
      path+".checklist",
      "checklist and uniqueEvidence cannot both hold: a checklist requires every selected host to cite every unit, while uniqueEvidence allows each unit at most one host, so any claim with two hosts fails both ways. Keep the one that states this obligation.",
    ))
  }
  if policy.SingleEvidencePerSymbol {
    problems = append(problems, configurationProblem(
      graphRuleName,
      path+".checklist",
      "checklist and singleEvidencePerSymbol cannot both hold: a checklist requires every selected host to cite every unit, while singleEvidencePerSymbol allows each host exactly one, so any population with two units fails both ways. Keep the one that states this obligation.",
    ))
  }
  return problems
}

// rejectForeignTypeScriptReference refuses a code population to a claim that
// cannot address one.
//
// A symbol is cited through an inline link, and that link resolves in the
// citing module's import scope — which only a TypeScript file has. Every other
// claim would have to fall back to matching the bare name against one
// repository-wide table, and that makes symbol-name uniqueness across the whole
// repository load-bearing: two modules exporting `IPage` make the citation
// impossible, and the only repair such a diagnostic can offer is renaming
// production code to suit a lint rule.
//
// The check is here rather than at resolution because a configuration error
// belongs where the configuration is read. Reported once per reference, before
// any file is opened, instead of once per citation that later fails to resolve.
//
// What this gives up is the decision it reverses: documentation can no longer
// cite code, and the inverse obligation is not the same one. Do not restore the fallback
// without restoring that record.
func rejectForeignTypeScriptReference(
  claimKind artifactKind,
  referenceKind artifactKind,
  path string,
) string {
  if referenceKind != artifactTypeScript ||
    claimKind == artifactTypeScript ||
    claimKind == "" {
    return ""
  }
  return "Invalid evidence/graph configuration at " + path +
    ".type: only a TypeScript claim can cite TypeScript evidence, because a symbol citation resolves through the citing module's imports and a " +
    string(claimKind) +
    " comment has none. Invert the obligation so the code cites this artifact, or move the citation into TypeScript."
}

// decodeTypeScriptReference reads the two ways a TypeScript population is
// selected: a local or package-relative glob set, or a package's own
// declaration entry.
//
// Both reduce to "produce a file set, then materialize its exported symbols";
// only the selection differs. `package` moves the base the globs resolve
// against, so it composes with them rather than replacing them.
func decodeTypeScriptReference(
  object map[string]json.RawMessage,
  path string,
) (referenceSpec, []string) {
  problems := []string{}
  reference := referenceSpec{}
  if raw, exists := object["package"]; exists {
    var value string
    if err := json.Unmarshal(raw, &value); err != nil {
      problems = append(problems, "Invalid evidence/graph configuration at "+path+".package: expected an installed package name.")
    } else if name, problem := normalizePackageName(value); problem != "" {
      problems = append(problems, "Invalid evidence/graph configuration at "+path+".package: "+problem)
    } else {
      reference.Package = name
    }
  }
  if _, exists := object["file"]; exists {
    problems = append(
      problems,
      "Invalid evidence/graph configuration at "+path+".file: singular 'file' is only supported by Swagger references; a TypeScript reference selects its population with 'files' globs.",
    )
  }
  if _, exists := object["files"]; exists {
    files, fileProblems := decodeFiles(object["files"], path+".files")
    problems = append(problems, fileProblems...)
    reference.Files = files
    return reference, problems
  }
  if reference.Package == "" {
    problems = append(
      problems,
      "Invalid evidence/graph configuration at "+path+": a local TypeScript reference needs 'files' globs. There is no implicit project population.",
    )
  }
  // A package with no globs falls back to its own declaration entry, which is
  // the only selection a package can make on the consumer's behalf.
  return reference, problems
}

func normalizePackageName(value string) (string, string) {
  if value == "" {
    return "", "the package name must not be empty."
  }
  if strings.TrimSpace(value) != value {
    return "", "the package name must not have leading or trailing whitespace."
  }
  normalized := strings.ReplaceAll(value, "\\", "/")
  if strings.HasPrefix(normalized, ".") || strings.HasPrefix(normalized, "/") {
    return "", "'" + value + "' is a path rather than a package name; use 'files' for a local population."
  }
  segments := strings.Split(normalized, "/")
  limit := 1
  if strings.HasPrefix(segments[0], "@") {
    limit = 2
  }
  if len(segments) > limit {
    return "", "'" + value + "' names a path inside a package; select the package and narrow it with 'files'."
  }
  if len(segments) < limit {
    return "", "'" + value + "' is an incomplete scoped package name."
  }
  return normalized, ""
}

func decodeArtifactKind(
  raw json.RawMessage,
  path string,
  allowSwagger bool,
) (artifactKind, string) {
  if len(bytes.TrimSpace(raw)) == 0 {
    return "", "Invalid evidence/graph configuration at " + path + ": the artifact discriminator is required."
  }
  var value string
  if err := json.Unmarshal(raw, &value); err != nil {
    return "", "Invalid evidence/graph configuration at " + path + ": expected a supported artifact type string."
  }
  switch artifactKind(value) {
  case artifactMarkdown, artifactPrisma, artifactTypeScript:
    return artifactKind(value), ""
  case artifactSwagger:
    if allowSwagger {
      return artifactSwagger, ""
    }
    return "", "Invalid evidence/graph configuration at " + path + ": Swagger is evidence-only and cannot be a claim; expected 'markdown', 'prisma', or 'typescript'."
  default:
    expected := "'markdown', 'prisma', or 'typescript'"
    if allowSwagger {
      expected = "'markdown', 'prisma', 'swagger', or 'typescript'"
    }
    return "", "Invalid evidence/graph configuration at " + path + ": unsupported artifact type '" + value + "'; expected " + expected + "."
  }
}

// decodeClaimRoot admits a Program-backed TypeScript population without
// widening the Program itself.
//
// The root changes the address space and glob base only. The inventory still
// consists exclusively of ctx.Sources, so a sibling package must be an explicit
// tsconfig root and no configured directory becomes a filesystem scan.
func decodeClaimRoot(
  raw json.RawMessage,
  kind artifactKind,
  configPath string,
) (string, []string) {
  if len(bytes.TrimSpace(raw)) == 0 {
    return "", nil
  }
  if kind != artifactTypeScript {
    return decodeRoot(raw, kind, configPath)
  }
  return decodePopulationRoot(raw, configPath)
}

// decodeRoot reads the directory a Markdown or Prisma population resolves
// against.
//
// The property is refused on the two artifact kinds that cannot use it, and
// each refusal names the channel that artifact does have. A TypeScript
// population is materialized from the ttsc Program, so a directory outside the
// project contains no file it could ever reach — `package` is the escape there,
// and it already exists. A Swagger reference names one exact document, so the
// location belongs in `file`, where it is visible without a second property.
func decodeRoot(
  raw json.RawMessage,
  kind artifactKind,
  configPath string,
) (string, []string) {
  if len(bytes.TrimSpace(raw)) == 0 {
    return "", nil
  }
  switch kind {
  case artifactMarkdown, artifactPrisma:
  case artifactTypeScript:
    return "", []string{
      "Invalid evidence/graph configuration at " + configPath + ": a TypeScript reference selects the active ttsc program with 'files', or an installed package with 'package'; only a TypeScript claim accepts 'root'.",
    }
  case artifactSwagger:
    return "", []string{
      "Invalid evidence/graph configuration at " + configPath + ": a Swagger reference owns one exact document; write the ancestor-relative or absolute location in 'file' instead.",
    }
  default:
    // The discriminator is already reported; a second message about a
    // property of an unknown artifact kind would only add noise.
    return "", nil
  }
  return decodePopulationRoot(raw, configPath)
}

func decodePopulationRoot(
  raw json.RawMessage,
  configPath string,
) (string, []string) {
  var value string
  if err := json.Unmarshal(raw, &value); err != nil {
    return "", []string{
      "Invalid evidence/graph configuration at " + configPath + ": expected one directory path this population's globs resolve against.",
    }
  }
  normalized, problem := normalizeRootPath(value)
  if problem != "" {
    return "", []string{"Invalid evidence/graph configuration at " + configPath + ": " + problem}
  }
  return normalized, nil
}

func decodeSwaggerSource(raw json.RawMessage, configPath string) (string, string) {
  if len(bytes.TrimSpace(raw)) == 0 {
    return "", "Invalid evidence/graph configuration at " + configPath + ": the required Swagger file path or URL is missing."
  }
  var value string
  if err := json.Unmarshal(raw, &value); err != nil {
    return "", "Invalid evidence/graph configuration at " + configPath + ": expected one exact file path or http(s) URL."
  }
  source, problem := normalizeSwaggerSource(value)
  if problem != "" {
    return "", "Invalid evidence/graph configuration at " + configPath + ": " + problem
  }
  return source, ""
}

// normalizeSwaggerSource reduces a declared Swagger location to one canonical
// spelling, without deciding where on the filesystem it may sit.
//
// A local path is free to ascend with `..` or to be absolute, and the ordering
// this restores is the point: the rule already accepts an arbitrary http(s) URL
// on any host, so refusing `../contracts/swagger.json` refused the one form the
// author can pin, version, and diff. An OpenAPI document is routinely generated
// somewhere with no relationship to the project that consumes it — a sibling
// package's output, a shared contract checkout, a CI artifact directory — and
// none of those is reachable through a project-relative path.
//
// A Windows drive prefix is recognized before the URL parse rather than after
// it. `url.Parse` reads the single letter of `C:/api/swagger.json` as a scheme,
// so an absolute Windows path would otherwise be rejected as an unsupported
// protocol — a diagnostic naming the wrong thing entirely. The drive-relative
// form stays refused for the reason `files` refuses it: it resolves against
// whatever directory that drive currently sits on.
func normalizeSwaggerSource(value string) (string, string) {
  if value == "" {
    return "", "Swagger sources must not be empty."
  }
  if strings.TrimSpace(value) != value {
    return "", "Swagger sources must not have leading or trailing whitespace."
  }
  normalized := strings.ReplaceAll(value, "\\", "/")
  drive := hasWindowsDrivePrefix(normalized)
  if drive && !strings.HasPrefix(normalized[2:], "/") {
    return "", "local Swagger path '" + value + "' is drive-relative, so it resolves against whatever directory that drive currently sits on rather than against a stable base. Write the full path."
  }
  parsed, err := url.Parse(value)
  if err != nil {
    return "", "invalid Swagger source '" + value + "': " + err.Error() + "."
  }
  if !drive && parsed.Scheme != "" {
    if parsed.Scheme != "http" && parsed.Scheme != "https" {
      return "", "unsupported URL scheme '" + parsed.Scheme + "'; only http: and https: are supported."
    }
    if parsed.Host == "" {
      return "", "Swagger URL '" + value + "' has no host."
    }
    if parsed.Fragment != "" {
      return "", "Swagger URL '" + value + "' must not contain a fragment."
    }
    return value, ""
  }
  if !drive && strings.Contains(value, "://") {
    return "", "invalid Swagger source URL '" + value + "'."
  }
  // A trailing separator is read before cleaning, because `path.Clean` removes
  // it — after which `docs/` and `docs` are one string and the author who
  // meant a directory gets a missing-file diagnostic instead.
  directory := strings.HasSuffix(normalized, "/")
  // A UNC share is cleaned by hand, because `path.Clean` collapses its leading
  // `//` into one slash and turns a network location into a local one that
  // still reads like what was written.
  if strings.HasPrefix(normalized, "//") {
    normalized = "//" + strings.TrimPrefix(path.Clean(normalized), "/")
  } else {
    normalized = path.Clean(normalized)
  }
  switch {
  case directory,
    normalized == ".",
    normalized == "..",
    normalized == "/",
    strings.HasSuffix(normalized, "/.."),
    len(normalized) == 2 && hasWindowsDrivePrefix(normalized):
    return "", "Swagger source '" + value + "' names a directory rather than a document; a reference owns one exact file."
  }
  return normalized, ""
}

func decodeFiles(raw json.RawMessage, path string) (globSet, []string) {
  if len(bytes.TrimSpace(raw)) == 0 {
    return globSet{}, []string{"Invalid evidence/graph configuration at " + path + ": the required project-relative glob array is missing."}
  }
  var patterns []string
  if err := json.Unmarshal(raw, &patterns); err != nil {
    return globSet{}, []string{"Invalid evidence/graph configuration at " + path + ": expected an array of project-relative glob strings."}
  }
  if len(patterns) == 0 {
    return globSet{}, []string{"Invalid evidence/graph configuration at " + path + ": at least one positive glob is required."}
  }
  globs, err := newGlobSet(patterns)
  if err != nil {
    return globSet{}, []string{"Invalid evidence/graph configuration at " + path + ": " + err.Error()}
  }
  return globs, nil
}

func decodeSymbols(
  raw json.RawMessage,
  kind artifactKind,
  unit bool,
  ruleName string,
  path string,
) (symbolSet, []string) {
  if kind == "" {
    return nil, nil
  }
  values := []string{}
  if len(bytes.TrimSpace(raw)) == 0 {
    switch {
    case kind == artifactMarkdown:
      values = []string{"file", "h1", "h2", "h3", "h4"}
    // A Prisma reference owes coverage per model, not per column. The
    // prior art cites at model granularity for the same reason
    // (`AutoBeDatabase.IModel.evidence`), and defaulting to every member
    // would put `id`, `created_at`, and every back-reference into the
    // denominator — which teaches an author to write filler reasons. A
    // claim keeps every host, because there the selector narrows where a
    // tag may sit rather than what must be covered.
    case kind == artifactPrisma && unit:
      values = []string{"model"}
    case kind == artifactPrisma:
      values = []string{"model", "column", "relation"}
    case kind == artifactTypeScript && unit:
      values = []string{"type"}
    default:
      values = []string{"type", "function", "property"}
    }
  } else {
    trimmed := bytes.TrimSpace(raw)
    switch trimmed[0] {
    case '"':
      var value string
      if err := json.Unmarshal(raw, &value); err != nil {
        return nil, []string{configurationProblem(ruleName, path, "expected a supported symbol string or array.")}
      }
      values = []string{value}
    case '[':
      if err := json.Unmarshal(raw, &values); err != nil {
        return nil, []string{configurationProblem(ruleName, path, "expected a supported symbol string or array.")}
      }
      if len(values) == 0 {
        return nil, []string{configurationProblem(ruleName, path, "an empty symbol array selects no evidence units or declaration hosts.")}
      }
    default:
      return nil, []string{configurationProblem(ruleName, path, "expected a supported symbol string or array.")}
    }
  }
  allowed := map[string]bool{}
  supported := []string{"type", "function", "property"}
  switch kind {
  case artifactMarkdown:
    supported = []string{"file", "h1", "h2", "h3", "h4"}
  case artifactPrisma:
    supported = []string{"model", "column", "relation"}
  }
  for _, symbol := range supported {
    allowed[symbol] = true
  }
  set := symbolSet{}
  problems := []string{}
  for _, value := range values {
    if !allowed[value] {
      problems = append(problems, configurationProblem(ruleName, path, "symbol '"+value+"' is not supported for "+string(kind)+"."))
      continue
    }
    set[value] = true
  }
  return set, problems
}

func decodeObject(raw json.RawMessage, path string) (map[string]json.RawMessage, string) {
  var object map[string]json.RawMessage
  if err := json.Unmarshal(raw, &object); err != nil || object == nil {
    return nil, "Invalid evidence/graph configuration at " + path + ": expected an object."
  }
  return object, ""
}

// configurationProblem opens a configuration diagnostic with the rule that owns
// the setting.
//
// The owning rule is a parameter because two rules share these decoders. A
// message naming a rule the reader did not configure sends them to edit a
// setting that is not wrong, and with several rules enabled it is not even
// obvious which one lied.
func configurationProblem(ruleName string, path string, message string) string {
  return "Invalid " + ruleName + " configuration at " + path + ": " + message
}

func rejectUnknownFields(
  object map[string]json.RawMessage,
  allowed []string,
  ruleName string,
  path string,
) []string {
  known := map[string]bool{}
  for _, name := range allowed {
    known[name] = true
  }
  unknown := []string{}
  for name := range object {
    if !known[name] {
      unknown = append(unknown, name)
    }
  }
  sort.Strings(unknown)
  problems := make([]string, 0, len(unknown))
  for _, name := range unknown {
    if name == "severity" {
      problems = append(problems, configurationProblem(
        ruleName,
        path+".severity",
        "severity belongs only in the outer @ttsc/lint rule setting.",
      ))
      continue
    }
    // The inverted-relation hints below name properties that only ever
    // existed on the graph, so offering them elsewhere would invite a
    // reader to migrate a setting their rule never had.
    if name == "sources" && ruleName == graphRuleName {
      problems = append(problems, configurationProblem(
        ruleName,
        path+".sources",
        "the graph is now declared from the claiming side; declare 'claims', each citing its evidence under 'reference'.",
      ))
      continue
    }
    if name == "citedBy" && ruleName == graphRuleName {
      problems = append(problems, configurationProblem(
        ruleName,
        path+".citedBy",
        "this relation was inverted; declare the evidence this claim cites under 'reference'.",
      ))
      continue
    }
    problems = append(problems, configurationProblem(
      ruleName,
      path+"."+name,
      "unknown property; expected only "+strings.Join(allowed, ", ")+".",
    ))
  }
  return problems
}

func describePatterns(globs globSet) string {
  quoted := make([]string, 0, len(globs.Patterns))
  for _, pattern := range globs.Patterns {
    quoted = append(quoted, "'"+pattern.Raw+"'")
  }
  return "[" + strings.Join(quoted, ", ") + "]"
}

// describePopulation names the patterns a population selects with, and the base
// they were resolved against when that base is not the project root.
//
// The base is stated rather than assumed, because a citation that resolves
// outside the project has to be repairable from the diagnostic alone: patterns
// that look correct against a root the reader is imagining are the failure this
// property introduces, and naming the resolved base is what removes it.
func describePopulation(base populationBase, globs globSet) string {
  if base.Default {
    return describePatterns(globs)
  }
  return describePatterns(globs) + " under root '" + populationRootLabel(base) + "'"
}

func describeReferenceSources(reference referenceSpec) string {
  if reference.Type != artifactSwagger {
    return describePopulation(reference.Base, reference.Files)
  }
  return "'" + displaySwaggerSource(reference.Source) + "'"
}
