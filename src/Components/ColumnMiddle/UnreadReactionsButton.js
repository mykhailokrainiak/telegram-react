/*
 * Floating button that jumps to the oldest message with unread reactions.
 * Right-click marks all reactions in the chat as read.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { openChat } from '../../Actions/Client';
import { getUnreadReactionMessageIds } from '../../Utils/Reactions';
import ChatStore from '../../Stores/ChatStore';
import TdLibController from '../../Controllers/TdLibController';
import '../Message/Reactions.css';

class UnreadReactionsButton extends React.Component {
    componentDidMount() {
        ChatStore.on('updateChatUnreadReactionCount', this.onUpdate);
        ChatStore.on('updateMessageUnreadReactions', this.onUpdate);
    }

    componentWillUnmount() {
        ChatStore.off('updateChatUnreadReactionCount', this.onUpdate);
        ChatStore.off('updateMessageUnreadReactions', this.onUpdate);
    }

    onUpdate = update => {
        if (update.chat_id !== this.props.chatId) return;

        this.forceUpdate();
    };

    handleClick = async () => {
        const { chatId } = this.props;

        const ids = await getUnreadReactionMessageIds(chatId);
        if (!ids.length) return;

        openChat(chatId, ids[ids.length - 1]);
    };

    handleContextMenu = event => {
        event.preventDefault();

        TdLibController.send({ '@type': 'readAllChatReactions', chat_id: this.props.chatId });
    };

    render() {
        const chat = ChatStore.get(this.props.chatId);
        if (!chat || !(chat.unread_reaction_count > 0)) return null;

        return (
            <button
                type='button'
                className='unread-reactions-button'
                title='Go to unread reactions (right-click: mark all as read)'
                onClick={this.handleClick}
                onContextMenu={this.handleContextMenu}>
                ♥<span className='unread-reactions-button-count'>{chat.unread_reaction_count}</span>
            </button>
        );
    }
}

UnreadReactionsButton.propTypes = {
    chatId: PropTypes.number.isRequired
};

export default UnreadReactionsButton;
