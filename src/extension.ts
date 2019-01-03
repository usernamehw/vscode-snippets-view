'use strict';
import { ExtensionContext, commands, window, workspace, Uri } from 'vscode';
import * as path from 'path';
import { SnippetProvider, SnippetFile } from './provider';
import { IConfig } from './types';

export const EXTENSION_NAME = 'snippets-view';

export function activate(extensionContext: ExtensionContext) {
	const insertSnippet = commands.registerCommand(`${EXTENSION_NAME}.insertSnippet`, (key) => {
		if (Array.isArray(key)) {
			key = key.join('\n');
		}
		commands.executeCommand('editor.action.insertSnippet', {
			snippet: key
		});
		const config = workspace.getConfiguration(EXTENSION_NAME) as any as IConfig;
		if (config.focusEditorAfterInsertion) {
			commands.executeCommand('workbench.action.focusActiveEditorGroup');
		}
	});
	const openSnippetsFile = commands.registerCommand(`${EXTENSION_NAME}.openSnippetFile`, (snippetFile: SnippetFile) => {
		workspace.openTextDocument(Uri.file(snippetFile.absolutePath)).then(doc => {
			window.showTextDocument(doc);
		});
	});
	const refresh = commands.registerCommand('snippets-view.tree.refresh', () => snippetsProvider.refresh());

	const snippetsProvider = new SnippetProvider(path.join(extensionContext.logPath, '../../../..', 'User/snippets'));
	const snippetsTree = window.registerTreeDataProvider(`${EXTENSION_NAME}.tree`, snippetsProvider);

	extensionContext.subscriptions.push(insertSnippet, snippetsTree, refresh, openSnippetsFile);
}

export function deactivate() { }
