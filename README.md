## Snippets View

![Demo](https://raw.githubusercontent.com/usernamehw/vscode-snippets-view/master/img/demo.gif)

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
