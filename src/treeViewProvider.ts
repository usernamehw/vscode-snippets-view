import * as fs from 'fs';
import JSON5 from 'json5';
import * as path from 'path';
import * as vscode from 'vscode';
import { extensionConfig, EXTENSION_NAME } from './extension';
import { IConfig, IExtension, ISnippetFile, SessionCache, SnippetFileExtensions } from './types';
import { dirExists, isObject, log } from './utils';

const extensionFileDelimiter = ' => ';

export class Snippet extends vscode.TreeItem {
	readonly collapsibleState = vscode.TreeItemCollapsibleState.None;

	constructor(
		readonly label: string,
		readonly scope: string[],
		readonly command: vscode.Command,
		readonly snippetFile: SnippetFile,
		readonly config: IConfig
	) {
		super(label);

		if (snippetFile.fromExtension) {
			this.scope = [snippetFile.label.split(extensionFileDelimiter)[1]];
		}
	}
	// @ts-expect-error idk
	get tooltip() {
		return this.scope.join(',');
	}
	// @ts-expect-error idk
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

export class SnippetFile extends vscode.TreeItem {
	constructor(
		readonly label: string,
		readonly absolutePath: string,
		readonly isJSON: boolean,
		readonly fromExtension?: {
			language: string;
		}
	) {
		super(label);

		this.resourceUri = vscode.Uri.file(absolutePath);
		if (this.fromExtension) {
			this.iconPath = vscode.ThemeIcon.Folder;
		} else {
			this.iconPath = vscode.ThemeIcon.File;
		}
		this.collapsibleState = extensionConfig.treeViewCollapsedByDefault ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded;
	}

	contextValue = 'snippetFile';
}

export class SnippetProvider implements vscode.TreeDataProvider<Snippet | SnippetFile> {
	private readonly _onDidChangeTreeData: vscode.EventEmitter<Snippet | undefined> = new vscode.EventEmitter<Snippet | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Snippet | undefined> = this._onDidChangeTreeData.event;

	constructor(
		private readonly snippetsDirPath: string,
		private config: IConfig
	) { }

	refresh(disposeCache: boolean): void {
		if (disposeCache) {
			SnippetProvider.sessionCache.snippetsFromFile = {};
			SnippetProvider.sessionCache.allSnippetFiles = [];
		}
		this._onDidChangeTreeData.fire(undefined);
	}

	updateConfig(newConfig: IConfig): void {
		this.config = newConfig;
		/* develblock:start */
		log('💜 :: UpdateConfig');
		/* develblock:end */
	}

	getTreeItem(element: Snippet | SnippetFile): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: SnippetFile): Promise<Snippet[] | SnippetFile[]> {
		if (element) {
			const snippetsFromFile = await this.getSnippetFileContents(element);
			return snippetsFromFile.filter(this.filterSnippets).sort(this.sortByScope);
		} else {
			if (this.config.flatten) {
				const allSnippets = await this.getAllSnippets();
				return allSnippets.filter(this.filterSnippets).sort(this.sortByScope);
			} else {
				const allSnippetFiles = await this.getAllSnippetFiles();
				return allSnippetFiles;
			}
		}
	}

