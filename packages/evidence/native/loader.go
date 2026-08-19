package evidence

import (
  "encoding/json"
  "io/fs"
  "os"
  "path"
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// typeScriptLoader materializes TypeScript inventories for a reference
// population, from the Program where possible and from disk where necessary.
//
// Disk parsing is not an optimization detail, it is the requirement. A package
// symbol that nothing imports is absent from the Program by definition, and
// that symbol is precisely the one an obligation needs to name — an evidence
// graph exists to report the operation the frontend never called.
type typeScriptLoader struct {
  root     string
  program  map[string]*artifactInventory
  parsed   map[string]*artifactInventory
  resolved map[string]string
  failures map[string]string
  installs map[string]installedPackageLocation
}

func newTypeScriptLoader(
  root string,
  program map[string]*artifactInventory,
) *typeScriptLoader {
  loader := &typeScriptLoader{
    root:     strings.ReplaceAll(root, "\\", "/"),
    program:  map[string]*artifactInventory{},
    parsed:   map[string]*artifactInventory{},
    resolved: map[string]string{},
    failures: map[string]string{},
    installs: map[string]installedPackageLocation{},
  }
  for _, inventory := range program {
    if inventory == nil || inventory.Path == "" {
      continue
    }
    location := loader.projectPath(inventory.Path)
    current := loader.program[location]
    if current == nil ||
      current.Address != current.Path && inventory.Address == inventory.Path {
      loader.program[location] = inventory
    }
  }
  return loader
}

// inventory returns the scanned form of a project-relative TypeScript file.
//
// The Program's copy wins when it exists so that a file under edit is read as
// the editor has it, not as the disk last saw it.
func (loader *typeScriptLoader) inventory(relative string) *artifactInventory {
  if relative == "" {
    return nil
  }
  relative = loader.projectPath(relative)
  if inventory := loader.program[relative]; inventory != nil {
    return inventory
  }
  if inventory, cached := loader.parsed[relative]; cached {
    return inventory
  }
  loader.parsed[relative] = loader.parse(relative)
  return loader.parsed[relative]
}

func (loader *typeScriptLoader) parse(relative string) *artifactInventory {
  relative = loader.projectPath(relative)
  content, err := os.ReadFile(path.Join(loader.root, relative))
  if err != nil {
    loader.failures[relative] = err.Error()
    return nil
  }
  kind := shimcore.ScriptKindTS
  if strings.HasSuffix(strings.ToLower(relative), ".tsx") {
    kind = shimcore.ScriptKindTSX
  }
  file := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{
      FileName: path.Join(loader.root, relative),
    },
    string(content),
    kind,
  )
  if file == nil {
    loader.failures[relative] = "the TypeScript parser returned no source file"
    return nil
  }
  return scanTypeScriptInventory(relative, file)
}

func (loader *typeScriptLoader) failure(relative string) string {
  if loader == nil {
    return ""
  }
  return loader.failures[relative]
}

// exists reports whether a project-relative TypeScript file can be read at all,
// without paying to scan it.
func (loader *typeScriptLoader) exists(relative string) bool {
  relative = loader.projectPath(relative)
  if loader.program[relative] != nil {
    return true
  }
  return loader.existsOnDisk(relative)
}

// existsOnDisk probes the filesystem for an already-normalized path.
//
// The probe is the expensive half of module resolution — one syscall per
// candidate, and a watch cycle resolves every re-export in the population — so
// callers that can answer from the Program should do that first.
func (loader *typeScriptLoader) existsOnDisk(relative string) bool {
  info, err := os.Stat(path.Join(loader.root, relative))
  return err == nil && !info.IsDir()
}

// resolve maps a module specifier written in one file to a project-relative
// path, trying the same candidates TypeScript would.
func (loader *typeScriptLoader) resolve(from string, specifier string) string {
  key := from + "\x00" + specifier
  if cached, exists := loader.resolved[key]; exists {
    return cached
  }
  loader.resolved[key] = loader.resolveUncached(from, specifier)
  return loader.resolved[key]
}

func (loader *typeScriptLoader) resolveUncached(
  from string,
  specifier string,
) string {
  if strings.HasPrefix(specifier, "./") || strings.HasPrefix(specifier, "../") {
    base := path.Clean(path.Join(path.Dir(from), specifier))
    candidates := moduleCandidates(base)
    normalized := make([]string, 0, len(candidates))
    for _, candidate := range candidates {
      normalized = append(normalized, loader.projectPath(candidate))
    }
    // The Program answers first, and not only because it answers without a
    // syscall. A project that emits beside its sources has both `x.js` and
    // `x.ts` on disk, and `x.js` is written earlier in the candidate order;
    // resolving an import to emitted JavaScript would read a module whose
    // declarations the graph cannot address.
    for _, candidate := range normalized {
      if loader.program[candidate] != nil {
        return candidate
      }
    }
    for _, candidate := range normalized {
      if loader.existsOnDisk(candidate) {
        return candidate
      }
    }
    return ""
  }
  if strings.HasPrefix(specifier, "/") {
    return ""
  }
  return loader.resolvePackage(specifier)
}

