import { TextEditor } from 'vscode';
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
	flattenedSnippets: Snippet[];
	snippetsFromFile: {
		[absolutePath: string]: Snippet[];
	};
	allSnippetFiles: SnippetFile[];
}
