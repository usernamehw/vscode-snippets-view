import * as fs from 'fs';
import * as JSON5 from 'json5';
import * as path from 'path';
import { Command, Event, EventEmitter, TextEditor, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';

import { EXTENSION_NAME } from './extension';
import { IConfig, ISnippetFile, SessionCache, SnippetFileExtensions } from './types';
import { dirExists } from './utils';

export class SnippetProvider implements TreeDataProvider<Snippet | SnippetFile> {

	private readonly _onDidChangeTreeData: EventEmitter<Snippet | undefined> = new EventEmitter<Snippet | undefined>();
	readonly onDidChangeTreeData: Event<Snippet | undefined> = this._onDidChangeTreeData.event;

	constructor(
		private readonly snippetsDirPath: string,
		private config: IConfig,
	) { }

	refresh(disposeCache: boolean): void {
		if (disposeCache) {
			SnippetProvider.sessionCache.allSnippetFiles = [];
			SnippetProvider.sessionCache.flattenedSnippets = [];
			SnippetProvider.sessionCache.snippetsFromFile = {};
		}
		this._onDidChangeTreeData.fire();
	}

	updateConfig(newConfig: IConfig): void {
		this.config = newConfig;
		// console.log('💜 :: Provider :: updateConfig');
	}

	getTreeItem(element: Snippet | SnippetFile): TreeItem {
		return element;
	}

	async getChildren(element?: SnippetFile): Promise<Snippet[] | SnippetFile[]> {
		if (element) {
			if (SnippetProvider.sessionCache.snippetsFromFile[element.absolutePath]) {
				return Promise.resolve(SnippetProvider.sessionCache.snippetsFromFile[element.absolutePath].filter(this.filterSnippets).sort(this.sortByScope));
			}

			const snippetsFromFile = await this.getSnippetFileContents(element);

			SnippetProvider.sessionCache.snippetsFromFile[element.absolutePath] = snippetsFromFile;

			return snippetsFromFile.filter(this.filterSnippets).sort(this.sortByScope);
		} else {
			if (this.config.flatten) {
				if (SnippetProvider.sessionCache.flattenedSnippets.length) {
					return Promise.resolve(SnippetProvider.sessionCache.flattenedSnippets.filter(this.filterSnippets).sort(this.sortByScope));
				}

				const allSnippets = await this.getAllSnippets();
				SnippetProvider.sessionCache.flattenedSnippets = allSnippets;

				return allSnippets.filter(this.filterSnippets).sort(this.sortByScope);
			} else {
				if (SnippetProvider.sessionCache.allSnippetFiles.length) {
					return Promise.resolve(SnippetProvider.sessionCache.allSnippetFiles);
				}

				const allSnippetFiles = await this.getAllSnippetFiles();

				SnippetProvider.sessionCache.allSnippetFiles = allSnippetFiles;

				return allSnippetFiles;
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
						if (extname === SnippetFileExtensions.json) {
							snippets.push(new SnippetFile(filename, absolutePath, true));
						} else {
							snippets.push(new SnippetFile(filename, absolutePath, false));
						}
					}
				});
				return resolve(snippets);
			});
		});
	}

	private getAllSnippetFiles(): Promise<SnippetFile[]> {
		// console.log('🔴 :: Find all Snippet Files');
		return new Promise(async (resolve, reject) => {
			const workspaceFolders = workspace.workspaceFolders;
			let projectLevelSnippets: SnippetFile[] = [];
			if (workspaceFolders) {
				projectLevelSnippets = Array.prototype.concat.apply([], await Promise.all(workspaceFolders.map(async folder => {
					const vscodeDirPath = path.join(folder.uri.fsPath, '.vscode');
					const isDirExists = await dirExists(vscodeDirPath);
					if (!isDirExists) return [];
					return this.getSnippetFilesFromDirectory(vscodeDirPath, [SnippetFileExtensions.codeSnippets]);
				})));
			}

			const globalLevelSnippets: SnippetFile[] = await this.getSnippetFilesFromDirectory(this.snippetsDirPath, [SnippetFileExtensions.json, SnippetFileExtensions.codeSnippets]);
			return resolve(projectLevelSnippets.concat(globalLevelSnippets));
		});
	}

	private async getAllSnippetFilesContents(snippetFiles: SnippetFile[]): Promise<Snippet[]> {
		const snippets = await Promise.all(snippetFiles.map(file => {
			return this.getSnippetFileContents(file);
		}));

		return Array.prototype.concat.apply([], snippets);
	}

	private async getAllSnippets(): Promise<Snippet[]> {
		const snippetFiles = await this.getAllSnippetFiles();
		const allSnippets = await this.getAllSnippetFilesContents(snippetFiles);
		return allSnippets;
	}

	private getSnippetFileContents(snippetFile: SnippetFile): Promise<Snippet[]> {
		// console.log('🔵 :: Read Snippet File', snippetFile.absolutePath);
		return new Promise((resolve, reject) => {
			fs.readFile(snippetFile.absolutePath, 'utf8', (err, contents) => {
				if (err) {
					window.showErrorMessage(`Error reading file ${snippetFile.absolutePath} \n ${err.message}`);
					return reject([]);
				}

				if (contents === '') {
					return resolve([]);
				}

				let parsedSnippets: ISnippetFile;
				try {
					parsedSnippets = JSON5.parse(contents);
				} catch (err) {
					window.showErrorMessage(`JSON parsing of snippet file ${snippetFile.absolutePath} failed`);
					return reject([]);
				}

				const snippets: Snippet[] = [];
				for (const key in parsedSnippets) {
					const parsed = parsedSnippets[key];
					if (!parsed.scope && snippetFile.isJSON) {
						parsed.scope = snippetFile.label;
					}
					const scope = parsed.scope ? parsed.scope.split(',') : [];

					snippets.push(new Snippet(
						key,
						scope,
						{
							command: `${EXTENSION_NAME}.insertSnippet`,
							title: 'Insert Snippet',
							arguments: [parsed.body],
						},
						snippetFile,
						this.config,
					));
				}
				return resolve(snippets);
			});
		});
	}
	// = () => to bind `this`
	private readonly filterSnippets = (snippet: Snippet): boolean => {
		// Exclude regex matching snippet key
		if (this.config._excludeRegex && this.config._excludeRegex.test(snippet.label)) {
			return false;
		}
		// Exlude snippets except the ones for active editor and the global snippets
		if (this.config.onlyForActiveEditor && this.config._activeTextEditor && snippet.scope.length !== 0) {
			if (!snippet.scope.includes(this.config._activeTextEditor.document.languageId)) {
				return false;
			}
		}
		return true;
	}
	// Sort snippets that have:
	// 1 total and 1 matching scope - the highest
	// Multiple scopes, but 1 of them matching - after
	// Global snippets having 0 scopes - the lowest
	private sortByScope(sn1: Snippet, sn2: Snippet) {
		const n1 = sn1.scope.length === 1 ? Infinity : sn1.scope.length;
		const n2 = sn2.scope.length === 1 ? Infinity : sn2.scope.length;

		return n2 - n1;
	}

	private static readonly sessionCache: SessionCache = {
		snippetsFromFile: {},
		flattenedSnippets: [],
		allSnippetFiles: [],
	};
}

export class Snippet extends TreeItem {
	readonly collapsibleState = TreeItemCollapsibleState.None;

	constructor(
		readonly label: string,
		readonly scope: string[],
		readonly command: Command,
		readonly snippetFile: SnippetFile,
		readonly config: IConfig,
	) {
		super(label);
	}

	get tooltip() {
		return this.scope.join(',');
	}

	get description() {
		if (this.snippetFile.isJSON && !this.config.flatten) {
			return;
		}
		if (!this.config.showScope) {
			return;
		}
		return this.scope.join(',');
	}

	contextValue = 'snippet';
}

export class SnippetFile extends TreeItem {
	readonly collapsibleState = TreeItemCollapsibleState.Expanded;

	constructor(
		readonly label: string,
		readonly absolutePath: string,
		readonly isJSON: boolean,
	) {
		super(label);

		this.resourceUri = Uri.file(absolutePath);
		this.iconPath = ThemeIcon.File;
	}

	contextValue = 'snippetFile';
}
