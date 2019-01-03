import * as fs from 'fs';
import * as path from 'path';
import { EXTENSION_NAME } from './extension';
import { window, TreeItemCollapsibleState, TreeDataProvider, EventEmitter, Event, TreeItem, Command, workspace } from 'vscode';
import * as JSON5 from 'json5';
import { ISnippetFile, SnippetFileExtensions } from './types';

export class SnippetProvider implements TreeDataProvider<Snippet> {

	private _onDidChangeTreeData: EventEmitter<Snippet | undefined> = new EventEmitter<Snippet | undefined>();
	readonly onDidChangeTreeData: Event<Snippet | undefined> = this._onDidChangeTreeData.event;

	constructor(private SnippetsDirPath: string) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Snippet): TreeItem {
		return element;
	}

	getChildren(element?: Snippet): Promise<Snippet[]> {
		if (element) {
			return new Promise((resolve, reject) => {
				const absolutePath = element.absolutePath;
				if (!absolutePath) {
					return reject([]);
				}

				fs.readFile(absolutePath, 'utf8', (err, contents) => {
					if (err) {
						window.showErrorMessage('Error reading file ' + absolutePath + '\n' + err.message);
						return reject([]);
					}

					if (contents === '') {
						return resolve([]);
					}

					let parsedSnippets: ISnippetFile;
					try {
						parsedSnippets = JSON5.parse(contents);
					} catch (err) {
						window.showErrorMessage(`JSON parsing of snippet file ${element.absolutePath} failed`);
						return reject([]);
					}

					const snippets = [];
					for (const key in parsedSnippets) {
						const parsed = parsedSnippets[key];
						snippets.push(new Snippet(key, parsed.scope || '', TreeItemCollapsibleState.None, undefined, {
							command: EXTENSION_NAME + '.insertSnippet',
							title: 'Insert Snippet',
							arguments: [parsed.body]
						}));
					}
					return resolve(snippets);
				});
			});
		} else {
			return new Promise(async (resolve, reject) => {
				const workspaceFolders = workspace.workspaceFolders;
				let projectLevelSnippets: Snippet[] = [];
				if (workspaceFolders) {
					// @ts-ignore
					projectLevelSnippets = [].concat.apply([], await Promise.all(workspaceFolders.map(async (folder) => {
						return this.getSnippetFilesFromDirectory(path.join(folder.uri.fsPath, '.vscode'), [SnippetFileExtensions.codeSnippets]);
					})));
				}

				const globalLevelSnippets: Snippet[] = await this.getSnippetFilesFromDirectory(this.SnippetsDirPath, [SnippetFileExtensions.json, SnippetFileExtensions.codeSnippets]);

				return resolve(projectLevelSnippets.concat(globalLevelSnippets));
			});
		}
	}

	private getSnippetFilesFromDirectory(absoluteDirPath: string, includeExtensions: Array<SnippetFileExtensions>): Promise<Snippet[]> {
		return new Promise((resolve, reject) => {
			fs.readdir(absoluteDirPath, (err, files) => {
				if (err) {
					window.showErrorMessage('Error reading directory ' + absoluteDirPath + '\n' + err.message);
					return reject([]);
				}

				const snippets: Array<Snippet> = [];
				files.forEach(file => {
					const extname = path.extname(file);
					const filename = path.parse(file).name;
					const absolutePath = path.join(absoluteDirPath, file);
					if (includeExtensions.indexOf(extname as SnippetFileExtensions) !== -1) {
						snippets.push(new Snippet(filename, '', TreeItemCollapsibleState.Expanded, absolutePath));
					}
				});
				return resolve(snippets);
			});
		});
	}
}

export class Snippet extends TreeItem {

	constructor(
		public readonly label: string,
		private scope: string,
		public readonly collapsibleState: TreeItemCollapsibleState,
		public absolutePath?: string,
		public readonly command?: Command
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return this.scope;
	}

	get description(): string | undefined {
		if (typeof this.scope === 'string') {
			return this.scope;
		}
	}

	contextValue = 'snippet';
}
