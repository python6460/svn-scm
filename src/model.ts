import { workspace, Uri, window } from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Repository } from "./repository";
import { Svn } from "./svn";

interface OpenRepository {
  repository: Repository;
}

export class Model {
  public openRepositories: OpenRepository[] = [];

  get repositories(): Repository[] {
    return this.openRepositories.map(r => r.repository);
  }

  constructor(private svn: Svn) {
    this.scanWorkspaceFolders();
  }

  private async scanWorkspaceFolders() {
    for (const folder of workspace.workspaceFolders || []) {
      const root = folder.uri.fsPath;
      this.tryOpenRepository(root);
    }
  }

  async tryOpenRepository(path: string): Promise<void> {
    if (this.getRepository(path)) {
      return;
    }

    try {
      const repositoryRoot = await this.svn.getRepositoryRoot(path);

      if (this.getRepository(repositoryRoot)) {
        return;
      }

      const repository = new Repository(this.svn.open(repositoryRoot, path));

      this.open(repository);
    } catch (err) {
      console.error(err);
      return;
    }
  }

  getRepository(hint: any) {
    const liveRepository = this.getOpenRepository(hint);
    return liveRepository && liveRepository.repository;
  }

  getOpenRepository(hint: any) {
    if (!hint) {
      return undefined;
    }

    if (hint instanceof Repository) {
      return this.openRepositories.filter(r => r.repository === hint)[0];
    }

    hint = Uri.file(hint);

    for (const liveRepository of this.openRepositories) {
      const relativePath = path.relative(
        liveRepository.repository.root,
        hint.fsPath
      );

      if (!/^\.\./.test(relativePath)) {
        return liveRepository;
      }

      return undefined;
    }
  }

  private open(repository: Repository): void {
    this.openRepositories.push({ repository });
  }

  async pickRepository() {
    if (this.openRepositories.length === 0) {
      throw new Error("There are no available repositories");
    }

    const picks: any[] = this.openRepositories.map(repository => {
      return {
        label: path.basename(repository.repository.root),
        repository: repository
      };
    });
    const placeHolder = "Choose a repository";
    const pick = await window.showQuickPick(picks, { placeHolder });

    return pick && pick.repository;
  }

  dispose(): void {}
}
