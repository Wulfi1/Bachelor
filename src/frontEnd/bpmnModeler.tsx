import React, { useEffect, useRef, useState, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';

import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import ProbabilityExtension from './ProbabilityExtension';

const BpmnModelerComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  // State for selected ExclusiveGateway and its outgoing flows
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(null);
  const [outgoingFlows, setOutgoingFlows] = useState<
      { id: string; name: string; probability: string }[]
  >([]);

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

  const goToLogPPL = useCallback(() => {
    window.location.href = 'http://localhost:5001/upload_page';
  }, []);

  return (
      <div style={{ width: '100%', height: '80vh', position: 'relative' }}>
        <button onClick={handleExport}>
          Export as BPMN XML
        </button>
        <button onClick={goToLogPPL} style={{ marginLeft: '8px' }}>
          Go to LogPPL Upload
        </button>

        <div
            ref={containerRef}
            style={{
              width: '100%',
              height: 'calc(80vh - 40px)',
              border: '1px solid #ccc',
              marginTop: '8px'
            }}
        />

        {selectedGatewayId && outgoingFlows.length > 1 && (
            <div
                style={{
                  position: 'absolute',
                  top: '60px',
                  right: '20px',
                  background: '#fff',
                  border: '1px solid #ccc',
                  padding: '8px',
                  maxHeight: '60vh',
                  overflowY: 'auto'
                }}
            >
              <h4>ExclusiveGateway: {selectedGatewayId}</h4>
              {outgoingFlows.map((flow) => (
                  <div key={flow.id} style={{ marginBottom: '10px' }}>
                    <div><strong>{flow.id}</strong></div>
                    <div>
                      <label style={{ marginRight: '4px' }}>Name:</label>
                      <input
                          type="text"
                          value={flow.name}
                          onChange={(e) =>
                              handleFlowFieldChange(flow.id, 'name', e.target.value)
                          }
                      />
                    </div>
                    <div>
                      <label style={{ marginRight: '4px' }}>Probability:</label>
                      <input
                          type="number"
                          step="0.01"
                          value={flow.probability}
                          onChange={(e) =>
                              handleFlowFieldChange(flow.id, 'probability', e.target.value)
                          }
                      />
                    </div>
                  </div>
              ))}
              {!isProbValid && (
                  <div style={{ color: 'red', marginBottom: '8px' }}>
                    Total probability does not sum up to 1. Please adjust.
                  </div>
              )}

              <button onClick={handleUpdateFlows} disabled={!isProbValid}>
                Update All
              </button>
            </div>
        )}
      </div>
  );
};

export default BpmnModelerComponent;
