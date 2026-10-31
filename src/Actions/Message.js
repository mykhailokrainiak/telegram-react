/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import AppStore from '../Stores/ApplicationStore';
import MessageStore from '../Stores/MessageStore';
import { clearOpenChatOptions } from './Client';
import i18n from 'i18next';
import TdLibController from '../Controllers/TdLibController';

/**
 * TDLib no longer sends can_be_edited, can_be_deleted_* etc. with each message; they come from
 * getMessageProperties. Copy them onto the stored messages so the existing can_be_* checks are exact.
 */
export async function loadMessageProperties(chatId, messageIds) {
    await Promise.all(
        messageIds.map(async messageId => {
            const message = MessageStore.get(chatId, messageId);
            if (!message || messageId <= 0) return;

            try {
                const properties = await TdLibController.send({
                    '@type': 'getMessageProperties',
                    chat_id: chatId,
                    message_id: messageId
                });
                delete properties['@type'];
                delete properties['@extra'];
                delete properties['@client_id'];
                Object.assign(message, properties, { properties_loaded: true });
            } catch (error) {
                console.error('[message] getMessageProperties failed', chatId, messageId, error);
            }
        })
    );
}

// Translations shown under messages: key `${chatId}_${messageId}` -> { loading, text, error }.
const translations = new Map();

export function getMessageTranslation(chatId, messageId) {
    return translations.get(`${chatId}_${messageId}`) || null;
}

function setMessageTranslation(chatId, messageId, translation) {
    const key = `${chatId}_${messageId}`;
    if (translation) {
        translations.set(key, translation);
    } else {
        translations.delete(key);
    }

    MessageStore.emit('clientUpdateMessageTranslation', { chatId, messageId });
}

export function getTranslationLanguage() {
    const language = i18n.language || navigator.language || 'en';

    return language.split('-')[0];
}

export async function translateMessage(chatId, messageId) {
    setMessageTranslation(chatId, messageId, { loading: true });

    try {
        const text = await TdLibController.send({
            '@type': 'translateMessageText',
            chat_id: chatId,
            message_id: messageId,
            to_language_code: getTranslationLanguage(),
            tone: ''
        });
        setMessageTranslation(chatId, messageId, { text });
    } catch (error) {
        setMessageTranslation(chatId, messageId, { error: (error && error.message) || 'Translation failed' });
    }
}

export function hideMessageTranslation(chatId, messageId) {
    setMessageTranslation(chatId, messageId, null);
}

// Voice/video message transcription; the result arrives in the content's speech_recognition_result.
export function recognizeSpeech(chatId, messageId) {
    return TdLibController.send({ '@type': 'recognizeSpeech', chat_id: chatId, message_id: messageId });
}

export async function sendBotStartMessage(chatId, botUserId, parameter) {
    clearOpenChatOptions();

    await AppStore.invokeScheduledAction(`clientUpdateClearHistory chatId=${chatId}`);
    return TdLibController.send({
        '@type': 'sendBotStartMessage',
        bot_user_id: botUserId,
        chat_id: chatId,
        parameter
    });
}

export function requestBlockSender(sender) {
    TdLibController.clientUpdate({
        '@type': 'clientUpdateRequestBlockSender',
        sender
    });
}

export function blockSender(sender) {
    toggleMessageSenderIsBlocked(sender, true);
}

export function unblockSender(sender) {
    toggleMessageSenderIsBlocked(sender, false);
}

function toggleMessageSenderIsBlocked(sender, isBlocked) {
    TdLibController.send({
        '@type': 'toggleMessageSenderIsBlocked',
        sender_id: sender,
        is_blocked: isBlocked
    });
}

export function openChatSelect(options) {
    TdLibController.clientUpdate({
        '@type': 'clientUpdateChatSelect',
        options
    });
}

export function closeChatSelect() {
    TdLibController.clientUpdate({
        '@type': 'clientUpdateChatSelect',
        options: null
    });
}

export function startMessageEditing(chatId, messageId) {
    TdLibController.clientUpdate({
        '@type': 'clientUpdateStartMessageEditing',
        chatId,
        messageId
    });
}

export function stopMessageEditing(chatId, messageId) {
    TdLibController.clientUpdate({
        '@type': 'clientUpdateStopMessageEditing',
        chatId,
        messageId
    });
}

export function viewMessages(chatId, messageIds, forceRead) {
    TdLibController.send({
        '@type': 'viewMessages',
        chat_id: chatId,
        message_ids: messageIds,
        force_read: forceRead
    });
}

export function pinMessage(chatId, messageId, disableNotification = false, onlyForSelf = false) {
    TdLibController.send({
        '@type': 'pinChatMessage',
        chat_id: chatId,
        message_id: messageId,
        disable_notification: disableNotification,
        only_for_self: onlyForSelf
    });
}

export function unpinMessage(chatId, messageId) {
    return TdLibController.send({
        '@type': 'unpinChatMessage',
        chat_id: chatId,
        message_id: messageId,
    });
}

export function unpinAllMessages(chatId) {
    return TdLibController.send({
        '@type': 'unpinAllChatMessages',
        chat_id: chatId
    });
}