// projectPath gives every Program source and module candidate one identity
// relative to the ttsc project. A rooted claim may name the same physical file
// through `../api`, while an import can arrive there through a different
// sequence of sibling segments; resolving both through the project root keeps
// Windows and POSIX separators from creating distinct module identities.
func (loader *typeScriptLoader) projectPath(relative string) string {
  if loader == nil || relative == "" {
    return relative
  }
  // A path that is already a clean, forward-slashed, project-relative name is
  // its own identity. Saying so here matters: module resolution normalizes
  // every candidate of every specifier, and the general form below walks the
  // path twice through the filesystem package to learn nothing.
  if isCleanProjectRelativePath(relative) {
    return relative
  }
  local := filepath.FromSlash(relative)
  absolute := local
  if !filepath.IsAbs(local) {
    absolute = filepath.Join(filepath.FromSlash(loader.root), local)
  }
  projectRelative, err := filepath.Rel(
    filepath.FromSlash(loader.root),
    filepath.Clean(absolute),
  )
  if err != nil {
    return filepath.ToSlash(filepath.Clean(absolute))
  }
  return strings.TrimPrefix(filepath.ToSlash(projectRelative), "./")
}

// isCleanProjectRelativePath reports whether a path is already the identity
// `projectPath` would produce: forward slashes, no drive or leading separator,
// and no `.` or `..` segment to collapse.
func isCleanProjectRelativePath(value string) bool {
  if value == "" || strings.ContainsRune(value, '\\') {
    return false
  }
  if strings.HasPrefix(value, "/") || filepath.IsAbs(value) {
    return false
  }
  for segment := range strings.SplitSeq(value, "/") {
    if segment == "" || segment == "." || segment == ".." {
      return false
    }
  }
  return true
}

// resolvePackage finds the declaration entry of an installed package.
//
// The entry comes from the `types` condition of an `exports` map, then
// `typesVersions`, then `types` or `typings`. A package that emits JavaScript
// stops there, because its runtime entry names the emit rather than the
// declarations a citation addresses.
//
// A source-first workspace package is followed one step further: when its
// `exports` target or `main` names TypeScript itself, that file is both the
// entry a consumer imports and the declarations, so it is the entry. This is
// the ordinary shape in a pnpm TypeScript monorepo, where the dependency is a
// link to a package that has no emit to point at.
func (loader *typeScriptLoader) resolvePackage(specifier string) string {
  name, subpath := splitPackageSpecifier(specifier)
  if name == "" {
    return ""
  }
  directory, manifest := loader.installedPackage(name)
  entry := packageTypeEntry(manifest, subpath)
  if entry == "" {
    if subpath == "" {
      return ""
    }
    entry = subpath
  }
  for _, candidate := range moduleCandidates(path.Join(directory, entry)) {
    if loader.exists(candidate) {
      return candidate
    }
  }
  return ""
}

// packageEntryModule resolves the declaration entry a package reference starts
// its traversal from.
func (loader *typeScriptLoader) packageEntryModule(name string) string {
  return loader.resolvePackage(name)
}

// installedPackage finds where a package is installed, and its manifest.
//
// Resolution walks up from the project root the way Node's own does, because a
// nested Program does not have its own install. `packages/backend/test` is its
// own ttsc project — `test/tsconfig.json` compiles the tests together with the
// backend source — but the package manager installed into
// `packages/backend/node_modules`, one level above. Looking only beside the
// project root leaves that Program unable to see a dependency it imports, and a
// package reference that cannot read a manifest resolves no entry, which
// publishes its units under the module that matched instead of under the
// specifier a citation can spell.
//
// The walk stops at the filesystem root. A directory that holds no
// `node_modules` for this name simply is not the install, so the loop asks the
// parent rather than concluding the package is absent.
func (loader *typeScriptLoader) installedPackage(
  name string,
) (string, map[string]json.RawMessage) {
  if cached, exists := loader.installs[name]; exists {
    return cached.Directory, cached.Manifest
  }
  directory, manifest := loader.locateInstalledPackage(name)
  loader.installs[name] = installedPackageLocation{
    Directory: directory,
    Manifest:  manifest,
  }
  return directory, manifest
}

// installedPackageLocation caches one upward search. The walk costs a read per
// level, and both the glob base and the entry ask for the same package on every
// rebuild.
type installedPackageLocation struct {
  Directory string
  Manifest  map[string]json.RawMessage
}

func (loader *typeScriptLoader) locateInstalledPackage(
  name string,
) (string, map[string]json.RawMessage) {
  prefix := ""
  for range 32 {
    directory := path.Join(prefix, "node_modules", name)
    manifest := readPackageManifest(
      loader.root,
      path.Join(directory, "package.json"),
    )
    if manifest != nil {
      return directory, manifest
    }
    prefix = path.Join(prefix, "..")
  }
  return path.Join("node_modules", name), nil
}

