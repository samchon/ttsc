package linthost

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

// projectInputReader records only contributor operations actually performed in
// one loaded Program cycle. Raw bytes stay independent of decoded compiler
// text. Unsupported native link predicates withdraw completeness; they never
// become guessed file content or an assumed successful enumeration.
type projectInputReader struct {
	compiler        *inputObservationFS
	mu              sync.Mutex
	inputs          map[string]*string
	realpaths       map[string]*string
	nativeInputs    map[string]nativeInputPredicate
	directoryInputs map[string]nativeInputPredicate
	incomplete      bool
}

// newProjectInputReader starts empty raw-byte and native-entry maps for one
// compiler observer. It neither shares prior generations nor acquires handles.
func newProjectInputReader(compiler *inputObservationFS) *projectInputReader {
	return &projectInputReader{compiler: compiler, inputs: map[string]*string{}, realpaths: map[string]*string{}, nativeInputs: map[string]nativeInputPredicate{}, directoryInputs: map[string]nativeInputPredicate{}}
}

// Unavailable is a locked, sticky withdrawal; no successful later read resets it.
func (r *projectInputReader) Unavailable() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.incomplete = true
}

// record preserves the OS call's absolute address and compares both digest and
// physical identity with a prior witness. Equal bytes on a retargeted path do
// not restore authority; retained records grow only with consumed addresses.
func (r *projectInputReader) record(name string, digest *string, physical *string) {
	absolute, err := filepath.Abs(name)
	if err != nil {
		r.Unavailable()
		return
	}
	name = filepath.Clean(absolute)
	r.mu.Lock()
	defer r.mu.Unlock()
	prior, seen := r.inputs[name]
	if seen && (!equalObservedString(prior, digest) || !equalObservedString(r.realpaths[name], physical)) {
		r.incomplete = true
	}
	r.inputs[name] = digest
	r.realpaths[name] = physical
}

// equalObservedString distinguishes absent identity/content from present empty
// text; nonnil equality compares values rather than pointer allocation.
func equalObservedString(a, b *string) bool {
	return a == nil && b == nil || a != nil && b != nil && *a == *b
}

// ReadFile owns and closes one descriptor, hashing its returned raw bytes only
// after descriptor/path metadata and physical spelling checks. Those checks
// detect sampled changes; they do not prove every possible filesystem ABA.
// Query/read/close failures withdraw authority without rereading for proof.
func (r *projectInputReader) ReadFile(name string) ([]byte, error) {
	file, err := os.Open(name)
	if err != nil {
		if os.IsNotExist(err) {
			r.record(name, nil, nil)
		} else {
			r.Unavailable()
		}
		return nil, err
	}
	before, beforeErr := file.Stat()
	selectedBefore, selectedBeforeErr := os.Stat(name)
	physicalBefore, physicalBeforeErr := filepath.EvalSymlinks(absoluteInputName(name))
	content, readErr := io.ReadAll(file)
	after, afterErr := file.Stat()
	closeErr := file.Close()
	selected, selectedErr := os.Stat(name)
	physical, physicalErr := filepath.EvalSymlinks(absoluteInputName(name))
	stable := beforeErr == nil && afterErr == nil && selectedBeforeErr == nil && selectedErr == nil &&
		physicalBeforeErr == nil && physicalErr == nil && physicalBefore == physical &&
		os.SameFile(before, selectedBefore) && os.SameFile(before, after) && os.SameFile(after, selected) &&
		before.Mode() == after.Mode() && before.Size() == after.Size() && before.ModTime().Equal(after.ModTime())
	if readErr != nil || closeErr != nil || !stable {
		r.Unavailable()
		return content, errors.Join(readErr, closeErr)
	}
	hash := sha256.Sum256(content)
	digest := hex.EncodeToString(hash[:])
	r.record(name, &digest, &physical)
	return content, readErr
}

// Stat records native target kind and resolved spelling beside its actual
// result. Nonregular unsupported kinds and non-absence errors withdraw proof.
func (r *projectInputReader) Stat(name string) (os.FileInfo, error) {
	info, err := os.Stat(name)
	if err != nil {
		if os.IsNotExist(err) {
			r.observe(name, observedInput{proof: transformInputObservation{Stat: stringPointer("missing")}})
		} else {
			r.Unavailable()
		}
		return info, err
	}
	kind := "file"
	if info.IsDir() {
		kind = "directory"
	} else if !info.Mode().IsRegular() {
		r.Unavailable()
	}
	physical, physicalErr := filepath.EvalSymlinks(absoluteInputName(name))
	if physicalErr != nil {
		r.Unavailable()
		return info, err
	}
	r.observe(name, observedInput{proof: transformInputObservation{Stat: &kind, Realpath: &transformInputRealpathObservation{OK: true, Path: filepath.Clean(physical)}}})
	return info, err
}

