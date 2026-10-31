/*
 * Compatibility layer between the TDLib 1.8.0 API this app was written for
 * and the current TDLib API (1.8.69+).
 *
 * toTd()   rewrites outgoing requests from the old shape to the new one.
 * fromTd() rewrites incoming updates and results from the new shape to the old one,
 *          keeping the new fields, so the rest of the app can keep using the old field names.
 */

const EDITABLE_CONTENT = new Set([
    'messageText',
    'messagePhoto',
    'messageVideo',
    'messageDocument',
    'messageAudio',
    'messageAnimation'
]);

const INPUT_MEDIA = {
    inputMessagePhoto: ['photo', 'inputPhoto', ['thumbnail', 'added_sticker_file_ids', 'width', 'height']],
    inputMessageVideo: [
        'video',
        'inputVideo',
        ['thumbnail', 'added_sticker_file_ids', 'duration', 'width', 'height', 'supports_streaming']
    ],
    inputMessageAnimation: [
        'animation',
        'inputAnimation',
        ['thumbnail', 'added_sticker_file_ids', 'duration', 'width', 'height']
    ],
    inputMessageAudio: ['audio', 'inputAudio', ['album_cover_thumbnail', 'duration', 'title', 'performer']],
    inputMessageDocument: ['document', 'inputDocument', ['thumbnail', 'disable_content_type_detection']],
    inputMessageSticker: ['sticker', 'inputSticker', ['thumbnail', 'width', 'height']],
    inputMessageVideoNote: ['video_note', 'inputVideoNote', ['thumbnail', 'duration', 'length']],
    inputMessageVoiceNote: ['voice_note', 'inputVoiceNote', ['duration', 'waveform']]
};

function formattedText(text) {
    if (text && typeof text === 'object') return text;
    return { '@type': 'formattedText', text: text || '', entities: [] };
}

function plainText(text) {
    if (text && typeof text === 'object') return text.text || '';
    return text || '';
}

function threadTopic(messageThreadId) {
    return messageThreadId ? { '@type': 'messageTopicThread', message_thread_id: messageThreadId } : null;
}

function convertOut(obj) {
    switch (obj['@type']) {
        case 'setTdlibParameters': {
            if (obj.parameters) {
                const { parameters } = obj;
                delete obj.parameters;
                delete parameters['@type'];
                Object.assign(obj, parameters);
            }
            break;
        }
        case 'chatListFilter': {
            obj['@type'] = 'chatListFolder';
            obj.chat_folder_id = obj.chat_filter_id;
            delete obj.chat_filter_id;
            break;
        }
        case 'sendMessage':
        case 'sendMessageAlbum':
        case 'sendInlineQueryResultMessage': {
            if (obj.reply_to_message_id) {
                obj.reply_to = { '@type': 'inputMessageReplyToMessage', message_id: obj.reply_to_message_id };
            }
            obj.topic_id = threadTopic(obj.message_thread_id);
            delete obj.reply_to_message_id;
            delete obj.message_thread_id;
            break;
        }
        case 'forwardMessages': {
            delete obj.only_preview;
            break;
        }
        case 'viewMessages':
        case 'sendChatAction':
        case 'setChatDraftMessage':
        case 'getChatMessageCount':
        case 'searchChatMessages':
        case 'chatMembersFilterMention': {
            if (obj['@type'] !== 'viewMessages') {
                obj.topic_id = threadTopic(obj.message_thread_id);
            }
            delete obj.message_thread_id;
            break;
        }
        case 'draftMessage': {
            if (obj.reply_to_message_id) {
                obj.reply_to = { '@type': 'inputMessageReplyToMessage', message_id: obj.reply_to_message_id };
            }
            if (obj.input_message_text) {
                obj.content = obj.input_message_text;
            }
            delete obj.reply_to_message_id;
            delete obj.input_message_text;
            break;
        }
        case 'searchMessages': {
            // TDLib now pages with an opaque offset string; restart from the beginning.
            obj.offset = '';
            delete obj.offset_date;
            delete obj.offset_chat_id;
            delete obj.offset_message_id;
            break;
        }
        case 'inputMessageText': {
            if (obj.disable_web_page_preview !== undefined) {
                obj.link_preview_options = {
                    '@type': 'linkPreviewOptions',
                    is_disabled: Boolean(obj.disable_web_page_preview)
                };
                delete obj.disable_web_page_preview;
            }
            break;
        }
        case 'inputMessagePoll': {
            obj.question = formattedText(obj.question);
            obj.options = (obj.options || []).map(x => ({ '@type': 'inputPollOption', text: formattedText(x) }));
            const type = obj.type || {};
            if (type['@type'] === 'pollTypeQuiz') {
                obj.type = {
                    '@type': 'inputPollTypeQuiz',
                    correct_option_ids: [type.correct_option_id],
                    explanation: type.explanation
                };
            } else {
                obj.allows_multiple_answers = Boolean(type.allow_multiple_answers);
                obj.type = { '@type': 'inputPollTypeRegular' };
            }
            break;
        }
        case 'toggleMessageSenderIsBlocked': {
            obj['@type'] = 'setMessageSenderBlockList';
            obj.block_list = obj.is_blocked ? { '@type': 'blockListMain' } : null;
            delete obj.is_blocked;
            break;
        }
        case 'getBackgrounds': {
            obj['@type'] = 'getInstalledBackgrounds';
            break;
        }
        case 'uploadFile': {
            obj['@type'] = 'preliminaryUploadFile';
            break;
        }
        case 'getStickers': {
            obj.sticker_type = { '@type': 'stickerTypeRegular' };
            obj.query = obj.emoji || '';
            delete obj.emoji;
            break;
        }
        case 'searchStickers': {
            obj.sticker_type = { '@type': 'stickerTypeRegular' };
            obj.emojis = obj.emoji || '';
            delete obj.emoji;
            break;
        }
        case 'getInstalledStickerSets': {
            obj.sticker_type = { '@type': obj.is_masks ? 'stickerTypeMask' : 'stickerTypeRegular' };
            delete obj.is_masks;
            break;
        }
        case 'getMessageLink': {
            obj.in_message_thread = Boolean(obj.for_comment);
            delete obj.for_comment;
            break;
        }
        default: {
            const media = INPUT_MEDIA[obj['@type']];
            if (media) {
                const [field, type, extra] = media;
                const value = obj[field];
                if (value && value['@type'] !== type) {
                    const wrapped = { '@type': type, [field]: value };
                    extra.forEach(x => {
                        if (obj[x] !== undefined) {
                            wrapped[x] = obj[x];
                            delete obj[x];
                        }
                    });
                    obj[field] = wrapped;
                }
                delete obj.ttl;
            }
            break;
        }
    }
}

