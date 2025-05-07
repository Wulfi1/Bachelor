import React, { useEffect, useRef } from 'react';
import './style.css';

export interface TaskProps {
    id: string;
    name: string;
    timeMin: number;
    timeMax: number;
}

export interface TaskDialogProps {
    task: TaskProps | null;
    onFieldChange: (field: 'name' | 'timeMin' | 'timeMax', value: string) => void;
    onUpdate: () => void;
    onClose: () => void;
}

const TaskDialog: React.FC<TaskDialogProps> = ({
                                                   task,
                                                   onFieldChange,
                                                   onUpdate,
                                                   onClose,
                                               }) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dialogRef.current &&
                !dialogRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    if (!task) return null;

    return (
        <div ref={dialogRef} className="gateway-editor">
            <h4 className="gateway-title">Task Properties</h4>

            <div className="gateway-field">
                <label>Name:</label>
                <input
                    type="text"
                    value={task.name}
                    onChange={e => onFieldChange('name', e.target.value)}
                />
            </div>

            <div className="gateway-field">
                <label>Min time (min):</label>
                <input
                    type="number"
                    step="1"
                    value={task.timeMin}
                    onChange={e => onFieldChange('timeMin', e.target.value)}
                />
            </div>

            <div className="gateway-field">
                <label>Max time (min):</label>
                <input
                    type="number"
                    step="1"
                    value={task.timeMax}
                    onChange={e => onFieldChange('timeMax', e.target.value)}
                />
            </div>

            <button onClick={onUpdate} className="button">
                Update Task
            </button>
        </div>
    );
};

export default TaskDialog;