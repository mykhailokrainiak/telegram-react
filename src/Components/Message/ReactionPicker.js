/*
 * Row of reactions the chat allows, shown at the top of the message context menu.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
    getAvailableReactions,
    getMessageReactions,
    getReactionEmoji,
    getReactionKey,
    loadCustomEmojiReactions,
    toggleReaction
} from '../../Utils/Reactions';
import MessageStore from '../../Stores/MessageStore';
import './Reactions.css';

const MAX_PICKER_REACTIONS = 16;

class ReactionPicker extends React.Component {
    state = { types: [] };

    async componentDidMount() {
        const { chatId, messageId } = this.props;

        const available = await getAvailableReactions(chatId, messageId);
        if (!available || this.unmounted) return;

        // Top first, then recent and popular, without Premium-only ones or duplicates.
        const seen = new Set();
        const types = [...(available.top_reactions || []), ...(available.recent_reactions || []), ...(available.popular_reactions || [])]
            .filter(x => !x.needs_premium && x.type['@type'] !== 'reactionTypePaid')
            .map(x => x.type)
            .filter(type => {
                const key = getReactionKey(type);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, MAX_PICKER_REACTIONS);

        this.setState({ types });
        loadCustomEmojiReactions(types, () => !this.unmounted && this.forceUpdate());
    }

    componentWillUnmount() {
        this.unmounted = true;
    }

    handleClick = (event, type, isChosen) => {
        event.stopPropagation();

        const { chatId, messageId, onSelect } = this.props;
        onSelect(event);
        toggleReaction(chatId, messageId, type, isChosen).catch(error =>
            console.error('[reactions] toggle failed', error)
        );
    };

    render() {
        const { chatId, messageId } = this.props;
        const { types } = this.state;
        if (!types.length) return null;

        const chosen = new Set(
            getMessageReactions(MessageStore.get(chatId, messageId))
                .filter(x => x.is_chosen)
                .map(x => getReactionKey(x.type))
        );

        return (
            <div className='reaction-picker'>
                {types.map(type => {
                    const key = getReactionKey(type);
                    const isChosen = chosen.has(key);

                    return (
                        <button
                            key={key}
                            type='button'
                            className={classNames('reaction-picker-item', { 'reaction-picker-item-chosen': isChosen })}
                            onClick={e => this.handleClick(e, type, isChosen)}>
                            {getReactionEmoji(type)}
                        </button>
                    );
                })}
            </div>
        );
    }
}

ReactionPicker.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired,
    onSelect: PropTypes.func.isRequired
};

export default ReactionPicker;
