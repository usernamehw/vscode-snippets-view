## 0.2.3 `05 Mar 2019`

- ✨ Added menu entry to quickly switch setting `flatten`
- ✨ Added setting `snippets-view.snippetFromSelectionIncludeDescription`
- ✨ Use snippet while creating new snippet from selection
- ✨ Created one-line-length snippet should be a string (not an array)

## 0.2.2 `02 Mar 2019`

- ✨ Added menu entry to quickly switch setting `onlyForActiveEditor`
- 🐛 Create snippet from selection should care about start/end selection characters and not just be using the entire lines.

## 0.2.1 `26 Feb 2019`

- ✨ Create snippet from selection `snippets-view.createSnippetFromSelection`

## 0.2.0 `18 Feb 2019`

- ✨ Button `Collapse All`
- ✨ Prototype extension contributed snippets (opt-in `snippets-view.includeExtensionSnippets`)

## 0.1.2 `14 Jan 2019`

- 🐛 Absence of `.vscode` folder should not throw an error

## 0.1.1 `12 Jan 2019`

- ✨ Add a setting `showScope`
- 🐛 Changing `onlyForActiveEditor` should update active editor and create/dispose event listener
- 🐛 When activeTextEditor changes - event should not be sent if language was the same

## 0.1.0 `11 Jan 2019`

- ✨ Add a setting to show only snippets for active text editor `onlyForActiveEditor` (works well with `flatten`)
- 🐛 Delay for opening snippets file should only be in case of not yet loaded symbols list

## 0.0.8 `07 Jan 2019`

- ✨ Add a setting to exclude snippets from tree view `excludeRegex`

## 0.0.7 `06 Jan 2019`

- 🐛 ContextMenu on Snippet - it should wait on the first file opening until the document is loaded before scrolling
- 🔨 Bundle extension with [webpack](https://github.com/Microsoft/vscode-extension-samples/tree/master/webpack-sample)
- 🔨 Compress `.svg` images, compress extension icon, remove some runaway `.test` files from extension

## 0.0.6 `05 Jan 2019`

- ✨ Add Setting `snippets-view.flatten`
- ✨ ContextMenu: Open snippets file from any snippet
- ✨ ContextMenu: Openining snippet scrolls it into view

## 0.0.5 `04 Jan 2019`

- ✨ Add icons (`.json`) to snippet files
- 🔨 Stricter **TSLint** rules, refactor

## 0.0.4 `03 Jan 2019`

- ✨ Context Menu: Open the corresponding snippets file

## 0.0.3 `03 Jan 2019`

- ✨ Include [project-level snippets](https://github.com/Microsoft/vscode/issues/8102#issuecomment-423476360)
-  Add Extension icon

## 0.0.2 `02 Jan 2019`

- ✨ Add Refresh button **↻**

## 0.0.1 `02 Jan 2019`

- Initial release
