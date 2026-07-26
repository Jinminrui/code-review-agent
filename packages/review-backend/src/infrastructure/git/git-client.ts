import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
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

  async readDiff(baseRef: string, targetRef: string, signal?: AbortSignal) {
    const { stdout } = await execa(
      "git",
      ["diff", "--no-ext-diff", `${baseRef}...${targetRef}`],
      {
        cwd: this.repositoryPath,
        maxBuffer: 20_000_000,
        ...(signal ? { cancelSignal: signal } : {})
      }
    );

    return parseUnifiedDiff(stdout);
  }

  async readFileAtRef(ref: string, filePath: string, signal?: AbortSignal): Promise<string> {
    if (ref === "WORKSPACE") {
      // 工作区读取绕过 git show，但必须校验路径，防止工具调用访问仓库外文件。
      const repositoryRoot = resolve(this.repositoryPath);
      const absolutePath = resolve(repositoryRoot, filePath);
      if (absolutePath !== repositoryRoot && !absolutePath.startsWith(repositoryRoot + sep)) {
        throw new Error(`File path escapes repository: ${filePath}`);
      }
      return readFile(absolutePath, signal ? { encoding: "utf8", signal } : "utf8");
    }

    const { stdout } = await execa("git", ["show", `${ref}:${filePath}`], {
      cwd: this.repositoryPath,
      ...(signal ? { cancelSignal: signal } : {})
    });

    return stdout;
  }

  async readWorkspaceDiff(signal?: AbortSignal) {
    const { stdout } = await execa(
      "git",
      ["diff", "--no-ext-diff", "HEAD"],
      {
        cwd: this.repositoryPath,
        maxBuffer: 20_000_000,
        ...(signal ? { cancelSignal: signal } : {})
      }
    );

    return parseUnifiedDiff(stdout);
  }

  async lsFiles(pattern?: string, signal?: AbortSignal): Promise<string[]> {
    const args = ["ls-files"];
    if (pattern) {
      args.push(pattern);
    }

    const { stdout } = await execa("git", args, {
      cwd: this.repositoryPath,
      ...(signal ? { cancelSignal: signal } : {})
    });

    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async grep(
    pattern: string,
    options?: { regex?: boolean; paths?: readonly string[] },
    signal?: AbortSignal
  ): Promise<string[]> {
    const args = ["grep", "-n", "-H"];
    if (options?.regex) {
      args.push("-E");
    } else {
      args.push("-F");
    }
    args.push("--", pattern);
    if (options?.paths && options.paths.length > 0) {
      args.push(...options.paths.map((path) => `:(literal)${path}`));
    }

    try {
      const { stdout } = await execa("git", args, {
        cwd: this.repositoryPath,
        ...(signal ? { cancelSignal: signal } : {})
      });

      return stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (error) {
      // git grep exits with code 1 when no matches found
      if ((error as { exitCode?: number }).exitCode === 1) {
        return [];
      }
      throw error;
    }
  }
}
