
import child from "child_process";
child.exec("ls");
// expect: security/detect-child-process error
child.exec(command);
