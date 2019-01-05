'use strict';
import * as path from 'path';
import { commands, ConfigurationChangeEvent, DocumentSymbol, ExtensionContext, Selection, TextDocument, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';

import { Snippet, SnippetFile, SnippetProvider } from './provider';
import { IConfig, ISnippet } from './types';

export const EXTENSION_NAME = 'snippets-view';

export function activate(extensionContext: ExtensionContext) {
	const config = { ...workspace.getConfiguration(EXTENSION_NAME) } as any as IConfig;

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

	const openSnippetsFile = commands.registerCommand(`${EXTENSION_NAME}.openSnippetsFile`, (snippetFile: SnippetFile | Snippet) => {
		workspace.openTextDocument(Uri.file(snippetFile.absolutePath)).then(document => {
			window.showTextDocument(document);
			goToSymbol(document, snippetFile.label);
		});
	});

	async function getSymbols(document: TextDocument): Promise<DocumentSymbol[]> {
		return await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri) || [];
	}

	async function goToSymbol(document: TextDocument, symbolName: string) {
		const symbols = await getSymbols(document);
		const findSymbol = symbols.find(symbol => symbol.name === symbolName);
		const activeTextEditor = window.activeTextEditor;
		if (findSymbol && activeTextEditor) {
			activeTextEditor.revealRange(findSymbol.range, vscode.TextEditorRevealType.AtTop);
			activeTextEditor.selection = new Selection(findSymbol.range.start, findSymbol.range.start);
		}
	}

	const snippetsProvider = new SnippetProvider(path.join(extensionContext.logPath, '..', '..', '..', '..', 'User', 'snippets'), config);
	const refresh = commands.registerCommand('snippets-view.tree.refresh', () => snippetsProvider.refresh());
	const snippetsTree = window.registerTreeDataProvider(`${EXTENSION_NAME}.tree`, snippetsProvider);

	function updateConfig(e: ConfigurationChangeEvent) {
		if (!e.affectsConfiguration(EXTENSION_NAME)) return;

		const newConfig = workspace.getConfiguration(EXTENSION_NAME) as any as IConfig;
		if (e.affectsConfiguration(`${EXTENSION_NAME}.flatten`)) {
			config.flatten = newConfig.flatten;
			snippetsProvider.updateConfig(config);
			snippetsProvider.refresh();
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.focusEditorAfterInsertion`)) {
			config.focusEditorAfterInsertion = newConfig.focusEditorAfterInsertion;
		}
	}

	extensionContext.subscriptions.push(workspace.onDidChangeConfiguration(updateConfig, EXTENSION_NAME));
	extensionContext.subscriptions.push(insertSnippet, snippetsTree, refresh, openSnippetsFile);
}

export function deactivate() { }
