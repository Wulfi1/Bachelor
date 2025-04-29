import React, { useEffect, useRef, useState, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import './style.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import ReportModal, { ReportEntry } from './report';


import ProbabilityExtension from './ProbabilityExtension';

const BpmnModelerComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  // State for selected ExclusiveGateway and its outgoing flows
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(null);
  const [outgoingFlows, setOutgoingFlows] = useState<
      { id: string; name: string; probability: string }[]
  >([]);
  
  //States for simulation report
  const [report, setReport] = useState<ReportEntry[] | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const totalProbability = outgoingFlows.reduce((sum, flow) => {
    const val = parseFloat(flow.probability);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const isProbValid = totalProbability === 1;

  useEffect(() => {
    if (!containerRef.current) return;

    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: window },
      moddleExtensions: {
        probability: ProbabilityExtension
      }
    });

    modelerRef.current
        .createDiagram()
        .then(() => {
          console.log('Blank BPMN diagram created with ProbabilityExtension');
        })
        .catch((err: any) => {
          console.error('Could not create BPMN diagram', err);
        });

    let offSelectionChanged: any;
    if (modelerRef.current) {
      const eventBus = modelerRef.current.get('eventBus') as any;
      offSelectionChanged = eventBus.on('selection.changed', (e: any) => {
        const newSel = e.newSelection || [];
        if (newSel.length === 1) {
          const elem = newSel[0];

          // Check for ExclusiveGateway
          if (elem.type === 'bpmn:ExclusiveGateway') {
            const bo = elem.businessObject;
            const outgoing = bo.outgoing || [];

            const flows = outgoing.map((flow: any) => ({
              id: flow.id,
              name: flow.name?.split(':')[0].trim() || '',
              probability: flow.probability || ''
            }));

            setSelectedGatewayId(elem.id);
            setOutgoingFlows(flows);
            return;
          }
        }

        // Clear if not a valid gateway
        setSelectedGatewayId(null);
        setOutgoingFlows([]);
      });
    }

    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
      if (offSelectionChanged) {
        offSelectionChanged();
      }
    };
  }, []);

  // Handle field updates
  const handleFlowFieldChange = (
      flowId: string,
      field: 'name' | 'probability',
      value: string
  ) => {
    setOutgoingFlows((prev) =>
        prev.map((flow) =>
            flow.id === flowId ? { ...flow, [field]: value } : flow
        )
    );
  };

  // Update the flows in the diagram
  const handleUpdateFlows = useCallback(() => {
    if (!modelerRef.current || !selectedGatewayId) return;

    const elementRegistry = modelerRef.current.get('elementRegistry') as any;
    const modeling = modelerRef.current.get('modeling') as any;

    outgoingFlows.forEach((flow) => {
      const flowElement = elementRegistry.get(flow.id);
      if (flowElement) {
        const label = `${flow.name}: ${flow.probability}`;
        modeling.updateProperties(flowElement, {
          name: label,
          probability: flow.probability
        });
      }
    });

    console.log('Updated outgoing flows of gateway', selectedGatewayId);
  }, [selectedGatewayId, outgoingFlows]);

  const handleExport = useCallback(async () => {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        console.error('No XML returned!');
        return;
      }

      const response = await fetch('http://localhost:5002/convert_bpmn_to_pnml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpmnXml: xml })
      });

      if (!response.ok) {
        console.error(`Server error: ${response.statusText}`);
        return;
      }

      const pnmlText = await response.text();
      const blob = new Blob([pnmlText], { type: 'application/xml' });
      const fileName = 'diagram.pnml';
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to convert BPMN to PNML:', err);
    }
  }, []);

  const handleSimulate = useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      const res = await fetch('http://localhost:5002/convert_pnml_to_webppl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnmlXml: 'dummy' })
      });
      if (!res.ok) throw new Error(res.statusText);
      const data: ReportEntry[] = await res.json();
      setReport(data);
      setShowReport(true);
    } catch (err: any) {
      console.error(err);
      setReportError(err.message);
      setShowReport(true);
    } finally {
      setLoadingReport(false);
    }
  }, []);

  const goToLogPPL = useCallback(() => {
    window.location.href = 'http://localhost:5001/upload_page';
  }, []);

  return (
      <div style={{ width: '100%', height: '80vh', position: 'relative' }}>
        <button onClick={handleExport}>
          Export as BPMN XML
        </button>
        <button onClick={goToLogPPL} style={{ marginLeft: 8 }}>
          Go to LogPPL Upload
        </button>
        <button onClick={handleSimulate} style={{ marginLeft: 8 }}>
          Simulate
        </button>

        <div
            ref={containerRef}
            style={{
              width: '100%',
              height: 'calc(80vh - 40px)',
              border: '1px solid #ccc',
              marginTop: 8
            }}
        />

        {selectedGatewayId && outgoingFlows.length > 1 && (
            <div
                style={{
                  position: 'absolute',
                  top: 60,
                  right: 20,
                  background: '#fff',
                  border: '1px solid #ccc',
                  padding: 8,
                  maxHeight: '60vh',
                  overflowY: 'auto'
                }}
            >
              <h4>ExclusiveGateway</h4>
              {outgoingFlows.map(flow => (
                  <div key={flow.id} style={{ marginBottom: 10 }}>
                    <div><strong>Flow</strong></div>
                    <div>
                      <label style={{ marginRight: 4 }}>Name:</label>
                      <input
                          type="text"
                          value={flow.name}
                          onChange={e => handleFlowFieldChange(flow.id, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ marginRight: 4 }}>Probability:</label>
                      <input
                          type="number"
                          step="0.01"
                          value={flow.probability}
                          onChange={e => handleFlowFieldChange(flow.id, 'probability', e.target.value)}
                      />
                    </div>
                  </div>
              ))}
              {!isProbValid && (
                  <div style={{ color: 'red', marginBottom: 8 }}>
                    Total probability does not sum up to 1. Please adjust.
                  </div>
              )}
              <button onClick={handleUpdateFlows} disabled={!isProbValid}>
                Update All
              </button>
            </div>
        )}
        <ReportModal
            show={showReport}
            loading={loadingReport}
            error={reportError}
            report={report}
            onClose={() => setShowReport(false)}
        />
      </div>
  );
};

export default BpmnModelerComponent;
