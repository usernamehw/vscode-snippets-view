import * as fs from 'fs';
import * as path from 'path';
import { EXTENSION_NAME } from './extension';
import { window, TreeItemCollapsibleState, TreeDataProvider, EventEmitter, Event, TreeItem, Command } from 'vscode';
import * as JSON5 from 'json5';
import { ISnippetFile } from './types';

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

	getChildren(element?: Snippet): Thenable<Snippet[]> {
		if (element) {
			return new Promise((res, rej) => {
				fs.readFile(element.absolutePath!, 'utf8', (err, contents) => {
					if (err) {
						throw err;
					}

					let parsedSnippets: ISnippetFile;
					try {
						parsedSnippets = JSON5.parse(contents);
					} catch (err) {
						window.showErrorMessage(`JSON parsing of snippet file ${element.absolutePath} failed`);
						return rej([]);
					}

					const arr = [];
					for (const key in parsedSnippets) {
						const parsed = parsedSnippets[key];
						arr.push(new Snippet(key, parsed.scope || '', TreeItemCollapsibleState.None, undefined, {
							command: EXTENSION_NAME + '.insertSnippet',
							title: 'Insert Snippet',
							arguments: [parsed.body]
						}));
					}
					return res(arr);
				});
			});
		} else {
			return new Promise((res, rej) => {
				fs.readdir(this.SnippetsDirPath, (err, files) => {
					if (err) {
						throw err;
					}

					const arr: any = [];
					files.forEach(file => {
						const extname = path.extname(file);
						const filename = path.parse(file).name;
						const absolutePath = path.join(this.SnippetsDirPath, file);
						if (extname === '.json') {
							arr.push(new Snippet(filename, '', TreeItemCollapsibleState.Expanded, absolutePath));
						} else if (extname === '.code-snippets') {
							arr.push(new Snippet(filename, '', TreeItemCollapsibleState.Expanded, absolutePath));
						}
					});
					return res(arr);
				});
			});
		}
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
