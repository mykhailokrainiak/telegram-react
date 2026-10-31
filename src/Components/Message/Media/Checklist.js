/*
 * Checklists (messageChecklist): tick tasks when the list allows it (markChecklistTasksAsDone)
 * and add tasks when allowed (addChecklistTasks).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { getFormattedText } from '../../../Utils/Message';
import { getUserShortName } from '../../../Utils/User';
import ChatStore from '../../../Stores/ChatStore';
import TdLibController from '../../../Controllers/TdLibController';
import './Checklist.css';

function getSenderName(sender, t) {
    if (!sender) return null;
    if (sender['@type'] === 'messageSenderUser') return getUserShortName(sender.user_id, t);

    const chat = ChatStore.get(sender.chat_id);
    return chat ? chat.title : null;
}

class Checklist extends React.Component {
    state = { adding: false, newTaskText: '', error: null };

    handleToggle = async (event, task) => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId, checklist } = this.props;
        if (!checklist.can_mark_tasks_as_done) return;

        const isDone = Boolean(task.completed_by);
        try {
            await TdLibController.send({
                '@type': 'markChecklistTasksAsDone',
                chat_id: chatId,
                message_id: messageId,
                marked_as_done_task_ids: isDone ? [] : [task.id],
                marked_as_not_done_task_ids: isDone ? [task.id] : []
            });
            this.setState({ error: null });
        } catch (error) {
            this.setState({ error: (error && error.message) || 'Could not update the task' });
        }
    };

    handleShowAdd = event => {
        event.preventDefault();
        event.stopPropagation();

        this.setState({ adding: true, newTaskText: '' });
    };

    handleNewTaskChange = event => {
        this.setState({ newTaskText: event.target.value });
    };

    handleNewTaskKeyDown = event => {
        event.stopPropagation();

        if (event.key === 'Enter') {
            this.handleAddTask(event);
        } else if (event.key === 'Escape') {
            this.setState({ adding: false });
        }
    };

    handleAddTask = async event => {
        event.preventDefault();
        event.stopPropagation();

        const { chatId, messageId, checklist } = this.props;
        const text = (this.state.newTaskText || '').trim();
        if (!text) return;

        const nextId = Math.max(0, ...checklist.tasks.map(x => x.id)) + 1;
        try {
            await TdLibController.send({
                '@type': 'addChecklistTasks',
                chat_id: chatId,
                message_id: messageId,
                tasks: [
                    {
                        '@type': 'inputChecklistTask',
                        id: nextId,
                        text: { '@type': 'formattedText', text, entities: [] }
                    }
                ]
            });
            this.setState({ adding: false, newTaskText: '', error: null });
        } catch (error) {
            this.setState({ error: (error && error.message) || 'Could not add the task' });
        }
    };

    render() {
        const { checklist, meta, t } = this.props;
        const { adding, newTaskText, error } = this.state;
        if (!checklist) return null;

        const { title, tasks, can_mark_tasks_as_done, can_add_tasks } = checklist;
        const doneCount = tasks.filter(x => x.completed_by).length;

        return (
            <div className='checklist' onClick={e => e.stopPropagation()}>
                <div className='checklist-title'>{getFormattedText(title, t)}</div>
                <div className='checklist-subtitle'>
                    {doneCount} of {tasks.length} completed
                </div>
                <div className='checklist-tasks'>
                    {tasks.map(task => {
                        const isDone = Boolean(task.completed_by);
                        const completedBy = isDone ? getSenderName(task.completed_by, t) : null;

                        return (
                            <label
                                key={task.id}
                                className={can_mark_tasks_as_done ? 'checklist-task checklist-task-enabled' : 'checklist-task'}
                                onClick={e => this.handleToggle(e, task)}>
                                <input type='checkbox' checked={isDone} disabled={!can_mark_tasks_as_done} readOnly />
                                <span className={isDone ? 'checklist-task-text checklist-task-done' : 'checklist-task-text'}>
                                    {getFormattedText(task.text, t)}
                                    {completedBy && <span className='checklist-task-by'> · {completedBy}</span>}
                                </span>
                            </label>
                        );
                    })}
                </div>
                {can_add_tasks && (
                    <div className='checklist-add'>
                        {adding ? (
                            <>
                                <input
                                    autoFocus
                                    className='checklist-add-input'
                                    placeholder='New task'
                                    maxLength={100}
                                    value={newTaskText}
                                    onChange={this.handleNewTaskChange}
                                    onKeyDown={this.handleNewTaskKeyDown}
                                />
                                <button type='button' className='checklist-link-button' onClick={this.handleAddTask}>
                                    Add
                                </button>
                            </>
                        ) : (
                            <button type='button' className='checklist-link-button' onClick={this.handleShowAdd}>
                                + Add task
                            </button>
                        )}
                    </div>
                )}
                {error && <div className='checklist-error'>{error}</div>}
                <div className='checklist-footer'>{meta}</div>
            </div>
        );
    }
}

Checklist.propTypes = {
    chatId: PropTypes.number.isRequired,
    messageId: PropTypes.number.isRequired,
    checklist: PropTypes.object.isRequired,
    meta: PropTypes.node
};

export default withTranslation()(Checklist);
