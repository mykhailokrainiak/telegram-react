/*
 * Voice-to-text for voice and video messages (recognizeSpeech). The result arrives through
 * updateMessageContent in voice_note/video_note.speech_recognition_result.
 * Telegram allows this for Premium users and a few free trials per week.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { recognizeSpeech } from '../../../Actions/Message';
import MessageStore from '../../../Stores/MessageStore';
import '../MessageTranslation.css';

function getSpeechRecognitionResult(message) {
    const content = message && message.content;
    const media = content && (content.voice_note || content.video_note);

    return media ? media.speech_recognition_result || null : null;
}

class SpeechRecognition extends React.Component {
    state = { requested: false, error: null };

    componentDidMount() {
        MessageStore.on('updateMessageContent', this.onUpdateMessageContent);
    }

    componentWillUnmount() {
        MessageStore.off('updateMessageContent', this.onUpdateMessageContent);
    }

    onUpdateMessageContent = update => {
        const { chatId, messageId } = this.props;
        if (update.chat_id !== chatId || update.message_id !== messageId) return;

        this.forceUpdate();
    };

    handleClick = async event => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId } = this.props;
        this.setState({ requested: true, error: null });
        try {
            await recognizeSpeech(chatId, messageId);
        } catch (error) {
            this.setState({ requested: false, error: (error && error.message) || 'Transcription failed' });
        }
    };

    render() {
        const { chatId, messageId } = this.props;
        const { requested, error } = this.state;

        const message = MessageStore.get(chatId, messageId);
        if (!message || message.id <= 0) return null;

        const result = getSpeechRecognitionResult(message);
        const type = result && result['@type'];

        let body;
        if (type === 'speechRecognitionResultText') {
            body = <div className='speech-recognition'>{result.text}</div>;
        } else if (type === 'speechRecognitionResultPending') {
            body = (
                <div className='speech-recognition'>
                    {result.partial_text} <span className='speech-recognition-status'>Transcribing…</span>
                </div>
            );
        } else if (type === 'speechRecognitionResultError' || error) {
            const message = error || (result.error && result.error.message) || 'Transcription failed';
            body = <div className='speech-recognition-status'>{message}</div>;
        } else if (requested) {
            body = <div className='speech-recognition-status'>Transcribing…</div>;
        } else {
            body = (
                <button type='button' className='speech-recognition-button' title='Transcribe to text' onClick={this.handleClick}>
                    →A Transcribe
                </button>
            );
        }

        return (
            <div className='speech-recognition-wrapper' onMouseDown={e => e.stopPropagation()}>
                {body}
            </div>
        );
    }
}

SpeechRecognition.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired
};

export default SpeechRecognition;
