/**
 * SPDX-FileCopyrightText: 2026 Hjort Creations AB
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

(function(root) {
	'use strict'

	const ROUTE_PATTERN = /\/apps\/deck\/board\/(\d+)\/card\/(\d+)(?:\/|$)/
	const MIME_EXTENSIONS = Object.freeze({
		'image/avif': 'avif',
		'image/bmp': 'bmp',
		'image/gif': 'gif',
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/svg+xml': 'svg',
		'image/tiff': 'tif',
		'image/webp': 'webp',
	})
	const STATUS_ID = 'deckclipboard-status'
	let uploadInProgress = false
	let statusTimer = null

	function parseDeckCardContext(pathname) {
		const match = String(pathname || '').match(ROUTE_PATTERN)
		if (!match) {
			return null
		}

		return {
			boardId: Number.parseInt(match[1], 10),
			cardId: Number.parseInt(match[2], 10),
		}
	}

	function getClipboardImages(clipboardData) {
		if (!clipboardData) {
			return []
		}

		const fromItems = Array.from(clipboardData.items || [])
			.filter((item) => item.kind === 'file' && /^image\//i.test(item.type || ''))
			.map((item) => item.getAsFile())
			.filter(Boolean)

		if (fromItems.length > 0) {
			return fromItems
		}

		return Array.from(clipboardData.files || [])
			.filter((file) => /^image\//i.test(file.type || ''))
	}

	function pad(value, length = 2) {
		return String(value).padStart(length, '0')
	}

	function extensionFor(file) {
		const mimeType = String(file && file.type || '').toLowerCase()
		if (MIME_EXTENSIONS[mimeType]) {
			return MIME_EXTENSIONS[mimeType]
		}

		const subtype = mimeType.replace(/^image\//, '').split(';')[0]
			.replace('+xml', '')
			.replace(/[^a-z0-9]/g, '')
		return subtype || 'img'
	}

	function buildFilename(file, index = 0, now = new Date()) {
		const stamp = [
			now.getFullYear(),
			pad(now.getMonth() + 1),
			pad(now.getDate()),
		].join('') + '-' + [
			pad(now.getHours()),
			pad(now.getMinutes()),
			pad(now.getSeconds()),
			pad(now.getMilliseconds(), 3),
		].join('')
		const suffix = index > 0 ? `-${index + 1}` : ''
		return `clipboard-${stamp}${suffix}.${extensionFor(file)}`
	}

	function getNextcloudRoot() {
		if (root.OC && typeof root.OC.getRootPath === 'function') {
			return root.OC.getRootPath()
		}
		if (root.OC && typeof root.OC.webroot === 'string') {
			return root.OC.webroot
		}
		return ''
	}

	function buildUploadUrl(context) {
		const rootPath = getNextcloudRoot().replace(/\/$/, '')
		return `${rootPath}/ocs/v2.php/apps/deck/api/v1.0/cards/${context.cardId}/attachment?boardId=${context.boardId}&format=json`
	}

	/**
	 * Describes what to put into the editor for an uploaded attachment, or returns null when
	 * the response names no file. The URL is absolute, because the Text editor treats a
	 * relative image source as a file path in the user's storage. Without a preview the
	 * preview route answers 404, so the entry becomes a plain link to the file.
	 */
	function buildEditorEntry(attachment, name) {
		const data = attachment.extendedData || {}
		if (!data.fileid) {
			return null
		}

		const base = `${root.location.origin}${getNextcloudRoot().replace(/\/$/, '')}/index.php`
		const fileId = encodeURIComponent(data.fileid)
		return data.hasPreview
			? { name, image: true, url: `${base}/core/preview?fileId=${fileId}&x=600&y=600&a=true` }
			: { name, image: false, url: `${base}/f/${fileId}` }
	}

	// The names come from buildFilename() and the URLs from buildEditorEntry(), so only "&" needs escaping.
	function buildEditorContent(entries) {
		return {
			html: entries.map(({ name, image, url }) => {
				const escaped = url.replace(/&/g, '&amp;')
				return `<a href="${escaped}">${image ? `<img src="${escaped}" alt="${name}">` : name}</a>`
			}).join(''),
			text: entries.map(({ name, image, url }) => `${image ? '!' : ''}[${name}](${url})`).join('\n'),
		}
	}

	/**
	 * Hands the uploaded images to the focused editor as a synthetic paste: the description
	 * editor reads the HTML, the Markdown fallback editor reads the text. The comment field
	 * has no paste handler of its own, so it gets the Markdown typed in at the cursor.
	 * Returns false when the editor lost focus during the upload or did not take the content.
	 * A paste replaces the selection, so text selected only after the original paste also
	 * cancels the insertion.
	 */
	function insertIntoEditor(editor, entries, hadSelection) {
		if (!editor || entries.length === 0 || document.activeElement !== editor) {
			return false
		}
		if (!hadSelection && !root.getSelection().isCollapsed) {
			return false
		}

		try {
			const content = buildEditorContent(entries)
			const clipboardData = new root.DataTransfer()
			clipboardData.setData('text/html', content.html)
			clipboardData.setData('text/plain', content.text)
			const pasteHandled = !editor.dispatchEvent(new root.ClipboardEvent('paste', {
				clipboardData,
				bubbles: true,
				cancelable: true,
			}))
			return pasteHandled
				|| (editor.isContentEditable === true && document.execCommand('insertText', false, content.text))
		} catch (error) {
			// The browser cannot construct a DataTransfer or a ClipboardEvent.
			return false
		}
	}

	/**
	 * Runs Deck's own fetchAttachments action, which reloads the attachment list of the card
	 * and its attachment count and cover on the board. Deck has no public API for this, so
	 * the store is reached through Vue internals: Vuex on Deck 1.18, Pinia on Deck 1.19,
	 * where 1.19.0 still runs on Vue 2 and later releases on Vue 3.
	 * Returns false when the store is not there or the request fails.
	 */
	async function refreshAttachments(cardId) {
		try {
			const vue3Root = document.getElementById('content')
			const vue2Root = document.getElementById('content-vue')
			const vue2 = vue2Root && vue2Root.__vue__
			const pinia = vue3Root && vue3Root.__vue_app__
				? vue3Root.__vue_app__.config.globalProperties.$pinia
				: vue2 && vue2.$pinia
			const store = pinia && pinia._s.get('attachment')
			const fetching = store
				? store.fetchAttachments(cardId)
				: vue2.$store.dispatch('fetchAttachments', cardId)
			// Vuex returns undefined instead of throwing when the action does not exist.
			if (!fetching || typeof fetching.then !== 'function') {
				throw new Error('Deck store has no fetchAttachments action')
			}
			await fetching
			return true
		} catch (error) {
			console.warn('deckclipboard: could not refresh the attachments through the Deck store, offering a manual reload instead.', error)
			return false
		}
	}

	function showStatus(message, kind = 'info', offerReload = false) {
		if (statusTimer !== null) {
			root.clearTimeout(statusTimer)
			statusTimer = null
		}

		let status = document.getElementById(STATUS_ID)
		if (!status) {
			status = document.createElement('div')
			status.id = STATUS_ID
			status.setAttribute('role', 'status')
			status.setAttribute('aria-live', 'polite')
			document.body.appendChild(status)
		}
		status.dataset.kind = kind
		status.replaceChildren()

		const text = document.createElement('span')
		text.textContent = message
		status.appendChild(text)

		if (offerReload) {
			const button = document.createElement('button')
			button.type = 'button'
			button.textContent = 'Reload'
			button.addEventListener('click', () => root.location.reload())
			status.appendChild(button)
		}

		if (!offerReload) {
			statusTimer = root.setTimeout(() => {
				status.remove()
				statusTimer = null
			}, kind === 'error' ? 8000 : 3000)
		}
	}

	function isTextEditingTarget(target) {
		if (!target || !(target instanceof Element)) {
			return false
		}
		// isContentEditable also covers contenteditable="plaintext-only", which Deck's comment field uses.
		return target.matches('input, textarea') || target.isContentEditable === true
	}

	async function responseError(response) {
		let message = ''
		try {
			const payload = await response.clone().json()
			message = payload && payload.ocs && payload.ocs.meta && payload.ocs.meta.message
				|| payload && payload.message
				|| ''
		} catch (error) {
			// The response was not JSON; fall back to status text below.
		}
		return message || response.statusText || `HTTP ${response.status}`
	}

	async function uploadImage(file, filename, context) {
		if (!root.OC || !root.OC.requestToken) {
			throw new Error('The Nextcloud request token is missing. Reload the page and try again.')
		}

		const formData = new FormData()
		formData.append('cardId', String(context.cardId))
		formData.append('type', 'file')
		formData.append('file', file, filename)

		const headers = {
			Accept: 'application/json',
			'OCS-APIRequest': 'true',
			'X-Requested-With': 'XMLHttpRequest',
		}
		headers.requesttoken = root.OC.requestToken

		const response = await root.fetch(buildUploadUrl(context), {
			method: 'POST',
			headers,
			body: formData,
			credentials: 'same-origin',
		})

		if (!response.ok) {
			throw new Error(await responseError(response))
		}
		try {
			const payload = await response.json()
			if (payload && payload.ocs && payload.ocs.meta && payload.ocs.meta.status === 'failure') {
				throw new Error(payload.ocs.meta.message || 'Deck rejected the attachment.')
			}
			return payload && payload.ocs ? payload.ocs.data : payload
		} catch (error) {
			if (error instanceof SyntaxError) {
				return null
			}
			throw error
		}
	}

	async function handlePaste(event) {
		const context = parseDeckCardContext(root.location.pathname)
		const images = getClipboardImages(event.clipboardData)
		if (!context || images.length === 0) {
			return
		}

		event.preventDefault()
		event.stopImmediatePropagation()
		if (uploadInProgress) {
			showStatus('An image upload is already in progress.', 'error')
			return
		}

		const editor = isTextEditingTarget(event.target) ? document.activeElement : null
		const hadSelection = !root.getSelection().isCollapsed
		const entries = []
		let stored = 0
		let failure = null
		uploadInProgress = true
		showStatus(images.length === 1 ? 'Uploading image …' : `Uploading ${images.length} images …`)
		try {
			const now = new Date()
			try {
				for (let index = 0; index < images.length; index += 1) {
					const name = buildFilename(images[index], index, now)
					const attachment = await uploadImage(images[index], name, context)
					stored += 1
					const entry = attachment && buildEditorEntry(attachment, name)
					if (entry) {
						entries.push(entry)
					}
				}
			} catch (error) {
				failure = error
			}

			// The user may have closed the card or left the board while the upload ran.
			const open = parseDeckCardContext(root.location.pathname)
			const cardStillOpen = Boolean(open) && open.cardId === context.cardId
			const boardStillOpen = new RegExp(`/apps/deck/board/${context.boardId}(?:/|$)`).test(root.location.pathname)
			const inserted = !failure && cardStillOpen && entries.length === images.length
				&& insertIntoEditor(editor, entries, hadSelection)
			const refreshed = stored === 0 || !boardStillOpen || await refreshAttachments(context.cardId)

			let message = (images.length === 1 ? 'Image' : `${images.length} images`)
				+ (inserted ? ' uploaded and inserted.' : ' uploaded.')
			if (failure) {
				message = stored > 0
					? `${stored} of ${images.length} images uploaded, then the upload failed: ${failure.message}`
					: `Image upload failed: ${failure.message}`
			}
			if (!refreshed) {
				message += editor ? ' Reload after saving your text changes.' : ' Reload to update the attachment list.'
			}
			showStatus(message, failure ? 'error' : 'success', !refreshed)
		} finally {
			uploadInProgress = false
		}
	}

	const exported = {
		buildEditorContent,
		buildEditorEntry,
		buildFilename,
		buildUploadUrl,
		extensionFor,
		getClipboardImages,
		insertIntoEditor,
		parseDeckCardContext,
		refreshAttachments,
		uploadImage,
	}

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = exported
		return
	}

	root.OCA = root.OCA || {}
	root.OCA.DeckClipboard = exported
	document.addEventListener('paste', handlePaste, true)
})(typeof window !== 'undefined' ? window : globalThis)
