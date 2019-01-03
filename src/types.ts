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
}
export enum SnippetFileExtensions {
	json = '.json',
	codeSnippets = '.code-snippets'
}
