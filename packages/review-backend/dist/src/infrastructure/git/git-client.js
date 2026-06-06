export class GitClient {
    repositoryPath;
    constructor(repositoryPath) {
        this.repositoryPath = repositoryPath;
    }
    getRepositoryPath() {
        return this.repositoryPath;
    }
}
