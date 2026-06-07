import { execa } from "execa";
import { parseUnifiedDiff } from "./parse-unified-diff.js";

export class GitClient {
  constructor(private readonly repositoryPath: string) {}

  getRepositoryPath() {
    return this.repositoryPath;
  }

  async listBranches(): Promise<string[]> {
    const { stdout } = await execa("git", ["branch", "--format=%(refname:short)"], {
      cwd: this.repositoryPath
    });

    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async readDiff(baseRef: string, targetRef: string) {
    const { stdout } = await execa(
      "git",
      ["diff", "--no-ext-diff", `${baseRef}...${targetRef}`],
      {
        cwd: this.repositoryPath,
        maxBuffer: 20_000_000
      }
    );

    return parseUnifiedDiff(stdout);
  }

  async readFileAtRef(ref: string, filePath: string): Promise<string> {
    const { stdout } = await execa("git", ["show", `${ref}:${filePath}`], {
      cwd: this.repositoryPath
    });

    return stdout;
  }

  async readWorkspaceDiff() {
    const { stdout } = await execa(
      "git",
      ["diff", "--no-ext-diff", "HEAD"],
      {
        cwd: this.repositoryPath,
        maxBuffer: 20_000_000
      }
    );

    return parseUnifiedDiff(stdout);
  }
}
