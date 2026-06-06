export class GitClient {
  constructor(private readonly repositoryPath: string) {}

  getRepositoryPath() {
    return this.repositoryPath;
  }
}
