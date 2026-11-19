/**
 * SPDX-FileCopyrightText: 2026 Hjort Creations AB
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const app = require(path.join(__dirname, '..', 'deckclipboard', 'js', 'deck-clipboard.js'))

assert.deepEqual(
	app.parseDeckCardContext('/apps/deck/board/3/card/389'),
	{ boardId: 3, cardId: 389 },
)
assert.deepEqual(
	app.parseDeckCardContext('/nextcloud/apps/deck/board/11/card/42/'),
	{ boardId: 11, cardId: 42 },
)
assert.equal(app.parseDeckCardContext('/apps/deck/board/3'), null)
assert.equal(app.parseDeckCardContext('/apps/files/'), null)

assert.equal(app.extensionFor({ type: 'image/jpeg' }), 'jpg')
assert.equal(app.extensionFor({ type: 'image/svg+xml' }), 'svg')
assert.equal(app.extensionFor({ type: 'image/x-special' }), 'xspecial')

const fixedTime = new Date(2026, 8, 15, 19, 58, 7, 42)
assert.equal(
	app.buildFilename({ type: 'image/png' }, 0, fixedTime),
	'clipboard-20260915-195807042.png',
)
assert.equal(
	app.buildFilename({ type: 'image/webp' }, 1, fixedTime),
	'clipboard-20260915-195807042-2.webp',
)

const png = { type: 'image/png', marker: 'png' }
const text = { type: 'text/plain', marker: 'text' }
const clipboardData = {
	items: [
		{ kind: 'string', type: 'text/plain', getAsFile: () => text },
		{ kind: 'file', type: 'image/png', getAsFile: () => png },
	],
}
assert.deepEqual(app.getClipboardImages(clipboardData), [png])
assert.deepEqual(app.getClipboardImages({ files: [text, png] }), [png])
assert.deepEqual(app.getClipboardImages(null), [])

globalThis.OC = {
	getRootPath: () => '/nextcloud',
	requestToken: 'test-token',
}
globalThis.location = { origin: 'https://cloud.example.org' }
assert.equal(
	app.buildUploadUrl({ boardId: 3, cardId: 389 }),
	'/nextcloud/ocs/v2.php/apps/deck/api/v1.0/cards/389/attachment?boardId=3&format=json',
)

assert.equal(
	app.buildPreviewUrl({ id: 7, cardId: 389, extendedData: { fileid: 1234 } }),
	'https://cloud.example.org/nextcloud/index.php/core/preview?fileId=1234&x=600&y=600&a=true',
)
assert.equal(
	app.buildPreviewUrl({ id: 7, cardId: 389, extendedData: {} }),
	'https://cloud.example.org/nextcloud/index.php/apps/deck/cards/389/attachment/7',
)
assert.equal(
	app.buildPreviewUrl({ id: 7, cardId: 389, extendedData: { fileid: '1"><script>' } }),
	'https://cloud.example.org/nextcloud/index.php/core/preview?fileId=1%22%3E%3Cscript%3E&x=600&y=600&a=true',
)

assert.deepEqual(
	app.buildEditorContent([
		{ name: 'clipboard-a.png', url: '/preview?fileId=1&x=600' },
		{ name: 'clipboard-b.png', url: '/preview?fileId=2&x=600' },
	]),
	{
		html: '<a href="/preview?fileId=1&amp;x=600"><img src="/preview?fileId=1&amp;x=600" alt="clipboard-a.png"></a>'
			+ '<a href="/preview?fileId=2&amp;x=600"><img src="/preview?fileId=2&amp;x=600" alt="clipboard-b.png"></a>',
		text: '![clipboard-a.png](/preview?fileId=1&x=600)\n![clipboard-b.png](/preview?fileId=2&x=600)',
	},
)

globalThis.DataTransfer = class {
	constructor() {
		this.data = {}
	}

	setData(type, value) {
		this.data[type] = value
	}
}
globalThis.ClipboardEvent = class {
	constructor(type, init) {
		Object.assign(this, init, { type })
	}
}
const typed = []
globalThis.document = {
	activeElement: null,
	execCommand: (command, showUi, value) => {
		typed.push([command, value])
		return true
	},
}
function fakeEditor({ handlesPaste, isContentEditable }) {
	const editor = {
		isContentEditable,
		pasted: null,
		// dispatchEvent() returns false when a listener called preventDefault().
		dispatchEvent(event) {
			editor.pasted = event.clipboardData.data
			return !handlesPaste
		},
	}
	return editor
}
const uploaded = [{ name: 'clipboard-a.png', url: '/preview?fileId=1' }]

const descriptionEditor = fakeEditor({ handlesPaste: true, isContentEditable: true })
document.activeElement = descriptionEditor
assert.equal(app.insertIntoEditor(descriptionEditor, uploaded), true)
assert.equal(
	descriptionEditor.pasted['text/html'],
	'<a href="/preview?fileId=1"><img src="/preview?fileId=1" alt="clipboard-a.png"></a>',
)
assert.equal(descriptionEditor.pasted['text/plain'], '![clipboard-a.png](/preview?fileId=1)')
assert.deepEqual(typed, [])

const commentField = fakeEditor({ handlesPaste: false, isContentEditable: true })
document.activeElement = commentField
assert.equal(app.insertIntoEditor(commentField, uploaded), true)
assert.deepEqual(typed, [['insertText', '![clipboard-a.png](/preview?fileId=1)']])

const titleInput = fakeEditor({ handlesPaste: false, isContentEditable: false })
document.activeElement = titleInput
assert.equal(app.insertIntoEditor(titleInput, uploaded), false)
assert.equal(typed.length, 1)

const blurredEditor = fakeEditor({ handlesPaste: true, isContentEditable: true })
assert.equal(app.insertIntoEditor(blurredEditor, uploaded), false)
assert.equal(blurredEditor.pasted, null)
assert.equal(app.insertIntoEditor(null, uploaded), false)

let capturedRequest = null
globalThis.fetch = async (url, options) => {
	capturedRequest = { url, options }
	return {
		ok: true,
		json: async () => ({ ocs: { meta: { status: 'ok' }, data: { id: 7 } } }),
	}
}

app.uploadImage(new Blob(['image'], { type: 'image/png' }), 'clipboard-test.png', { boardId: 3, cardId: 389 })
	.then((result) => {
		assert.deepEqual(result, { id: 7 })
		assert.equal(capturedRequest.options.method, 'POST')
		assert.equal(capturedRequest.options.credentials, 'same-origin')
		assert.equal(capturedRequest.options.headers.requesttoken, 'test-token')
		assert.equal(capturedRequest.options.body.get('cardId'), '389')
		assert.equal(capturedRequest.options.body.get('type'), 'file')
		assert.equal(capturedRequest.options.body.get('file').name, 'clipboard-test.png')
		console.log('deck-clipboard tests: OK')
	})
	.catch((error) => {
		console.error(error)
		process.exitCode = 1
	})
