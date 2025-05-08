import React from 'react';
import './style.css';

export interface ReportEntry {
    trace: string;
    count: number;
    percentage: number;
    avgTime: number;
}

export interface ReportModalProps {
    show: boolean;
    loading: boolean;
    error: string | null;
    report: ReportEntry[] | null;
    onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ show, loading, error, report, onClose }) => {
    if (!show) return null
    const cleanTrace = (trace: string) =>
        trace.split('→')
            .map(seg => seg.split(':')[0].trim())
            .join(' → ');

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-headers">
                  <button onClick={() => window.print()} className="modal-print">
                    🖨️ Print
                  </button>
                <button onClick={onClose} className="modal-close">
                    ×
                </button>
                </div>
                <h3>Simulation Report</h3>

                {loading && (
                    <div className="spinner" />
                )}

                {error && <p style={{ color: 'red' }}>Error: {error}</p>}

                {report && (
                    <table className="report-table">
                        <thead>
                        <tr>
                            <th>Trace</th>
                            <th>Count</th>
                            <th>%</th>
                            <th>Avg Time (min)</th>
                        </tr>
                        </thead>
                        <tbody>
                        {report.map((r, i) => (
                            <tr key={i}>
                                <td>{cleanTrace(r.trace)}</td>
                                <td>{r.count}</td>
                                <td>{r.percentage}%</td>
                                <td>{r.avgTime} min</td>
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
