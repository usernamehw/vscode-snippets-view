'use strict';
import * as path from 'path';
import vscode, { commands, ConfigurationChangeEvent, Disposable, DocumentSymbol, ExtensionContext, Selection, TextDocument, TextEditor, Uri, window, workspace } from 'vscode';
import { snippetFromSelection } from './snippetFromSelection';
import { Snippet, SnippetFile, SnippetProvider } from './treeViewProvider';
import { IConfig, ISnippet } from './types';

export const EXTENSION_NAME = 'snippets-view';
export const extensionConfig = JSON.parse(JSON.stringify(workspace.getConfiguration(EXTENSION_NAME))) as IConfig;


export function activate(extensionContext: ExtensionContext) {
	let onDidChangeActiveTextEditor: Disposable;
	extensionConfig._activeTextEditor = window.activeTextEditor;
	updateExcludeRegex(extensionConfig.excludeRegex);

	const insertSnippet = commands.registerCommand(`${EXTENSION_NAME}.insertSnippet`, (snippetBody: ISnippet['body']) => {
		let snippetAsString;
		if (Array.isArray(snippetBody)) {
			snippetAsString = snippetBody.join('\n');
		}
		commands.executeCommand('editor.action.insertSnippet', {
			snippet: snippetAsString ? snippetAsString : snippetBody,
		});

		if (extensionConfig.focusEditorAfterInsertion) {
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
	const useTreeView = commands.registerCommand(`${EXTENSION_NAME}.useTreeView`, () => {
		const settings = workspace.getConfiguration(undefined, null);// tslint:disable-line
		const currentSettingValue = settings.get(`${EXTENSION_NAME}.flatten`);
		settings.update(`${EXTENSION_NAME}.flatten`, !currentSettingValue, true);
	});
	const useListView = commands.registerCommand(`${EXTENSION_NAME}.useListView`, () => {
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

	const snippetsProvider = new SnippetProvider(path.join(extensionContext.logPath, '..', '..', '..', '..', 'User', 'snippets'), extensionConfig);
	const refresh = commands.registerCommand(`${EXTENSION_NAME}.tree.refresh`, () => snippetsProvider.refresh(true));
	const snippetsView = vscode.window.createTreeView(`${EXTENSION_NAME}.tree`, {
		treeDataProvider: snippetsProvider,
		showCollapseAll: true,
	});

	const snippetFromSelectionCommand = vscode.commands.registerTextEditorCommand(`${EXTENSION_NAME}.createSnippetFromSelection`, editor => {
		snippetFromSelection(editor, extensionConfig.snippetFromSelectionIncludeDescription);
	});

	function updateConfig(e: ConfigurationChangeEvent) {
		if (!e.affectsConfiguration(EXTENSION_NAME)) return;

		const newConfig = JSON.parse(JSON.stringify(workspace.getConfiguration(EXTENSION_NAME))) as IConfig;
		if (e.affectsConfiguration(`${EXTENSION_NAME}.flatten`)) {
			extensionConfig.flatten = newConfig.flatten;
			snippetsProvider.updateConfig(extensionConfig);
			snippetsProvider.refresh(true);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.excludeRegex`)) {
			updateExcludeRegex(newConfig.excludeRegex);
			snippetsProvider.updateConfig(extensionConfig);
			snippetsProvider.refresh(false);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.focusEditorAfterInsertion`)) {
			extensionConfig.focusEditorAfterInsertion = newConfig.focusEditorAfterInsertion;
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.showScope`)) {
			extensionConfig.showScope = newConfig.showScope;
			snippetsProvider.updateConfig(extensionConfig);
			snippetsProvider.refresh(false);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.onlyForActiveEditor`)) {
			extensionConfig.onlyForActiveEditor = newConfig.onlyForActiveEditor;

			if (newConfig.onlyForActiveEditor) {
				onDidChangeActiveTextEditor = window.onDidChangeActiveTextEditor(onChangeActiveTextEditor);
				extensionConfig._activeTextEditor = window.activeTextEditor;
			} else {
				onDidChangeActiveTextEditor.dispose();
				extensionConfig._activeTextEditor = undefined;
			}

			snippetsProvider.updateConfig(extensionConfig);
			snippetsProvider.refresh(true);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.includeExtensionSnippets`)) {
			extensionConfig.includeExtensionSnippets = newConfig.includeExtensionSnippets;
			snippetsProvider.updateConfig(extensionConfig);
			snippetsProvider.refresh(true);
		} else if (e.affectsConfiguration(`${EXTENSION_NAME}.snippetFromSelectionIncludeDescription`)) {
			extensionConfig.snippetFromSelectionIncludeDescription = newConfig.snippetFromSelectionIncludeDescription;
		}
	}
	function updateExcludeRegex(newRegex: any) {
		if (newRegex && typeof newRegex === 'string') {
			try {
				extensionConfig._excludeRegex = new RegExp(newRegex, 'i');
			} catch (err) {
				window.showErrorMessage(`Invalid regex for "excludeRegex" ${err.toString() as Error}`);// tslint:disable-line
			}
		} else if (newRegex === '') {
			extensionConfig._excludeRegex = undefined;
		}
	}
	function onChangeActiveTextEditor(textEditor: TextEditor | undefined) {
		if (!extensionConfig._activeTextEditor && !textEditor) {
			return;
		}
		if (extensionConfig._activeTextEditor && textEditor) {
			if (extensionConfig._activeTextEditor.document.languageId === textEditor.document.languageId) {
				return;
			}
		}
		extensionConfig._activeTextEditor = textEditor;
		snippetsProvider.updateConfig(extensionConfig);
		snippetsProvider.refresh(false);
	}

	if (extensionConfig.onlyForActiveEditor) {
		onDidChangeActiveTextEditor = window.onDidChangeActiveTextEditor(onChangeActiveTextEditor);
		extensionContext.subscriptions.push(onDidChangeActiveTextEditor);
	}

	extensionContext.subscriptions.push(workspace.onDidChangeConfiguration(updateConfig, EXTENSION_NAME));
	extensionContext.subscriptions.push(insertSnippet, snippetsView, refresh, openSnippetsFile, snippetFromSelectionCommand, toggleOnlyForActiveEditor, toggleFlatten, useTreeView, useListView);
}

export function deactivate() { }
