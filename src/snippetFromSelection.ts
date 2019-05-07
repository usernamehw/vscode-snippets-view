import * as vscode from 'vscode';

const TAB_SYMBOL = '	';
const SPACE_SYMBOL = ' ';
const indentTabRegex = new RegExp(`^${TAB_SYMBOL}+`);
const indentSpaceRegex = new RegExp(`^${SPACE_SYMBOL}+`);

function snippetizeLine(text: string, tabSize: number): string {
	let result = text;

	const indentTabMatch = result.match(indentTabRegex);
	if (indentTabMatch) {
		result = result.replace(indentTabRegex, '\t'.repeat(indentTabMatch[0].length));
	}

	const indentSpaceMatch = result.match(indentSpaceRegex);
	if (indentSpaceMatch) {
		result = result.replace(indentSpaceRegex, '\t'.repeat(indentSpaceMatch[0].length / tabSize));
	}

	return result
		.replace(/\\/g, '\\\\')
		.replace(/\$/g, '\\\\$')
		.replace(/\}/g, '\\\\}');
}

export function snippetFromSelection(editor: vscode.TextEditor, includeDescription: boolean) {
	const { document } = editor;
	const { selection } = editor;
	const tabSize = editor.options.tabSize as number;
	let body: string | string[] = [];

	for (let i = selection.start.line; i <= selection.end.line; i++) {
		const line = document.lineAt(i);
		let lineText = line.text;
		if (i === selection.start.line) {
			lineText = lineText.slice(selection.start.character);
		} else if (i === selection.end.line) {
			lineText = lineText.slice(0, selection.end.character);
		}
		body.push(snippetizeLine(lineText, tabSize));
	}

	if (body.length === 1) {
		body = body[0];
	}
	if (Array.isArray(body)) {
		body = body.map(line => JSON.stringify(line));
		body[0] = `\t\t\t${body[0]}`;
		body = `[\n${body.join(',\n\t\t\t')}\n\t\t]`;
	} else {
		body = `${JSON.stringify(body)}`;
	}

	let snippet = '{\n';
	snippet += '\t"\${1:untitled}": {\n';
	snippet += `\t\t"scope": "\${3:${editor.document.languageId}}",\n`;
	snippet += '\t\t"prefix": "${2:${1:untitled}}",\n';// tslint:disable-line
	snippet += `\t\t"body": ${body},\n`;
	if (includeDescription) {
		snippet += '\t\t"description": "${4:description}",\n';// tslint:disable-line
	}
	snippet += '\t},\n';
	snippet += '}';

	vscode.workspace.openTextDocument({ language: 'jsonc' }).then(newDocument => {
		vscode.window.showTextDocument(newDocument).then(() => {
			vscode.commands.executeCommand('editor.action.insertSnippet', {
				snippet,
			});
		});
	});
}
