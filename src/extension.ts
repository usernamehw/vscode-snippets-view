'use strict';
import { ExtensionContext, commands, window, workspace, TextEditor, TextDocument } from 'vscode';
// import * as vscode from 'vscode';
import * as path from 'path';
import { SnippetProvider } from './provider';
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
	const refresh = commands.registerCommand('snippets-view.tree.refresh', () => snippetsProvider.refresh());

	const snippetsProvider = new SnippetProvider(path.join(extensionContext.logPath, '../../../..', 'User/snippets'));
	const snippetsTree = window.registerTreeDataProvider(`${EXTENSION_NAME}.tree`, snippetsProvider);

	extensionContext.subscriptions.push(insertSnippet, snippetsTree, refresh);
}

export function deactivate() { }