function convertOrigin(origin) {
    if (!origin) return;

    switch (origin['@type']) {
        case 'messageOriginUser':
            origin['@type'] = 'messageForwardOriginUser';
            break;
        case 'messageOriginHiddenUser':
            origin['@type'] = 'messageForwardOriginHiddenUser';
            break;
        case 'messageOriginChat':
            origin['@type'] = 'messageForwardOriginChat';
            break;
        case 'messageOriginChannel':
            origin['@type'] = 'messageForwardOriginChannel';
            break;
        default:
            break;
    }
}

function convertIn(obj) {
    switch (obj['@type']) {
        case 'user': {
            const active = obj.usernames && obj.usernames.active_usernames;
            const status = obj.verification_status || {};
            obj.username = (active && active[0]) || '';
            obj.is_verified = Boolean(status.is_verified);
            obj.is_scam = Boolean(status.is_scam);
            obj.is_fake = Boolean(status.is_fake);
            obj.restriction_reason = '';
            break;
        }
        case 'chat': {
            obj.is_blocked = Boolean(obj.block_list);
            obj.message_ttl = obj.message_auto_delete_time || 0;
            obj.theme_name = '';
            break;
        }
        case 'message': {
            const replyTo = obj.reply_to;
            const isReply = replyTo && replyTo['@type'] === 'messageReplyToMessage';
            obj.reply_to_message_id = isReply ? replyTo.message_id : 0;
            obj.reply_in_chat_id = isReply ? replyTo.chat_id : 0;

            const topic = obj.topic_id;
            obj.message_thread_id = topic && topic['@type'] === 'messageTopicThread' ? topic.message_thread_id : 0;
            obj.ttl = 0;
            obj.ttl_expires_in = 0;
            obj.restriction_reason = '';

            // TDLib moved these flags to getMessageProperties; approximate them locally.
            const contentType = obj.content && obj.content['@type'];
            const isServer = obj.id > 0 && !obj.sending_state;
            if (obj.can_be_edited === undefined) {
                obj.can_be_edited = isServer && obj.is_outgoing && !obj.forward_info && EDITABLE_CONTENT.has(contentType);
                obj.can_be_forwarded = isServer;
                obj.can_be_deleted_only_for_self = true;
                obj.can_be_deleted_for_all_users = obj.is_outgoing;
                obj.can_get_statistics = false;
                obj.can_get_message_thread = false;
                obj.can_get_viewers = false;
                obj.can_get_media_timestamp_links = false;
            }
            break;
        }
        case 'messageForwardInfo': {
            convertOrigin(obj.origin);
            const source = obj.source || {};
            obj.from_chat_id = source.chat_id || 0;
            obj.from_message_id = source.message_id || 0;
            break;
        }
        case 'messageReplyToMessage': {
            convertOrigin(obj.origin);
            break;
        }
        case 'draftMessage': {
            const replyTo = obj.reply_to;
            const isReply = replyTo && replyTo['@type'] === 'inputMessageReplyToMessage';
            obj.reply_to_message_id = isReply ? replyTo.message_id : 0;
            obj.input_message_text = obj.content;
            break;
        }
        case 'messageChatSetMessageAutoDeleteTime': {
            obj['@type'] = 'messageChatSetTtl';
            obj.ttl = obj.message_auto_delete_time;
            break;
        }
        case 'sticker': {
            const format = obj.format && obj.format['@type'];
            const fullType = obj.full_type || {};
            obj.is_animated = format === 'stickerFormatTgs';
            obj.is_mask = fullType['@type'] === 'stickerFullTypeMask';
            obj.mask_position = fullType.mask_position || null;
            obj.outline = [];
            break;
        }
        case 'poll': {
            obj.question = plainText(obj.question);
            obj.recent_voter_user_ids = (obj.recent_voter_ids || [])
                .filter(x => x['@type'] === 'messageSenderUser')
                .map(x => x.user_id);
            const type = obj.type || {};
            if (type['@type'] === 'pollTypeRegular') {
                type.allow_multiple_answers = Boolean(obj.allows_multiple_answers);
            } else if (type['@type'] === 'pollTypeQuiz') {
                type.correct_option_id = (type.correct_option_ids || [-1])[0];
            }
            break;
        }
        case 'pollOption': {
            obj.text = plainText(obj.text);
            break;
        }
        case 'chatMemberStatusAdministrator': {
            Object.assign(obj, obj.rights || {});
            obj.custom_title = obj.custom_title || '';
            break;
        }
        case 'chatMemberStatusCreator': {
            obj.custom_title = obj.custom_title || '';
            break;
        }
        case 'chatListFolder': {
            obj['@type'] = 'chatListFilter';
            obj.chat_filter_id = obj.chat_folder_id;
            break;
        }
        case 'chatFolderInfo': {
            obj['@type'] = 'chatFilterInfo';
            obj.title = obj.name && obj.name.text ? obj.name.text.text : '';
            obj.icon_name = obj.icon ? obj.icon.name : '';
            break;
        }
        case 'updateChatFolders': {
            obj['@type'] = 'updateChatFilters';
            obj.chat_filters = obj.chat_folders;
            break;
        }
        case 'updateChatBlockList': {
            obj['@type'] = 'updateChatIsBlocked';
            obj.is_blocked = Boolean(obj.block_list);
            break;
        }
        case 'updateMessageSendFailed': {
            const error = obj.error || {};
            obj.error_code = error.code;
            obj.error_message = error.message;
            break;
        }
        case 'updateChatReplyMarkup': {
            obj.reply_markup_message_id = obj.reply_markup_message ? obj.reply_markup_message.id : 0;
            break;
        }
        case 'updateInstalledStickerSets': {
            obj.is_masks = Boolean(obj.sticker_type && obj.sticker_type['@type'] === 'stickerTypeMask');
            break;
        }
        case 'loginUrlInfoOpen': {
            obj.skip_confirm = obj.skip_confirmation;
            break;
        }
        default:
            break;
    }
}

function walk(value, convert, childrenFirst) {
    if (!value || typeof value !== 'object') return value;

    if (Array.isArray(value)) {
        value.forEach(x => walk(x, convert, childrenFirst));
        return value;
    }

    if (!childrenFirst && value['@type']) convert(value);
    Object.keys(value).forEach(key => walk(value[key], convert, childrenFirst));
    if (childrenFirst && value['@type']) convert(value);

    return value;
}

// Copies plain objects and arrays; keeps Blob, File, ArrayBuffer etc. as they are.
function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;

    const result = {};
    Object.keys(value).forEach(key => {
        result[key] = clone(value[key]);
    });
    return result;
}

export function toTd(request) {
    // Work on a copy: the app keeps references to objects it sends (e.g. the current chat list).
    return walk(clone(request), convertOut, false);
}

export function fromTd(object) {
    // Children first, so a parent sees already-converted children (e.g. message -> forward_info).
    return walk(object, convertIn, true);
}
