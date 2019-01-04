'use strict';
import * as path from 'path';
import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';

import { SnippetFile, SnippetProvider } from './provider';
import { IConfig, ISnippet } from './types';

export const EXTENSION_NAME = 'snippets-view';

export function activate(extensionContext: ExtensionContext) {
	const insertSnippet = commands.registerCommand(`${EXTENSION_NAME}.insertSnippet`, (snippetBody: ISnippet['body']) => {
		let snippetAsString;
		if (Array.isArray(snippetBody)) {
			snippetAsString = snippetBody.join('\n');
		}
		commands.executeCommand('editor.action.insertSnippet', {
			snippet: snippetAsString ? snippetAsString : snippetBody,
		});

		const config = workspace.getConfiguration(EXTENSION_NAME) as any as IConfig;
		if (config.focusEditorAfterInsertion) {
			commands.executeCommand('workbench.action.focusActiveEditorGroup');
		}
	});

	const openSnippetsFile = commands.registerCommand(`${EXTENSION_NAME}.openSnippetsFile`, (snippetFile: SnippetFile) => {
		workspace.openTextDocument(Uri.file(snippetFile.absolutePath)).then(doc => {
			window.showTextDocument(doc);
		});
	});

	const refresh = commands.registerCommand('snippets-view.tree.refresh', () => snippetsProvider.refresh());

	const snippetsProvider = new SnippetProvider(path.join(extensionContext.logPath, '..', '..', '..', '..', 'User', 'snippets'));
	const snippetsTree = window.registerTreeDataProvider(`${EXTENSION_NAME}.tree`, snippetsProvider);

	extensionContext.subscriptions.push(insertSnippet, snippetsTree, refresh, openSnippetsFile);
}

export function deactivate() { }