// Lstat preserves entry metadata; a link entry cannot be represented by the
// compiler's target-kind predicate, so it returns normally but withdraws proof.
func (r *projectInputReader) Lstat(name string) (os.FileInfo, error) {
	info, err := os.Lstat(name)
	if err != nil {
		if os.IsNotExist(err) {
			r.observe(name, observedInput{proof: transformInputObservation{Stat: stringPointer("missing")}})
		} else {
			r.Unavailable()
		}
		return info, err
	}
	// A symlink's own metadata has no representation in the compiler protocol.
	// Preserve its native answer while declining reusable proof for this cycle.
	if info.Mode()&os.ModeSymlink != 0 {
		r.Unavailable()
		return info, err
	}
	kind := "file"
	if info.IsDir() {
		kind = "directory"
	} else if !info.Mode().IsRegular() {
		r.Unavailable()
	}
	physical, physicalErr := filepath.EvalSymlinks(absoluteInputName(name))
	if physicalErr != nil {
		r.Unavailable()
		return info, err
	}
	r.observe(name, observedInput{proof: transformInputObservation{Stat: &kind, Realpath: &transformInputRealpathObservation{OK: true, Path: filepath.Clean(physical)}}})
	return info, err
}

// stringPointer preserves a present string predicate independently of absence.
func stringPointer(value string) *string { return &value }

// ReadDir returns the native caller's listing unchanged, but does not label it
// as compiler GetAccessibleEntries: native links and special entries have
// different selection semantics. Its native directory predicate retains names,
// kinds and link bytes in the same versioned encoding as executable config
// membership. Metadata and physical spelling bracket the actual listing and
// supplemental entry/link reads; any unexplained error withdraws this cycle.
// No child content is read and no I/O occurs while the record lock is held.
func (r *projectInputReader) ReadDir(name string) ([]os.DirEntry, error) {
	before, beforeErr := os.Stat(name)
	physicalBefore, physicalBeforeErr := filepath.EvalSymlinks(absoluteInputName(name))
	entries, err := os.ReadDir(name)
	if err != nil {
		r.Unavailable()
		return entries, err
	}
	records := make([][]byte, 0, len(entries))
	complete := beforeErr == nil && physicalBeforeErr == nil
	for _, entry := range entries {
		info, infoErr := entry.Info()
		if infoErr != nil {
			complete = false
			continue
		}
		kind, target := "other", ""
		entryPath := filepath.Join(name, entry.Name())
		if link, linkErr := os.Readlink(entryPath); linkErr == nil {
			// Readlink recognizes junctions whose Go FileMode lacks ModeSymlink.
			kind, target = "symlink", link
		} else if info.Mode()&os.ModeSymlink != 0 {
			// A consumed link whose target bytes cannot be observed has no proof.
			complete = false
		} else if info.IsDir() {
			kind = "directory"
		} else if info.Mode().IsRegular() {
			kind = "file"
		}
		records = append(records, []byte(entry.Name()+"\x00"+kind+"\x00"+target))
	}
	after, afterErr := os.Stat(name)
	physicalAfter, physicalAfterErr := filepath.EvalSymlinks(absoluteInputName(name))
	complete = complete && afterErr == nil && physicalAfterErr == nil
	if complete {
		complete = os.SameFile(before, after) && before.Mode() == after.Mode() && before.Size() == after.Size() && before.ModTime().Equal(after.ModTime()) && filepath.Clean(physicalBefore) == filepath.Clean(physicalAfter)
	}
	if !complete {
		r.Unavailable()
		return entries, err
	}
	sort.Slice(records, func(i, j int) bool { return bytes.Compare(records[i], records[j]) < 0 })
	sum := sha256.Sum256(bytes.Join(records, []byte{0}))
	physical := filepath.Clean(physicalAfter)
	predicate := nativeInputPredicate{Version: 1, Kind: "directory", Digest: hex.EncodeToString(sum[:]), IdentityStable: true, Realpath: &physical, Scope: "cache"}
	key := filepath.Clean(absoluteInputName(name))
	r.mu.Lock()
	if prior, exists := r.directoryInputs[key]; exists && (prior.Digest != predicate.Digest || !equalObservedString(prior.Realpath, predicate.Realpath)) {
		r.incomplete = true
	}
	r.directoryInputs[key] = predicate
	r.mu.Unlock()
	return entries, err
}

