import React, { useEffect, useRef } from 'react';
import './style.css';

export interface TaskProps {
    id: string;
    name: string;
    time: number;
}

export interface TaskDialogProps {
    task: TaskProps | null;
    onFieldChange: (field: 'name' | 'time', value: string) => void;
    onUpdate: () => void;
    onClose: () => void;            // ← new
}

const TaskDialog: React.FC<TaskDialogProps> = ({
                                                   task,
                                                   onFieldChange,
                                                   onUpdate,
                                                   onClose,                       // ← new
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
                <label>Time (hrs):</label>
                <input
                    type="number"
                    step="1"
                    value={task.time}
                    onChange={e => onFieldChange('time', e.target.value)}
                />
            </div>

            <button onClick={onUpdate} className="button">
                Update Task
            </button>
        </div>
    );
};

export default TaskDialog;
