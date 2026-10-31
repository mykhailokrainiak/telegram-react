/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FireworksComponent from './FireworksControl';
import PollOption from './PollOption';
import UserTile from '../../Tile/UserTile';
import { addPollOption, cancelPollAnswer, setPollAnswer } from '../../../Actions/Poll';
import { getFormattedText } from '../../../Utils/Message';
import MessageStore from './../../../Stores/MessageStore';
import TdLibController from './../../../Controllers/TdLibController';
import './Poll.css';
import PollResultsDialog from '../../Popup/PollResultsDialog';

const VOTE_RESTRICTION_TEXT = {
    pollVoteRestrictionReasonYetUnsent: 'You can vote once the message is sent',
    pollVoteRestrictionReasonScheduled: 'You can vote once the message is sent',
    pollVoteRestrictionReasonCountryRestricted: "Voting isn't available in your country",
    pollVoteRestrictionReasonMembershipRequired: 'Join the chat to vote',
    pollVoteRestrictionReasonOther: "You can't vote in this poll"
};

function getVoteRestrictionText(poll) {
    const reason = poll && poll.vote_restriction_reason;
    if (!reason || poll.is_closed) return null;

    return VOTE_RESTRICTION_TEXT[reason['@type']] || null;
}

class Poll extends React.Component {
    constructor(props) {
        super(props);

        this.fireworksRef = React.createRef();
        this.state = {};
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        const { chatId, messageId, poll } = this.props;

        if (poll && poll.type['@type'] === 'pollTypeQuiz') {
            const { poll: prevPoll } = prevProps;
            if (prevPoll.type.correct_option_id === -1 && poll.type.correct_option_id !== -1) {
                const fireworks = this.fireworksRef.current;
                if (!fireworks) return;

                if (poll.options[poll.type.correct_option_id].is_chosen) {
                    fireworks.start();
                } else {
                    TdLibController.clientUpdate({
                        '@type': 'clientUpdateMessageShake',
                        chatId,
                        messageId
                    });
                }
            }
        }
    }

    getTotalVoterCountString = (count, t = key => key) => {
        if (!count) return t('NoVotes');
        if (count === 1) return '1 answer';

        return count + ' answers';
    };

