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
	focusEditorAfterInsertion: boolean;
	flatten: boolean;
	excludeRegex: 'string';

	_excludeRegex: RegExp;
}
export enum SnippetFileExtensions {
	json = '.json',
	codeSnippets = '.code-snippets',
}
