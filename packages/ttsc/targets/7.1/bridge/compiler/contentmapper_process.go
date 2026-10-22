package compiler

import (
  "errors"
  "io"
  "os/exec"
  "time"
)

// spawnContentMapper starts one content-mapper process, the way the tsc
// command does: command runs in dir, the mapper package's directory, with its
// stderr written to stderr. The returned value reads the process's stdout and
// writes its stdin; Close kills and reaps it. The compiler keeps process
// spawning out of its own packages and leaves it to the host, so ttsc supplies
// the same behavior as tsc's.
func spawnContentMapper(command []string, dir string, stderr io.Writer) (io.ReadWriteCloser, error) {
  if len(command) == 0 {
    return nil, errors.New("content mapper declares no command to run")
  }
  cmd := exec.Command(command[0], command[1:]...)
  cmd.Dir = dir
  cmd.Stderr = stderr
  cmd.WaitDelay = time.Second
  stdin, err := cmd.StdinPipe()
  if err != nil {
    return nil, err
  }
  stdout, err := cmd.StdoutPipe()
  if err != nil {
    return nil, err
  }
  if err := cmd.Start(); err != nil {
    return nil, err
  }
  return &contentMapperProcess{cmd: cmd, stdin: stdin, stdout: stdout}, nil
}

// contentMapperProcess adapts a mapper's stdout (read) and stdin (write) into
// one io.ReadWriteCloser.
type contentMapperProcess struct {
  cmd    *exec.Cmd
  stdin  io.WriteCloser
  stdout io.Reader
}

func (p *contentMapperProcess) Read(b []byte) (int, error)  { return p.stdout.Read(b) }
func (p *contentMapperProcess) Write(b []byte) (int, error) { return p.stdin.Write(b) }

// ExitCode reports the process's exit code once it has been reaped; the
// mapper host reads it to describe a mapper that exited early.
func (p *contentMapperProcess) ExitCode() (int, bool) {
  if p.cmd.ProcessState == nil {
    return 0, false
  }
  return p.cmd.ProcessState.ExitCode(), true
}

// Close kills and reaps the process. Its own exit status is not a close error.
func (p *contentMapperProcess) Close() error {
  _ = p.stdin.Close()
  _ = p.cmd.Process.Kill()
  err := p.cmd.Wait()
  if _, ok := errors.AsType[*exec.ExitError](err); ok {
    return nil
  }
  if errors.Is(err, exec.ErrWaitDelay) {
    return nil
  }
  return err
}
