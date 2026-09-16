<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Hjort Creations AB
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\DeckClipboard\Listener;

use OCA\DeckClipboard\AppInfo\Application;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Util;

/** @template-implements IEventListener<BeforeTemplateRenderedEvent> */
final class BeforeTemplateRenderedListener implements IEventListener {
	public function handle(Event $event): void {
		if (!($event instanceof BeforeTemplateRenderedEvent)) {
			return;
		}

		if (!$event->isLoggedIn() || $event->getResponse()->getApp() !== 'deck') {
			return;
		}

		Util::addStyle(Application::APP_ID, 'deck-clipboard');
		Util::addScript(Application::APP_ID, 'deck-clipboard');
	}
}
