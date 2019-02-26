## Snippets View

![Demo](img/demo.gif)

Possible usages of this extension:

* For less useful snippets:

	Define a snippet with empty `prefix` (and it will not be mixed in autocomplete):

	```json
	"something": {
		"prefix": "",
		"body": "something"
	},
	```

* Quickly finding file where the snippet is defined (global/project/extension):

	Entry in context menu should navigate to the snippet definition.

## Additional commands

### Create snippet from selection

`snippets-view.createSnippetFromSelection`

## TODO

- [x] Refresh button
- [x] Include [project-level snippets](https://github.com/Microsoft/vscode/issues/8102#issuecomment-423476360)
- [x] ContextMenu: Open the corresponding snippets file
- [x] Add Theme `.json` icons to Snippet Files
- [x] Setting: Flatten snippets (Don't show the origin files inside View)
- [x] A way to exclude snippets from view
- [x] Setting: Show only appropriate snippets (if active editor language is TypeScript - then show only TypeScript snippets & global snippets)
- [x] Setting: Do not show `scope`
- [ ] Include snippets contributed by extensions
- [ ] Sorting of snippets
- [ ] Filter snippets (Always visible input is blocked by [#50062 Add filter/search box api support to custom tree views](https://github.com/Microsoft/vscode/issues/50062))