	private getSnippetFilesFromDirectory(absoluteDirPath: string, fileExtensions: SnippetFileExtensions[]): Promise<SnippetFile[]> {
		return new Promise((resolve, reject) => {
			fs.readdir(absoluteDirPath, (err, files) => {
				if (err) {
					vscode.window.showErrorMessage(`Error reading directory ${absoluteDirPath} \n ${err.message}`);
					return reject([]);
				}

				const snippets: SnippetFile[] = [];
				files.forEach(file => {
					const extname = path.extname(file);
					const filename = path.parse(file).name;
					const absolutePath = path.join(absoluteDirPath, file);
					if (fileExtensions.includes(extname as SnippetFileExtensions)) {
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
		if (SnippetProvider.sessionCache.allSnippetFiles.length) {
			/* develblock:start */
			log('✅ :: Take all snippet files from cache');
			/* develblock:end */
			return Promise.resolve(SnippetProvider.sessionCache.allSnippetFiles);
		}
		return new Promise(async (resolve, reject) => {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			let projectLevelSnippets: SnippetFile[] = [];
			if (workspaceFolders) {
				projectLevelSnippets = Array.prototype.concat.apply([], await Promise.all(workspaceFolders.map(async folder => {
					const vscodeDirPath = path.join(folder.uri.fsPath, '.vscode');
					const isDirExists = await dirExists(vscodeDirPath);
					if (!isDirExists) return [];
					return this.getSnippetFilesFromDirectory(vscodeDirPath, [SnippetFileExtensions.codeSnippets]);
				})));
			}
			let extensionContributedSnippets: SnippetFile[] = [];
			if (this.config.includeExtensionSnippets) {
				extensionContributedSnippets = this.getExtensionSnippetFiles();
			}

			const globalLevelSnippets: SnippetFile[] = await this.getSnippetFilesFromDirectory(this.snippetsDirPath, [SnippetFileExtensions.json, SnippetFileExtensions.codeSnippets]);

			const allSnippetFiles = projectLevelSnippets.concat(globalLevelSnippets, extensionContributedSnippets);
			/* develblock:start */
			log('🔻 :: Find all Snippet Files');
			/* develblock:end */

			SnippetProvider.sessionCache.allSnippetFiles = allSnippetFiles;

			return resolve(allSnippetFiles);
		});
	}

	private async getAllSnippetFilesContents(snippetFiles: SnippetFile[]): Promise<Snippet[]> {
		const snippets = await Promise.all(snippetFiles.map(file => this.getSnippetFileContents(file)));

		return Array.prototype.concat.apply([], snippets);
	}

	private async getAllSnippets(): Promise<Snippet[]> {
		const snippetFiles = await this.getAllSnippetFiles();
		const allSnippets = await this.getAllSnippetFilesContents(snippetFiles);
		return allSnippets;
	}

	private getExtensionSnippetFiles(): SnippetFile[] {
		const extensionSnippets: SnippetFile[] = [];
		vscode.extensions.all.forEach((ext: IExtension) => {
			const contributes = ext.packageJSON && ext.packageJSON.contributes;
			if (!isObject(contributes)) {
				return;
			}
			// @ts-ignore
			const snippets = contributes.snippets;
			if (!Array.isArray(snippets)) {
				return;
			}
			const extensionLocation = ext.packageJSON.extensionLocation;
			if (!extensionLocation) {
				/* develblock:start */
				log('❌ :: Extension could not be found', ext.id);
				/* develblock:end */
				return;
			}
			snippets.forEach(snippet => {
				extensionSnippets.push(new SnippetFile(`${ext.id}${extensionFileDelimiter}${snippet.language}`, path.join(extensionLocation.fsPath, snippet.path), true, { language: snippet.language }));
			});
		});
		return extensionSnippets;
	}

	private getSnippetFileContents(snippetFile: SnippetFile): Promise<Snippet[]> {
		const language: string = snippetFile.fromExtension && snippetFile.fromExtension.language || '';
		const sessionCacheKey = snippetFile.absolutePath + language;

		if (SnippetProvider.sessionCache.snippetsFromFile[sessionCacheKey]) {
			/* develblock:start */
			log('💚 :: Take file content from cache', sessionCacheKey);
			/* develblock:end */
			return Promise.resolve(SnippetProvider.sessionCache.snippetsFromFile[sessionCacheKey]);
		}
		return new Promise((resolve, reject) => {
			fs.readFile(snippetFile.absolutePath, 'utf8', (err, contents) => {
				if (err) {
					vscode.window.showErrorMessage(`Error reading file ${snippetFile.absolutePath} \n ${err.message}`);
					return reject([]);
				}

				if (contents === '') {
					/* develblock:start */
					log('🆒 :: Empty file', snippetFile.absolutePath);
					/* develblock:end */
					SnippetProvider.sessionCache.snippetsFromFile[sessionCacheKey] = [];
					return resolve([]);
				}

				let parsedSnippets: ISnippetFile;
				try {
					parsedSnippets = JSON5.parse(contents);// tslint:disable-line
				} catch (err) {
					/* develblock:start */
					log(`❌ :: JSON parsing of snippet file ${snippetFile.absolutePath} failed`);
					/* develblock:end */
					vscode.window.showErrorMessage(`JSON parsing of snippet file ${snippetFile.absolutePath} failed`);
					return reject([]);
				}

				const snippets: Snippet[] = [];
				for (const key in parsedSnippets) {
					const parsed = parsedSnippets[key];
					if (!parsed.scope && snippetFile.isJSON && !snippetFile.fromExtension) {
						parsed.scope = snippetFile.label;
					} else if (snippetFile.fromExtension) {
						parsed.scope = snippetFile.fromExtension.language;
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
						this.config
					));
				}

				SnippetProvider.sessionCache.snippetsFromFile[sessionCacheKey] = snippets;

				/* develblock:start */
				log('⏹ :: Read Snippet File', sessionCacheKey);
				/* develblock:end */

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
	};
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
		allSnippetFiles: [],
	};
}
