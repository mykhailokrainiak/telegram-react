/*
 * Self-destructing ("view once" / timed) photos and videos: content.is_secret with message.self_destruct_type.
 * Shown blurred; opening downloads the file, calls openMessageContent (which starts the
 * self-destruct timer) and shows it in a full-screen overlay. TDLib then replaces the content
 * with messageExpiredPhoto / messageExpiredVideo.
 */

import React from 'react';
import PropTypes from 'prop-types';
import MessageStore from '../../../Stores/MessageStore';
import TdLibController from '../../../Controllers/TdLibController';
import './ViewOnceMedia.css';

function getViewOnceFile(content) {
    if (!content) return null;

    if (content['@type'] === 'messagePhoto' && content.photo) {
        const { sizes } = content.photo;
        const largest = sizes && sizes[sizes.length - 1];
        return largest ? { file: largest.photo, isVideo: false } : null;
    }
    if (content['@type'] === 'messageVideo' && content.video) {
        return { file: content.video.video, isVideo: true };
    }

    return null;
}

function getMinithumbnail(content) {
    const media = content && (content.photo || content.video);
    const minithumbnail = media && media.minithumbnail;

    return minithumbnail ? `data:image/jpeg;base64,${minithumbnail.data}` : null;
}

export function getSelfDestructLabel(message) {
    const type = message && message.self_destruct_type;
    if (type && type['@type'] === 'messageSelfDestructTypeTimer') {
        return `⏱ ${type.self_destruct_time}s`;
    }

    return 'View once';
}

class ViewOnceMedia extends React.Component {
    state = {
        loading: false,
        url: null,
        isVideo: false,
        secondsLeft: 0,
        opened: false,
        error: null
    };

    componentWillUnmount() {
        this.unmounting = true;
        this.close();
    }

    handleOpen = async event => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId } = this.props;
        const message = MessageStore.get(chatId, messageId);
        if (!message || message.is_outgoing || this.state.loading || this.state.opened) return;

        const media = getViewOnceFile(message.content);
        if (!media || !media.file) return;

        this.setState({ loading: true, error: null });
        try {
            await TdLibController.send({
                '@type': 'downloadFile',
                file_id: media.file.id,
                priority: 32,
                offset: 0,
                limit: 0,
                synchronous: true
            });
            const { data } = await TdLibController.send({ '@type': 'readFile', file_id: media.file.id });

            await TdLibController.send({ '@type': 'openMessageContent', chat_id: chatId, message_id: messageId });

            const type = message.self_destruct_type;
            const seconds = type && type['@type'] === 'messageSelfDestructTypeTimer' ? type.self_destruct_time : 0;

            this.setState({
                loading: false,
                opened: true,
                url: URL.createObjectURL(data),
                isVideo: media.isVideo,
                secondsLeft: seconds
            });

            if (seconds > 0) {
                this.timer = setInterval(() => {
                    const secondsLeft = this.state.secondsLeft - 1;
                    if (secondsLeft <= 0) {
                        this.close();
                    } else {
                        this.setState({ secondsLeft });
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('[view-once] open failed', error);
            this.setState({ loading: false, error: 'Could not open this media' });
        }
    };

    close = () => {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.state.url) {
            URL.revokeObjectURL(this.state.url);
            if (!this.unmounting) this.setState({ url: null });
        }
    };

    handleClose = event => {
        event.stopPropagation();
        this.close();
    };

    render() {
        const { chatId, messageId } = this.props;
        const { loading, url, isVideo, secondsLeft, opened, error } = this.state;

        const message = MessageStore.get(chatId, messageId);
        if (!message) return null;

        const thumbnail = getMinithumbnail(message.content);
        const label = message.is_outgoing
            ? `${getSelfDestructLabel(message)} · sent`
            : opened
            ? 'Opened'
            : loading
            ? 'Loading…'
            : `${getSelfDestructLabel(message)} · tap to view`;

        return (
            <>
                <div
                    className='view-once'
                    onClick={this.handleOpen}
                    style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : null}>
                    <div className='view-once-badge'>
                        <span className='view-once-icon' role='img' aria-label='Self-destructing'>
                            🔥
                        </span>
                        <span>{error || label}</span>
                    </div>
                </div>
                {url && (
                    <div className='view-once-viewer' onClick={this.handleClose}>
                        {isVideo ? (
                            <video src={url} autoPlay controls onClick={e => e.stopPropagation()} />
                        ) : (
                            <img src={url} alt='' />
                        )}
                        <div className='view-once-viewer-hint'>
                            {secondsLeft > 0 ? `Disappears in ${secondsLeft}s · ` : ''}Click to close
                        </div>
                    </div>
                )}
            </>
        );
    }
}

ViewOnceMedia.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired
};

export default ViewOnceMedia;
