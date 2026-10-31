/*
 * Translation of a message's text, shown under the original after "Translate" in the menu.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { getMessageTranslation, hideMessageTranslation } from '../../Actions/Message';
import { getFormattedText } from '../../Utils/Message';
import MessageStore from '../../Stores/MessageStore';
import './MessageTranslation.css';

class MessageTranslation extends React.Component {
    componentDidMount() {
        MessageStore.on('clientUpdateMessageTranslation', this.onClientUpdateMessageTranslation);
    }

    componentWillUnmount() {
        MessageStore.off('clientUpdateMessageTranslation', this.onClientUpdateMessageTranslation);
    }

    onClientUpdateMessageTranslation = update => {
        const { chatId, messageId } = this.props;
        if (update.chatId !== chatId || update.messageId !== messageId) return;

        this.forceUpdate();
    };

    handleHide = event => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId } = this.props;
        hideMessageTranslation(chatId, messageId);
    };

    render() {
        const { chatId, messageId } = this.props;
        const translation = getMessageTranslation(chatId, messageId);
        if (!translation) return null;

        let body;
        if (translation.loading) {
            body = <span className='message-translation-status'>Translating…</span>;
        } else if (translation.error) {
            body = <span className='message-translation-status'>{translation.error}</span>;
        } else {
            body = getFormattedText(translation.text);
        }

        return (
            <div className='message-translation' onMouseDown={e => e.stopPropagation()}>
                <div className='message-translation-header'>
                    <span>Translation</span>
                    <a href='#hide' onClick={this.handleHide}>
                        Show original only
                    </a>
                </div>
                <div className='message-translation-text'>{body}</div>
            </div>
        );
    }
}

MessageTranslation.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired
};

export default MessageTranslation;
