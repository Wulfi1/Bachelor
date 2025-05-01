import React from 'react';
import './style.css';

export interface Flow {
    id: string;
    name: string;
    probability: string;
}

export interface GatewayEditorProps {
    flows: Flow[];
    isValid: boolean;
    onFieldChange: (flowId: string, field: 'name' | 'probability', value: string) => void;
    onUpdate: () => void;
}

const GatewayDialog: React.FC<GatewayEditorProps> = ({ flows, isValid, onFieldChange, onUpdate }) => {
    // Only render if there's more than one outgoing flow
    if (flows.length <= 1) return null;

    return (
        <div className="gateway-editor">
            <h4 className="gateway-title">ExclusiveGateway</h4>
            {flows.map(flow => (
                <div key={flow.id} className="gateway-flow">
                    <div><strong>Flow</strong></div>
                    <div className="gateway-field">
                        <label>Name:</label>
                        <input
                            type="text"
                            value={flow.name}
                            onChange={e => onFieldChange(flow.id, 'name', e.target.value)}
                        />
                    </div>
                    <div className="gateway-field">
                        <label>Probability:</label>
                        <input
                            type="number"
                            step="0.01"
                            value={flow.probability}
                            onChange={e => onFieldChange(flow.id, 'probability', e.target.value)}
                        />
                    </div>
                </div>
            ))}
            {!isValid && (
                <div className="gateway-error">
                    Total probability does not sum up to 1. Please adjust.
                </div>
            )}
            <button
                onClick={onUpdate}
                disabled={!isValid}
                className="button"
            >
                Update All
            </button>
        </div>
    );
};

export default GatewayDialog;