// Readlink records the selected entry's kind or link bytes alongside its native
// answer. A changed entry or unexplained failure withdraws the whole generation.
func (r *projectInputReader) Readlink(name string) (string, error) {
	before, beforeErr := os.Lstat(name)
	target, err := os.Readlink(name)
	after, afterErr := os.Lstat(name)
	physical, physicalErr := filepath.EvalSymlinks(absoluteInputName(name))
	stable := beforeErr == nil && afterErr == nil && os.SameFile(before, after) && before.Mode() == after.Mode() && before.Size() == after.Size() && before.ModTime().Equal(after.ModTime())
	encoded := ""
	if stable {
		if err == nil {
			encoded = "symlink\x00" + target
		} else if before.Mode()&os.ModeSymlink == 0 {
			kind := "other"
			if before.IsDir() {
				kind = "directory"
			} else if before.Mode().IsRegular() {
				kind = "file"
			}
			encoded = kind + "\x00"
		} else {
			stable = false
		}
	} else if os.IsNotExist(beforeErr) && os.IsNotExist(afterErr) && os.IsNotExist(err) {
		stable = true
		encoded = "missing\x00"
	}
	var realpath *string
	if physicalErr == nil {
		realpath = &physical
	} else if !os.IsNotExist(physicalErr) {
		stable = false
	}
	if !stable {
		r.Unavailable()
		return target, err
	}
	sum := sha256.Sum256([]byte(encoded))
	predicate := nativeInputPredicate{Version: 1, Kind: "entry", Digest: hex.EncodeToString(sum[:]), IdentityStable: true, Realpath: realpath, Scope: "cache"}
	r.mu.Lock()
	key := filepath.Clean(absoluteInputName(name))
	if !filepath.IsAbs(key) {
		r.incomplete = true
	}
	if prior, exists := r.nativeInputs[key]; exists && (prior.Digest != predicate.Digest || !equalObservedString(prior.Realpath, predicate.Realpath)) {
		r.incomplete = true
	}
	r.nativeInputs[key] = predicate
	r.mu.Unlock()
	return target, err
}

// EvalSymlinks returns the caller's native result spelling while recording an
// absolute coordinate; an unresolved native path never becomes a proof.
func (r *projectInputReader) EvalSymlinks(name string) (string, error) {
	physical, err := filepath.EvalSymlinks(name)
	if err != nil {
		r.Unavailable()
		return physical, err
	}
	r.observe(name, observedInput{proof: transformInputObservation{Realpath: &transformInputRealpathObservation{OK: true, Path: filepath.Clean(absoluteInputName(physical))}}})
	return physical, err
}

// WalkDir mirrors filepath.WalkDir using this reader's actual Lstat and ReadDir
// results. It does not enumerate a skipped directory or follow a linked entry.
func (r *projectInputReader) WalkDir(root string, visit fs.WalkDirFunc) error {
	info, err := r.Lstat(root)
	if err != nil {
		err = visit(root, nil, err)
	} else {
		err = r.walk(root, fs.FileInfoToDirEntry(info), visit)
	}
	if err == fs.SkipDir || err == fs.SkipAll {
		return nil
	}
	return err
}

// walk visits before listing a directory, so SkipDir prevents observing its
// children. Recursive frames follow selected depth; native sorted listings
// preserve WalkDir order, and callbacks retain error/SkipAll control.
func (r *projectInputReader) walk(name string, entry fs.DirEntry, visit fs.WalkDirFunc) error {
	if err := visit(name, entry, nil); err != nil || !entry.IsDir() {
		if err == fs.SkipDir && entry.IsDir() {
			return nil
		}
		return err
	}
	children, err := r.ReadDir(name)
	if err != nil {
		if err = visit(name, entry, err); err != nil {
			if err == fs.SkipDir {
				return nil
			}
			return err
		}
	}
	for _, child := range children {
		if err := r.walk(filepath.Join(name, child.Name()), child, visit); err != nil {
			if err == fs.SkipDir {
				break
			}
			return err
		}
	}
	return nil
}

// absoluteInputName records the same address the OS call resolved against its
// current working directory; it does not reinterpret a contributor path as
// project-root-relative or change that call's native result/error spelling.
func absoluteInputName(name string) string {
	absolute, err := filepath.Abs(name)
	if err != nil {
		return name
	}
	return absolute
}

// observe records a native predicate only with an absolute call address.
func (r *projectInputReader) observe(name string, value observedInput) {
	absolute, err := filepath.Abs(name)
	if err != nil {
		r.Unavailable()
		return
	}
	r.compiler.observe(absolute, value)
}
