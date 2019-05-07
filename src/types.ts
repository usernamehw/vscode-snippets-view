import { TextEditor, Uri } from 'vscode';
import { Snippet, SnippetFile } from './provider';

export interface ISnippet {
	prefix: string;
	body: string | string[];
	description?: string;
	scope?: string;
}

export interface ISnippetFile {
	[key: string]: ISnippet;
}
export interface IConfig {
	includeExtensionSnippets: boolean;
	focusEditorAfterInsertion: boolean;
	flatten: boolean;
	onlyForActiveEditor: boolean;
	showScope: boolean;
	excludeRegex: string;
	snippetFromSelectionIncludeDescription: boolean;

	_excludeRegex?: RegExp;
	_activeTextEditor?: TextEditor;
}
export enum SnippetFileExtensions {
	json = '.json',
	codeSnippets = '.code-snippets',
}
export interface SessionCache {
	snippetsFromFile: {
		[absolutePathAndLanguage: string]: Snippet[];
	};
	allSnippetFiles: SnippetFile[];
}

export interface IExtension {
	id: string;
	packageJSON: IPackageJSON;
}

interface IPackageJSON {
	contributes: IContributes;
	extensionLocation: Uri;
}

interface IContributes {
	snippets: SnippetContribution[];
}

interface SnippetContribution {
	language: string;
	path: string;
}
