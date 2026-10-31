/*
 * Message reactions (TDLib reactionType*, messageReactions, availableReactions).
 */

import { isServiceMessage } from './ServiceMessage';
import TdLibController from '../Controllers/TdLibController';

// custom_emoji_id -> the plain emoji the custom emoji stands for (shown in place of the custom image).
const customEmojiCache = new Map();
const pendingCustomEmoji = new Set();

export function getReactionKey(type) {
    if (!type) return '';

    switch (type['@type']) {
        case 'reactionTypeEmoji':
            return 'e_' + type.emoji;
        case 'reactionTypeCustomEmoji':
            return 'c_' + type.custom_emoji_id;
        case 'reactionTypePaid':
            return 'paid';
        default:
            return type['@type'];
    }
}

export function getReactionEmoji(type) {
    if (!type) return '';

    switch (type['@type']) {
        case 'reactionTypeEmoji':
            return type.emoji;
        case 'reactionTypeCustomEmoji':
            return customEmojiCache.get(String(type.custom_emoji_id)) || '⭐';
        case 'reactionTypePaid':
            return '⭐';
        default:
            return '';
    }
}

// Resolves custom emoji reactions to plain emoji; calls onLoaded once something new is known.
export async function loadCustomEmojiReactions(types, onLoaded) {
    const ids = (types || [])
        .filter(x => x && x['@type'] === 'reactionTypeCustomEmoji')
        .map(x => String(x.custom_emoji_id))
        .filter(x => !customEmojiCache.has(x) && !pendingCustomEmoji.has(x));
    if (!ids.length) return;

    ids.forEach(x => pendingCustomEmoji.add(x));
    try {
        const { stickers } = await TdLibController.send({
            '@type': 'getCustomEmojiStickers',
            custom_emoji_ids: ids
        });
        (stickers || []).forEach(sticker => {
            const fullType = sticker.full_type || {};
            if (fullType.custom_emoji_id) {
                customEmojiCache.set(String(fullType.custom_emoji_id), sticker.emoji || '⭐');
            }
        });
        if (onLoaded) onLoaded();
    } catch (error) {
        console.error('[reactions] getCustomEmojiStickers failed', error);
    } finally {
        ids.forEach(x => pendingCustomEmoji.delete(x));
    }
}

export function getMessageReactions(message) {
    if (!message) return [];

    const { interaction_info } = message;
    if (!interaction_info || !interaction_info.reactions) return [];

    return interaction_info.reactions.reactions || [];
}

export function canReactToMessage(message) {
    if (!message) return false;
    if (message.id <= 0 || message.sending_state) return false;

    return !isServiceMessage(message);
}

export async function toggleReaction(chatId, messageId, type, isChosen) {
    if (!type || type['@type'] === 'reactionTypePaid') return;

    if (isChosen) {
        await TdLibController.send({
            '@type': 'removeMessageReaction',
            chat_id: chatId,
            message_id: messageId,
            reaction_type: type
        });
        return;
    }

    try {
        await TdLibController.send({
            '@type': 'addMessageReaction',
            chat_id: chatId,
            message_id: messageId,
            reaction_type: type,
            is_big: false,
            update_recent_reactions: true
        });
    } catch (error) {
        // Over the chat's reaction limit (one reaction without Premium): replace instead of add.
        await TdLibController.send({
            '@type': 'setMessageReactions',
            chat_id: chatId,
            message_id: messageId,
            reaction_types: [type],
            is_big: false
        });
    }
}

export async function getAvailableReactions(chatId, messageId) {
    try {
        return await TdLibController.send({
            '@type': 'getMessageAvailableReactions',
            chat_id: chatId,
            message_id: messageId,
            row_size: 8
        });
    } catch (error) {
        return null;
    }
}

// Newest message first; the caller jumps to the oldest one.
export async function getUnreadReactionMessageIds(chatId) {
    const result = await TdLibController.send({
        '@type': 'searchChatMessages',
        chat_id: chatId,
        query: '',
        sender_id: null,
        from_message_id: 0,
        offset: 0,
        limit: 100,
        filter: { '@type': 'searchMessagesFilterUnreadReaction' }
    });

    return (result.messages || []).map(x => x.id);
}
