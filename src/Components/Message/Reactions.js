/*
 * Reaction chips under a message: emoji + count, highlighted when chosen; click to toggle.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
    getMessageReactions,
    getReactionEmoji,
    getReactionKey,
    loadCustomEmojiReactions,
    toggleReaction
} from '../../Utils/Reactions';
import MessageStore from '../../Stores/MessageStore';
import './Reactions.css';

class Reactions extends React.Component {
    componentDidMount() {
        MessageStore.on('updateMessageInteractionInfo', this.onUpdateMessageInteractionInfo);
        this.loadCustomEmoji();
    }

    componentWillUnmount() {
        MessageStore.off('updateMessageInteractionInfo', this.onUpdateMessageInteractionInfo);
    }

    onUpdateMessageInteractionInfo = update => {
        const { chatId, messageId } = this.props;
        if (update.chat_id !== chatId || update.message_id !== messageId) return;

        this.loadCustomEmoji();
        this.forceUpdate();
    };

    loadCustomEmoji() {
        const { chatId, messageId } = this.props;
        const reactions = getMessageReactions(MessageStore.get(chatId, messageId));

        loadCustomEmojiReactions(reactions.map(x => x.type), () => this.forceUpdate());
    }

    handleClick = (event, reaction) => {
        event.stopPropagation();

        const { chatId, messageId } = this.props;
        toggleReaction(chatId, messageId, reaction.type, reaction.is_chosen).catch(error =>
            console.error('[reactions] toggle failed', error)
        );
    };

    render() {
        const { chatId, messageId } = this.props;
        const message = MessageStore.get(chatId, messageId);
        const reactions = getMessageReactions(message);
        if (!reactions.length) return null;

        return (
            <div className='reactions' onMouseDown={e => e.stopPropagation()}>
                {reactions.map(reaction => (
                    <button
                        key={getReactionKey(reaction.type)}
                        type='button'
                        className={classNames('reaction', {
                            'reaction-chosen': reaction.is_chosen,
                            'reaction-paid': reaction.type['@type'] === 'reactionTypePaid'
                        })}
                        onClick={e => this.handleClick(e, reaction)}>
                        <span className='reaction-emoji'>{getReactionEmoji(reaction.type)}</span>
                        <span className='reaction-count'>{reaction.total_count}</span>
                    </button>
                ))}
            </div>
        );
    }
}

Reactions.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired
};

export default Reactions;
