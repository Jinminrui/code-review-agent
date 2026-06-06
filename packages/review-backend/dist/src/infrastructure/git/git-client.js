import { execa } from "execa";
import { parseUnifiedDiff } from "./parse-unified-diff.js";
export class GitClient {
    repositoryPath;
    constructor(repositoryPath) {
        this.repositoryPath = repositoryPath;
    }
    getRepositoryPath() {
        return this.repositoryPath;
    }
    async listBranches() {
        const { stdout } = await execa("git", ["branch", "--format=%(refname:short)"], {
            cwd: this.repositoryPath
        });
        return stdout
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
    }
    async readDiff(baseRef, targetRef) {
        const { stdout } = await execa("git", ["diff", "--no-ext-diff", `${baseRef}...${targetRef}`], {
            cwd: this.repositoryPath,
            maxBuffer: 20_000_000
        });
        return parseUnifiedDiff(stdout);
    }
    async readFileAtRef(ref, filePath) {
        const { stdout } = await execa("git", ["show", `${ref}:${filePath}`], {
            cwd: this.repositoryPath
        });
        return stdout;
    }
}