// resolveLinkedDirectory returns the directory a path ultimately names, and
// reports whether the chain ended inside the hops this rule follows.
//
// `filepath.EvalSymlinks` answers this for a POSIX symlink but not for a
// Windows junction, which is exactly what pnpm creates for a workspace
// dependency there: it returns the junction unchanged, so a caller that trusts
// it walks the link and finds nothing. `os.Readlink` does report a junction's
// target, and `os.Stat` sees through both, so ask those instead.
//
// The second answer is what separates an exhausted chain from a resolved
// directory, which are one string without it: a caller comparing paths against
// a link that still names another link cannot tell that it holds one, and that
// is how the leaf case of #1269 stayed silent until the caller was told.
//
// The bound counts links followed, not answers given. A chain that ends exactly
// on the last hop this rule follows has landed on its directory with no
// iteration left to look, and it is a chain the filesystem resolves: Linux and
// Windows follow further, and Darwin stops at this same number, so the boundary
// sits where the strictest platform's does rather than inside it. So the answer
// costs one `os.Lstat` in that case and nothing at all in every other, since
// every earlier ending is a return from inside the loop. Refusing it instead
// would turn a root that works into an error at the boundary, which is what
// this rule exists to keep from happening in the other direction.
func resolveLinkedDirectory(directory string) (string, bool) {
  current := directory
  for range 32 {
    info, err := os.Lstat(current)
    if err != nil || info.IsDir() {
      return current, true
    }
    if target, err := os.Stat(current); err != nil || !target.IsDir() {
      return current, true
    }
    linked, err := os.Readlink(current)
    if err != nil {
      return current, true
    }
    if !filepath.IsAbs(linked) {
      linked = filepath.Join(filepath.Dir(current), linked)
    }
    current = filepath.ToSlash(linked)
  }
  info, err := os.Lstat(current)
  return current, err == nil && info.IsDir()
}

// walk lists the project-relative TypeScript files below a directory.
//
// A package's files are enumerated from disk for the same reason its entry is
// parsed from disk: the ones an obligation most needs to name are precisely the
// ones nothing imported, so the Program cannot be the source of truth.
func (loader *typeScriptLoader) walk(base string) ([]string, string) {
  root := path.Join(loader.root, base)
  // A workspace dependency is a link, not a directory: pnpm installs one that
  // way on every platform, and npm and Yarn do the same for a linked package.
  // `filepath.WalkDir` reports a link as a plain entry and descends into
  // nothing, so walking the spelled path finds no files and the reference
  // looks empty rather than unresolvable. Walk what the link points at, and
  // report the files under the spelled path so addresses stay stable.
  // The bound is not refused here. A package whose chain outruns the resolver
  // walks a link and matches nothing, and the caller already reports that as
  // an empty population rather than passing over it in silence — so what is
  // owed there is a better cause, not a diagnostic that does not exist. A
  // declared base has no such report behind it, which is why
  // `resolvedBaseDirectory` does refuse.
  walked, _ := resolveLinkedDirectory(root)
  found := []string{}
  problem := ""
  err := filepath.WalkDir(walked, func(current string, entry fs.DirEntry, err error) error {
    if walked != root {
      if inside, ok := containedProjectPath(walked, filepath.ToSlash(current)); ok {
        current = path.Join(root, inside)
      } else if filepath.ToSlash(current) == walked {
        current = root
      }
    }
    if err != nil {
      if problem == "" {
        problem = err.Error()
      }
      if entry != nil && entry.IsDir() {
        return filepath.SkipDir
      }
      return nil
    }
    if entry.IsDir() {
      if entry.Name() == "node_modules" && filepath.ToSlash(current) != root {
        return filepath.SkipDir
      }
      return nil
    }
    relative, ok := relativeProjectPath(loader.root, filepath.ToSlash(current))
    if !ok {
      // An install can sit above the project: a nested Program resolves its
      // dependencies out of an ancestor's `node_modules`. Name such a file
      // through the project the same way a rooted population above the
      // project is named, rather than dropping it and reporting the package
      // as empty.
      relative = loader.projectPath(filepath.ToSlash(current))
    }
    if relative == "" || !isTypeScriptPath(relative) {
      return nil
    }
    found = append(found, relative)
    return nil
  })
  if err != nil && problem == "" {
    problem = err.Error()
  }
  sort.Strings(found)
  return found, problem
}

// referenceBase gives the directory a package reference enumerates.
//
// It asks the loader rather than assuming `node_modules` sits beside the
// project root, so the walk and the entry agree on where the package is. A
// nested Program is installed into an ancestor's `node_modules`, and a walk
// that looked only beside its own root would enumerate nothing while the entry
// resolved fine.
func referenceBase(loader *typeScriptLoader, reference referenceSpec) string {
  if reference.Package == "" {
    return ""
  }
  if loader == nil {
    return path.Join("node_modules", reference.Package)
  }
  directory, _ := loader.installedPackage(reference.Package)
  return directory
}
