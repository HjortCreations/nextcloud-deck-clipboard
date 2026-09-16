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
assert.equal(
	app.buildUploadUrl({ boardId: 3, cardId: 389 }),
	'/nextcloud/ocs/v2.php/apps/deck/api/v1.0/cards/389/attachment?boardId=3&format=json',
)

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
