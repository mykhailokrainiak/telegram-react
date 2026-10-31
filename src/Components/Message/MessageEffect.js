/*
 * Message effects (message.effect_id): an emoji next to the time; click to play the effect animation.
 */

import React from 'react';
import PropTypes from 'prop-types';
import Sticker, { StickerSourceEnum } from './Media/Sticker';
import { loadStickerContent } from '../../Utils/File';
import FileStore from '../../Stores/FileStore';
import MessageStore from '../../Stores/MessageStore';
import TdLibController from '../../Controllers/TdLibController';
import './MessageEffect.css';

const EFFECT_PLAY_MS = 2500;
const effectCache = new Map();

async function getMessageEffect(effectId) {
    const key = String(effectId);
    if (!effectCache.has(key)) {
        effectCache.set(
            key,
            TdLibController.send({ '@type': 'getMessageEffect', effect_id: effectId }).catch(() => null)
        );
    }

    return effectCache.get(key);
}

function getEffectAnimation(effect) {
    const type = effect && effect.type;
    if (!type) return null;

    return type.effect_animation || type.sticker || null;
}

class MessageEffect extends React.Component {
    state = { effect: null, playing: false };

    async componentDidMount() {
        const message = MessageStore.get(this.props.chatId, this.props.messageId);
        if (!message || !message.effect_id || message.effect_id === '0') return;

        const effect = await getMessageEffect(message.effect_id);
        if (!effect || this.unmounted) return;

        this.setState({ effect });
    }

    componentWillUnmount() {
        this.unmounted = true;
        clearTimeout(this.playTimer);
    }

    handleClick = event => {
        event.preventDefault();
        event.stopPropagation();

        const animation = getEffectAnimation(this.state.effect);
        if (!animation) return;

        loadStickerContent(FileStore, animation, null);
        clearTimeout(this.playTimer);
        this.setState({ playing: true });
        this.playTimer = setTimeout(() => !this.unmounted && this.setState({ playing: false }), EFFECT_PLAY_MS);
    };

    render() {
        const { effect, playing } = this.state;
        if (!effect) return null;

        const animation = getEffectAnimation(effect);

        return (
            <>
                <span className='message-effect' title='Play message effect' onClick={this.handleClick}>
                    {effect.emoji}
                </span>
                {playing && animation && (
                    <div className='message-effect-overlay'>
                        <Sticker
                            sticker={animation}
                            autoplay
                            play
                            blur={false}
                            displaySize={320}
                            source={StickerSourceEnum.UNKNOWN}
                        />
                    </div>
                )}
            </>
        );
    }
}

MessageEffect.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired
};

export default MessageEffect;