    handleSubmit = event => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId, poll } = this.props;
        if (!poll) return;

        const { type } = poll;
        if (!type) return;

        if (this.viewResults(poll)) {
            return;
        }

        if (!type.allow_multiple_answers) {
            return;
        }

        const optionIds = [];
        poll.options.forEach((x, index) => {
            if (x.isMultiChoosen) {
                optionIds.push(index);
            }
        });

        if (!optionIds.length) {
            return;
        }

        setPollAnswer(chatId, messageId, optionIds);
    };

    handleVote = index => {
        const { chatId, messageId, poll } = this.props;
        if (!poll) return;

        const { type } = poll;
        if (!type) return;

        if (type['@type'] === 'pollTypeRegular' && type.allow_multiple_answers) {
            poll.options[index].isMultiChoosen = !poll.options[index].isMultiChoosen;
            this.forceUpdate();
        } else {
            setPollAnswer(chatId, messageId, [index]);
        }
    };

    viewResults(poll) {
        if (!poll) return false;

        const { options, is_closed, is_anonymous } = poll;
        if (is_anonymous) {
            return false;
        }

        return is_closed || options.some(x => x.is_chosen);
    }

    getOptionType(index, poll) {
        const types = ['regular', 'correct', 'incorrect'];
        const defaultTypeId = 0;
        const correctTypeId = 1;
        const incorrectTypeId = 2;
        if (!poll) return types[defaultTypeId];

        const option = poll.options[index];
        if (!option) return types[defaultTypeId];
        if (!option.is_chosen) return types[defaultTypeId];

        const { type } = poll;
        if (!type) return types[defaultTypeId];
        if (type['@type'] !== 'pollTypeQuiz') return types[defaultTypeId];

        const { correct_option_id } = type;
        if (correct_option_id === -1) return types[defaultTypeId];

        return correct_option_id === index ? types[correctTypeId] : types[incorrectTypeId];
    }

    getOptionIsCorrect(index, poll) {
        if (!poll) return false;

        const option = poll.options[index];
        if (!option) return false;

        const { type } = poll;
        if (!type) return false;
        if (type['@type'] !== 'pollTypeQuiz') return false;

        const { correct_option_id } = type;
        if (correct_option_id === -1) return false;

        return correct_option_id === index;
    }

    handleRetractVote = event => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId } = this.props;
        cancelPollAnswer(chatId, messageId);
    };

    handleShowAddOption = event => {
        event.preventDefault();
        event.stopPropagation();

        this.setState({ addingOption: true, newOptionText: '' });
    };

    handleNewOptionChange = event => {
        this.setState({ newOptionText: event.target.value });
    };

    handleNewOptionKeyDown = event => {
        event.stopPropagation();

        if (event.key === 'Enter') {
            this.handleAddOption(event);
        } else if (event.key === 'Escape') {
            this.setState({ addingOption: false });
        }
    };

    handleAddOption = async event => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId } = this.props;
        const text = (this.state.newOptionText || '').trim();
        if (!text) return;

        try {
            await addPollOption(chatId, messageId, text);
            this.setState({ addingOption: false, newOptionText: '', addOptionError: null });
        } catch (error) {
            this.setState({ addOptionError: (error && error.message) || 'Could not add the option' });
        }
    };

    handleOpenResults = event => {
        event.preventDefault();
        event.stopPropagation();

        const { poll } = this.props;

        this.setState({
            viewResultsPoll: poll
        });
    };

    handleCloseResults = () => {
        this.setState({
            viewResultsPoll: null
        });
    };

    render() {
        const { chatId, messageId, poll, t, meta } = this.props;
        const { viewResultsPoll, addingOption, newOptionText, addOptionError } = this.state;
        const { question, options, total_voter_count, type, is_closed, is_anonymous, recent_voter_user_ids } = poll;

        let subtitle = t('FinalResults');
        if (!is_closed) {
            switch (type['@type']) {
                case 'pollTypeRegular': {
                    subtitle = is_anonymous ? t('AnonymousPoll') : t('PublicPoll');
                    break;
                }
                case 'pollTypeQuiz': {
                    subtitle = is_anonymous ? t('AnonymousQuizPoll') : t('QuizPoll');
                    break;
                }
            }
        }

        const message = MessageStore.get(chatId, messageId);
        if (!message) return null;

        const { description, can_add_option } = message.content;
        const restrictionText = getVoteRestrictionText(poll);
        const hideResults = poll.can_see_results === false;
        const order =
            poll.option_order && poll.option_order.length === options.length ? poll.option_order : options.map((x, i) => i);

        const isQuiz = type && type['@type'] === 'pollTypeQuiz';
        const canBeSelected = !is_closed && !restrictionText && options.every(x => !x.is_chosen);
        const canRetractVote =
            !is_closed && !isQuiz && poll.allows_revoting !== false && options.some(x => x.is_chosen);
        const isSelected = !is_closed && options.some(x => x.is_chosen);
        const maxVoterCount = Math.max(...options.map(x => x.voter_count));
        const showViewResults = this.viewResults(poll);
        const showButton = (type.allow_multiple_answers && !isSelected) || showViewResults;
        const buttonEnabled = showViewResults || options.some(x => x.isMultiChoosen);
        let recentVoters = [];
        if (recent_voter_user_ids) {
            recentVoters = recent_voter_user_ids.map(id => <UserTile key={id} poll userId={id} />);
        }

        return (
            <div className='poll'>
                {isQuiz && <FireworksComponent ref={this.fireworksRef} />}
                <div className='poll-question'>
                    <div className='poll-question-title'>{question}</div>
                    {description && description.text && (
                        <div className='poll-question-description'>{getFormattedText(description, t)}</div>
                    )}
                    <div className='poll-question-subtitle'>
                        <span style={{ marginRight: 6 }}>{subtitle}</span>
                        {recentVoters}
                    </div>
                </div>
                <div className='poll-options'>
                    {order.map(index => (
                        <PollOption
                            key={index}
                            type={this.getOptionType(index, poll)}
                            isCorrect={this.getOptionIsCorrect(index, poll)}
                            option={options[index]}
                            canBeSelected={canBeSelected}
                            closed={is_closed}
                            hideResults={hideResults}
                            maxVoterCount={maxVoterCount}
                            onVote={() => this.handleVote(index)}
                        />
                    ))}
                </div>
                {can_add_option && !is_closed && (
                    <div className='poll-add-option' onClick={e => e.stopPropagation()}>
                        {addingOption ? (
                            <>
                                <input
                                    autoFocus
                                    className='poll-add-option-input'
                                    placeholder='New option'
                                    maxLength={100}
                                    value={newOptionText}
                                    onChange={this.handleNewOptionChange}
                                    onKeyDown={this.handleNewOptionKeyDown}
                                />
                                <button type='button' className='poll-link-button' onClick={this.handleAddOption}>
                                    Add
                                </button>
                            </>
                        ) : (
                            <button type='button' className='poll-link-button' onClick={this.handleShowAddOption}>
                                + Add option
                            </button>
                        )}
                        {addOptionError && <div className='poll-note'>{addOptionError}</div>}
                    </div>
                )}
                {restrictionText && <div className='poll-note'>{restrictionText}</div>}
                {hideResults && !is_closed && <div className='poll-note'>Results are shown when the poll closes</div>}
                {canRetractVote && (
                    <button type='button' className='poll-link-button poll-retract' onClick={this.handleRetractVote}>
                        Retract vote
                    </button>
                )}
                {showButton ? (
                    <Button
                        fullWidth
                        color='primary'
                        classes={{
                            root: 'poll-button',
                            textPrimary: 'message-control',
                            disabled: 'message-control-disabled'
                        }}
                        TouchRippleProps={{ classes: { child: 'touch-ripple-current-color' } }}
                        disabled={!buttonEnabled}
                        onClick={showViewResults ? this.handleOpenResults : this.handleSubmit}>
                        {showViewResults ? t('PollViewResults') : t('PollSubmitVotes')}
                    </Button>
                ) : (
                    <div className='poll-total-count'>
                        {this.getTotalVoterCountString(total_voter_count, t)}
                        {meta}
                    </div>
                )}
                {Boolean(viewResultsPoll) && (
                    <PollResultsDialog
                        chatId={chatId}
                        messageId={messageId}
                        poll={viewResultsPoll}
                        onClose={this.handleCloseResults}
                    />
                )}
            </div>
        );
    }
}

Poll.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired,
    poll: PropTypes.object.isRequired,
    openMedia: PropTypes.func
};

export default withTranslation()(Poll);
