'use strict';
import * as path from 'path';
import { commands, ConfigurationChangeEvent, DocumentSymbol, ExtensionContext, Selection, TextDocument, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';

import { Snippet, SnippetFile, SnippetProvider } from './provider';
import { IConfig, ISnippet } from './types';

export const EXTENSION_NAME = 'snippets-view';

export function activate(extensionContext: ExtensionContext) {
	const config = { ...workspace.getConfiguration(EXTENSION_NAME) } as any as IConfig;
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
	const refresh = commands.registerCommand('snippets-view.tree.refresh', () => snippetsProvider.refresh(true));
	const snippetsTree = window.registerTreeDataProvider(`${EXTENSION_NAME}.tree`, snippetsProvider);

	function updateConfig(e: ConfigurationChangeEvent) {
		if (!e.affectsConfiguration(EXTENSION_NAME)) return;

		const newConfig = workspace.getConfiguration(EXTENSION_NAME) as any as IConfig;
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
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.onlyForActiveEditor`)) {
			config.onlyForActiveEditor = newConfig.onlyForActiveEditor;
			snippetsProvider.updateConfig(config);
			snippetsProvider.refresh(true);
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

	let onDidChangeActiveTextEditor;
	if (config.onlyForActiveEditor) {
		onDidChangeActiveTextEditor = window.onDidChangeActiveTextEditor(textEditor => {
			if (config.onlyForActiveEditor) {
				config._activeTextEditor = textEditor;
				snippetsProvider.updateConfig(config);
				snippetsProvider.refresh(false);
			}
		});
		extensionContext.subscriptions.push(onDidChangeActiveTextEditor);
	}

	extensionContext.subscriptions.push(workspace.onDidChangeConfiguration(updateConfig, EXTENSION_NAME));
	extensionContext.subscriptions.push(insertSnippet, snippetsTree, refresh, openSnippetsFile);
}

export function deactivate() { }
