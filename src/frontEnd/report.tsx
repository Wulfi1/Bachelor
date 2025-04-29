import React from 'react';

export interface ReportEntry {
    trace: string;
    count: number;
    percentage: number;
}

export interface ReportModalProps {
    show: boolean;
    loading: boolean;
    error: string | null;
    report: ReportEntry[] | null;
    onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ show, loading, error, report, onClose }) => {
    if (!show) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button onClick={onClose} className="modal-close">
                    ×
                </button>
                <h3>Simulation Report</h3>
                {loading && <p>Loading…</p>}
                {error && <p style={{ color: 'red' }}>Error: {error}</p>}
                {report && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                        <tr>
                            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Trace</th>
                            <th style={{ borderBottom: '1px solid #ccc' }}>Count</th>
                            <th style={{ borderBottom: '1px solid #ccc' }}>%</th>
                        </tr>
                        </thead>
                        <tbody>
                        {report.map((r, i) => (
                            <tr key={i}>
                                <td style={{ padding: '4px 0' }}>{r.trace}</td>
                                <td style={{ textAlign: 'right' }}>{r.count}</td>
                                <td style={{ textAlign: 'right' }}>{r.percentage}%</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ReportModal;
