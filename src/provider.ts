import * as fs from 'fs';
import * as JSON5 from 'json5';
import * as path from 'path';
import { Command, Event, EventEmitter, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';

import { EXTENSION_NAME } from './extension';
import { IConfig, ISnippetFile, SnippetFileExtensions } from './types';

export class SnippetProvider implements TreeDataProvider<Snippet | SnippetFile> {

	private _onDidChangeTreeData: EventEmitter<Snippet | undefined> = new EventEmitter<Snippet | undefined>();
	readonly onDidChangeTreeData: Event<Snippet | undefined> = this._onDidChangeTreeData.event;

	constructor(
		private readonly snippetsDirPath: string,
		private config: IConfig,
	) { }

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	updateConfig(newConfig: IConfig): void {
		this.config = newConfig;
	}

	getTreeItem(element: Snippet | SnippetFile): TreeItem {
		return element;
	}

	getChildren(element?: SnippetFile): Promise<Snippet[] | SnippetFile[]> {
		if (element) {
			return this.getSnippetFileContents(element.absolutePath);
		} else {
			if (this.config.flatten) {
				return new Promise(async (resolve, reject) => {
					const snippetFiles = await this.getAllSnippetFiles();
					// @ts-ignore
					const snippets = [].concat.apply([], await Promise.all(snippetFiles.map(async file => {
						return this.getSnippetFileContents(file.absolutePath);
					})));
					return resolve(snippets);
				});
			} else {
				return this.getAllSnippetFiles();
			}
		}
	}

	private getSnippetFilesFromDirectory(absoluteDirPath: string, includeExtensions: SnippetFileExtensions[]): Promise<SnippetFile[]> {
		return new Promise((resolve, reject) => {
			fs.readdir(absoluteDirPath, (err, files) => {
				if (err) {
					window.showErrorMessage(`Error reading directory ${absoluteDirPath} \n ${err.message}`);
					return reject([]);
				}

				const snippets: SnippetFile[] = [];
				files.forEach(file => {
					const extname = path.extname(file);
					const filename = path.parse(file).name;
					const absolutePath = path.join(absoluteDirPath, file);
					if (includeExtensions.indexOf(extname as SnippetFileExtensions) !== -1) {
						snippets.push(new SnippetFile(filename, TreeItemCollapsibleState.Expanded, absolutePath));
					}
				});
				return resolve(snippets);
			});
		});
	}

	private getAllSnippetFiles(): Promise<SnippetFile[]> {
		return new Promise(async (resolve, reject) => {
			const workspaceFolders = workspace.workspaceFolders;
			let projectLevelSnippets: SnippetFile[] = [];
			if (workspaceFolders) {
				// @ts-ignore
				projectLevelSnippets = [].concat.apply([], await Promise.all(workspaceFolders.map(async folder => {
					return this.getSnippetFilesFromDirectory(path.join(folder.uri.fsPath, '.vscode'), [SnippetFileExtensions.codeSnippets]);
				})));
			}

			const globalLevelSnippets: SnippetFile[] = await this.getSnippetFilesFromDirectory(this.snippetsDirPath, [SnippetFileExtensions.json, SnippetFileExtensions.codeSnippets]);

			return resolve(projectLevelSnippets.concat(globalLevelSnippets));
		});
	}

	private getSnippetFileContents(absolutePath: string): Promise<Snippet[]> {
		return new Promise((resolve, reject) => {
			fs.readFile(absolutePath, 'utf8', (err, contents) => {
				if (err) {
					window.showErrorMessage(`Error reading file ${absolutePath} \n ${err.message}`);
					return reject([]);
				}

				if (contents === '') {
					return resolve([]);
				}

				let parsedSnippets: ISnippetFile;
				try {
					parsedSnippets = JSON5.parse(contents);
				} catch (err) {
					window.showErrorMessage(`JSON parsing of snippet file ${absolutePath} failed`);// TODO: make file link clickable
					return reject([]);
				}

				const snippets: Snippet[] = [];
				for (const key in parsedSnippets) {
					if (this.config._excludeRegex && this.config._excludeRegex.test(key)) {
						continue;
					}
					const parsed = parsedSnippets[key];
					snippets.push(new Snippet(
						key,
						parsed.scope || '',
						TreeItemCollapsibleState.None, absolutePath,
						{
							command: `${EXTENSION_NAME}.insertSnippet`,
							title: 'Insert Snippet',
							arguments: [parsed.body],
						},
					));
				}
				return resolve(snippets);
			});
		});
	}
}

export class Snippet extends TreeItem {

	constructor(
		readonly label: string,
		private scope: string,
		readonly collapsibleState: TreeItemCollapsibleState,
		readonly absolutePath: string,
		readonly command: Command,
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return this.scope;
	}

	get description(): string {
		return this.scope;
	}

	contextValue = 'snippet';
}
export class SnippetFile extends TreeItem {

	constructor(
		readonly label: string,
		readonly collapsibleState: TreeItemCollapsibleState,
		readonly absolutePath: string,
	) {
		super(label, collapsibleState);

		this.resourceUri = Uri.file(absolutePath);
		this.iconPath = ThemeIcon.File;
	}

	contextValue = 'snippetFile';
}
