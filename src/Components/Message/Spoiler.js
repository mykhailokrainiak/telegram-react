/*
 * Spoilers: hidden text (textEntityTypeSpoiler) and blurred media (has_spoiler) until clicked.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import './Spoiler.css';

export class TextSpoiler extends React.Component {
    state = { revealed: false };

    handleClick = event => {
        if (this.state.revealed) return;

        event.preventDefault();
        event.stopPropagation();
        this.setState({ revealed: true });
    };

    render() {
        const { revealed } = this.state;

        return (
            <span
                className={classNames('text-spoiler', { 'text-spoiler-revealed': revealed })}
                title={revealed ? undefined : 'Spoiler: click to reveal'}
                onClick={this.handleClick}>
                {this.props.children}
            </span>
        );
    }
}

export class MediaSpoiler extends React.Component {
    state = { revealed: false };

    handleClick = event => {
        event.preventDefault();
        event.stopPropagation();
        this.setState({ revealed: true });
    };

    render() {
        const { enabled, children } = this.props;
        const { revealed } = this.state;
        if (!enabled || revealed) return children;

        return (
            <div className='media-spoiler' onClick={this.handleClick}>
                <div className='media-spoiler-content'>{children}</div>
                <div className='media-spoiler-label'>Spoiler</div>
            </div>
        );
    }
}

MediaSpoiler.propTypes = {
    enabled: PropTypes.bool
};
