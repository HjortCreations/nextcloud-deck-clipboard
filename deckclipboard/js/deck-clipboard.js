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
		return target.matches('input, textarea, [contenteditable="true"], [contenteditable=""]')
			|| Boolean(target.closest('[contenteditable="true"], [contenteditable=""]'))
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

		uploadInProgress = true
		showStatus(images.length === 1 ? 'Uploading image …' : `Uploading ${images.length} images …`)
		try {
			const now = new Date()
			for (let index = 0; index < images.length; index += 1) {
				await uploadImage(images[index], buildFilename(images[index], index, now), context)
			}

			const textWasBeingEdited = isTextEditingTarget(event.target)
			if (textWasBeingEdited) {
				showStatus(
					images.length === 1
						? 'Image uploaded. Reload after saving your text changes.'
						: `${images.length} images uploaded. Reload after saving your text changes.`,
					'success',
					true,
				)
			} else {
				showStatus(images.length === 1 ? 'Image uploaded.' : `${images.length} images uploaded.`)
				root.setTimeout(() => root.location.reload(), 700)
			}
		} catch (error) {
			showStatus(`Image upload failed: ${error.message}`, 'error')
		} finally {
			uploadInProgress = false
		}
	}

	const exported = {
		buildFilename,
		buildUploadUrl,
		extensionFor,
		getClipboardImages,
		parseDeckCardContext,
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
