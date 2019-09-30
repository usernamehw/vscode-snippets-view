'use strict';
import * as path from 'path';
import { commands, ConfigurationChangeEvent, Disposable, DocumentSymbol, ExtensionContext, Selection, TextDocument, TextEditor, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';

import { Snippet, SnippetFile, SnippetProvider } from './provider';
import { snippetFromSelection } from './snippetFromSelection';
import { IConfig, ISnippet } from './types';

export const EXTENSION_NAME = 'snippets-view';

export function activate(extensionContext: ExtensionContext) {
	const config = JSON.parse(JSON.stringify(workspace.getConfiguration(EXTENSION_NAME))) as IConfig;
	let onDidChangeActiveTextEditor: Disposable;
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
			let symbols = await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);// tslint:disable-line
			if (!symbols || symbols.length === 0) {
				setTimeout(async () => {
					symbols = await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);// tslint:disable-line
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
		showCollapseAll: true,
	});

	const snippetFromSelectionCommand = vscode.commands.registerTextEditorCommand(`${EXTENSION_NAME}.createSnippetFromSelection`, editor => {
		snippetFromSelection(editor, config.snippetFromSelectionIncludeDescription);
	});

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
	function updateExcludeRegex(newRegex: any) {
		if (newRegex && typeof newRegex === 'string') {
			try {
				config._excludeRegex = new RegExp(newRegex, 'i');
			} catch (err) {
				window.showErrorMessage(`Invalid regex for "excludeRegex" ${err.toString() as Error}`);// tslint:disable-line
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
		snippetsProvider.refresh(false);
	}

	if (config.onlyForActiveEditor) {
		onDidChangeActiveTextEditor = window.onDidChangeActiveTextEditor(onChangeActiveTextEditor);
		extensionContext.subscriptions.push(onDidChangeActiveTextEditor);
	}

	extensionContext.subscriptions.push(workspace.onDidChangeConfiguration(updateConfig, EXTENSION_NAME));
	extensionContext.subscriptions.push(insertSnippet, snippetsView, refresh, openSnippetsFile, snippetFromSelectionCommand, toggleOnlyForActiveEditor, toggleFlatten);
}

export function deactivate() { }
