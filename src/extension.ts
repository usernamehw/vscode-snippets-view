'use strict';
import * as path from 'path';
import { commands, ConfigurationChangeEvent, Disposable, DocumentSymbol, ExtensionContext, Selection, TextDocument, TextEditor, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';

import { Snippet, SnippetFile, SnippetProvider } from './provider';
import { IConfig, ISnippet } from './types';

export const EXTENSION_NAME = 'snippets-view';

export function activate(extensionContext: ExtensionContext) {
	const config = JSON.parse(JSON.stringify(workspace.getConfiguration(EXTENSION_NAME))) as IConfig;
	config._activeTextEditor = window.activeTextEditor;
	updateExcludeRegex(config.excludeRegex);

	const insertSnippet = commands.registerCommand(`${EXTENSION_NAME}.insertSnippet`, (snippetBody: ISnippet['body']) => {
		let snippetAsString;
		if (Array.isArray(snippetBody)) {
			snippetAsString = snippetBody.join('\n');
		}
		commands.executeCommand('editor.action.insertSnippet', {
			snippet: snippetAsString ? snippetAsString : snippetBody,
		});

		if (config.focusEditorAfterInsertion) {
			commands.executeCommand('workbench.action.focusActiveEditorGroup');
		}
	});

	const openSnippetsFile = commands.registerCommand(`${EXTENSION_NAME}.openSnippetsFile`, (arg: SnippetFile | Snippet) => {
		let absolutePath: string;
		if (arg instanceof Snippet) {
			absolutePath = arg.snippetFile.absolutePath;
		} else {
			absolutePath = arg.absolutePath;
		}
		workspace.openTextDocument(Uri.file(absolutePath)).then(document => {
			window.showTextDocument(document).then(() => {
				goToSymbol(document, arg.label);
			});
		});
	});
	const toggleOnlyForActiveEditor = commands.registerCommand(`${EXTENSION_NAME}.toggleOnlyForActiveEditor`, () => {
		const settings = workspace.getConfiguration(undefined, null);// tslint:disable-line
		const currentSettingValue = settings.get(`${EXTENSION_NAME}.onlyForActiveEditor`);
		settings.update(`${EXTENSION_NAME}.onlyForActiveEditor`, !currentSettingValue, true);
	});
	const toggleFlatten = commands.registerCommand(`${EXTENSION_NAME}.toggleFlatten`, () => {
		const settings = workspace.getConfiguration(undefined, null);// tslint:disable-line
		const currentSettingValue = settings.get(`${EXTENSION_NAME}.flatten`);
		settings.update(`${EXTENSION_NAME}.flatten`, !currentSettingValue, true);
	});

	async function getSymbols(document: TextDocument): Promise<DocumentSymbol[]> {
		return new Promise(async (resolve, reject) => {
			let symbols = await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);
			if (!symbols || symbols.length === 0) {
				setTimeout(async () => {
					symbols = await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);
					return resolve(symbols || []);
				}, 1200);
			} else {
				return resolve(symbols || []);
			}
		});
	}

	async function goToSymbol(document: TextDocument, symbolName: string) {
		const symbols = await getSymbols(document);
		const findSymbol = symbols.find(symbol => symbol.name === symbolName);
		const activeTextEditor = window.activeTextEditor;
		if (findSymbol && activeTextEditor) {
			activeTextEditor.selection = new Selection(findSymbol.range.start, findSymbol.range.start);
			activeTextEditor.revealRange(findSymbol.range, vscode.TextEditorRevealType.AtTop);
		}
	}

	const snippetsProvider = new SnippetProvider(path.join(extensionContext.logPath, '..', '..', '..', '..', 'User', 'snippets'), config);
	const refresh = commands.registerCommand(`${EXTENSION_NAME}.tree.refresh`, () => snippetsProvider.refresh(true));
	const snippetsView = vscode.window.createTreeView(`${EXTENSION_NAME}.tree`, {
		treeDataProvider: snippetsProvider,
		// @ts-ignore
		showCollapseAll: true,
	});

	const snippetFromSelection = vscode.commands.registerTextEditorCommand(`${EXTENSION_NAME}.createSnippetFromSelection`, editor => {
		const { document } = editor;
		const { selection } = editor;
		const tabSize = editor.options.tabSize as number;
		let body: string | string[] = [];
		for (let i = selection.start.line; i <= selection.end.line; i++) {
			const line = document.lineAt(i);
			let lineText = line.text;
			if (i === selection.start.line) {
				lineText = lineText.slice(selection.start.character);
			} else if (i === selection.end.line) {
				lineText = lineText.slice(0, selection.end.character);
			}
			body.push(snippetizeLine(lineText, tabSize));
		}
		if (body.length === 1) {
			body = body[0];
		}
		if (Array.isArray(body)) {
			body = body.map(line => JSON.stringify(line));
			body[0] = `\t\t\t${body[0]}`;
			body = `[\n${body.join(',\n\t\t\t')}\n\t\t]`;
		} else {
			body = `${JSON.stringify(body)}`;
		}
		let snippet = '{\n';
		snippet += '\t"\${1:untitled}": {\n';
		snippet += `\t\t"scope": "\${3:${editor.document.languageId}}",\n`;
		snippet += '\t\t"prefix": "${2:${1:untitled}}",\n';
		snippet += `\t\t"body": ${body},\n`;
		if (config.snippetFromSelectionIncludeDescription) {
			snippet += '\t\t"description": "${4:description}",\n';
		}
		snippet += '\t}\n';
		snippet += '}';
		vscode.workspace.openTextDocument({ language: 'jsonc' }).then(newDocument => {
			vscode.window.showTextDocument(newDocument).then(() => {
				vscode.commands.executeCommand('editor.action.insertSnippet', {
					snippet,
				});
			});
		});
	});
	const TAB_SYMBOL = '	';
	const SPACE_SYMBOL = ' ';
	const indentTabRegex = new RegExp(`^${TAB_SYMBOL}+`);
	const indentSpaceRegex = new RegExp(`^${SPACE_SYMBOL}+`);
	function snippetizeLine(text: string, tabSize: number): string {
		let result = text;

		const indentTabMatch = result.match(indentTabRegex);
		if (indentTabMatch) {
			result = result.replace(indentTabRegex, '\t'.repeat(indentTabMatch[0].length));
		}

		const indentSpaceMatch = result.match(indentSpaceRegex);
		if (indentSpaceMatch) {
			result = result.replace(indentSpaceRegex, '\t'.repeat(indentSpaceMatch[0].length / tabSize));
		}

		return result
			.replace(/\\/g, '\\\\')
			.replace(/[\$]/g, '\\$');
	}

	function updateConfig(e: ConfigurationChangeEvent) {
		if (!e.affectsConfiguration(EXTENSION_NAME)) return;

		const newConfig = JSON.parse(JSON.stringify(workspace.getConfiguration(EXTENSION_NAME))) as IConfig;
		if (e.affectsConfiguration(`${EXTENSION_NAME}.flatten`)) {
			config.flatten = newConfig.flatten;
			snippetsProvider.updateConfig(config);
			snippetsProvider.refresh(true);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.excludeRegex`)) {
			updateExcludeRegex(newConfig.excludeRegex);
			snippetsProvider.updateConfig(config);
			snippetsProvider.refresh(false);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.focusEditorAfterInsertion`)) {
			config.focusEditorAfterInsertion = newConfig.focusEditorAfterInsertion;
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.showScope`)) {
			config.showScope = newConfig.showScope;
			snippetsProvider.updateConfig(config);
			snippetsProvider.refresh(false);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.onlyForActiveEditor`)) {
			config.onlyForActiveEditor = newConfig.onlyForActiveEditor;

			if (newConfig.onlyForActiveEditor) {
				onDidChangeActiveTextEditor = window.onDidChangeActiveTextEditor(onChangeActiveTextEditor);
				config._activeTextEditor = window.activeTextEditor;
			} else {
				onDidChangeActiveTextEditor.dispose();
				config._activeTextEditor = undefined;
			}

			snippetsProvider.updateConfig(config);
			snippetsProvider.refresh(true);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.includeExtensionSnippets`)) {
			config.includeExtensionSnippets = newConfig.includeExtensionSnippets;
			snippetsProvider.updateConfig(config);
			snippetsProvider.refresh(true);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.snippetFromSelectionIncludeDescription`)) {
			config.snippetFromSelectionIncludeDescription = newConfig.snippetFromSelectionIncludeDescription;
		}
	}
	function updateExcludeRegex(newRegex: string) {
		if (newRegex && typeof newRegex === 'string') {
			try {
				config._excludeRegex = new RegExp(newRegex, 'i');
			} catch (err) {
				window.showErrorMessage(`Invalid regex for "excludeRegex" ${err.toString()}`);
			}
		} else if (newRegex === '') {
			config._excludeRegex = undefined;
		}
	}
	function onChangeActiveTextEditor(textEditor: TextEditor | undefined) {
		if (!config._activeTextEditor && !textEditor) {
			return;
		}
		if (config._activeTextEditor && textEditor) {
			if (config._activeTextEditor.document.languageId === textEditor.document.languageId) {
				return;
			}
		}
		config._activeTextEditor = textEditor;
		snippetsProvider.updateConfig(config);
		if (config.includeExtensionSnippets && !config.flatten) {
			snippetsProvider.refresh(true);
		} else {
			snippetsProvider.refresh(false);
		}
	}

	let onDidChangeActiveTextEditor: Disposable;

	if (config.onlyForActiveEditor) {
		onDidChangeActiveTextEditor = window.onDidChangeActiveTextEditor(onChangeActiveTextEditor);
		extensionContext.subscriptions.push(onDidChangeActiveTextEditor);
	}

	extensionContext.subscriptions.push(workspace.onDidChangeConfiguration(updateConfig, EXTENSION_NAME));
	extensionContext.subscriptions.push(insertSnippet, snippetsView, refresh, openSnippetsFile, snippetFromSelection, toggleOnlyForActiveEditor, toggleFlatten);
}

export function deactivate() { }
