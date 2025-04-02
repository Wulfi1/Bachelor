import React, { useEffect, useRef, useState, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';

import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import ProbabilityExtension from './ProbabilityExtension';

const BpmnModelerComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  // Track selected SequenceFlow
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  // We store "Name" (display label) + "Probability"
  const [selectedFlowName, setSelectedFlowName] = useState('');
  const [selectedFlowProbability, setSelectedFlowProbability] = useState('');

  // Whether or not we let the user set probability parameters
  // (only if from an XOR that has 2+ outgoing flows)
  const [canSetParams, setCanSetParams] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: window },
      moddleExtensions: {
        probability: ProbabilityExtension
      }
    });

    modelerRef.current.createDiagram()
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
          // We only care if exactly one SequenceFlow is selected
          if (elem.type === 'bpmn:SequenceFlow') {
            setSelectedFlowId(elem.id);

            const bo = elem.businessObject;
            const nameVal = bo && bo.name ? bo.name : '';
            setSelectedFlowName(nameVal);

            const probVal = bo && bo.probability ? bo.probability : '';
            setSelectedFlowProbability(probVal);

            // Check if the source is an ExclusiveGateway + has >=2 outgoings
            let allowParams = false;
            if (bo && bo.sourceRef && bo.sourceRef.$type === 'bpmn:ExclusiveGateway') {
              // sourceRef.outgoing is an array of flows from that gateway
              const outgoingArr = bo.sourceRef.outgoing || [];
              if (outgoingArr.length >= 2) {
                allowParams = true;
              }
            }
            setCanSetParams(allowParams);

            return;
          }
        }

        // If not a single sequence flow
        setSelectedFlowId(null);
        setSelectedFlowName('');
        setSelectedFlowProbability('');
        setCanSetParams(false);
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

  // Input handlers
  const handleFlowNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFlowName(e.target.value);
  };
  const handleFlowProbabilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFlowProbability(e.target.value);
  };

  // "Update" the BPMN diagram with the combined label
  const handleUpdateFlow = useCallback(() => {
    if (!modelerRef.current || !selectedFlowId) return;

    const elementRegistry = modelerRef.current.get('elementRegistry') as any;
    const modeling = modelerRef.current.get('modeling') as any;
    const flowElement = elementRegistry.get(selectedFlowId);
    if (!flowElement) {
      console.warn('No flow found with ID=', selectedFlowId);
      return;
    }

    // Combine name + probability in the label
    const label = `${selectedFlowName} (${selectedFlowProbability})`;
    modeling.updateProperties(flowElement, {
      name: label,
      probability: selectedFlowProbability
    });

    console.log(`Updated ${selectedFlowId}`, { name: label, probability: selectedFlowProbability });
  }, [selectedFlowId, selectedFlowName, selectedFlowProbability]);

  // Original "Export as BPMN XML"
  const handleExport = useCallback(async () => {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        console.error('No XML returned!');
        return;
      }

      // POST to your server
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

  // Original "Go to LogPPL"
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

        {selectedFlowId && canSetParams && (
            <div
                style={{
                  position: 'absolute',
                  top: '60px',
                  right: '20px',
                  background: '#fff',
                  border: '1px solid #ccc',
                  padding: '8px'
                }}
            >
              <h4>SequenceFlow: {selectedFlowId}</h4>
              <div style={{ marginBottom: '6px' }}>
                <label style={{ marginRight: '4px' }}>Name:</label>
                <input
                    type="text"
                    value={selectedFlowName}
                    onChange={handleFlowNameChange}
                />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <label style={{ marginRight: '4px' }}>Probability:</label>
                <input
                    type="number"
                    step="0.01"
                    value={selectedFlowProbability}
                    onChange={handleFlowProbabilityChange}
                />
              </div>
              <button onClick={handleUpdateFlow}>
                Update
              </button>
            </div>
        )}

        {selectedFlowId && !canSetParams && (
            <div
                style={{
                  position: 'absolute',
                  top: '60px',
                  right: '20px',
                  background: '#fff',
                  border: '1px solid #ccc',
                  padding: '8px'
                }}
            >
              <h4>SequenceFlow: {selectedFlowId}</h4>
              <p>This flow is not from an XOR gateway with multiple outgoing edges.</p>
            </div>
        )}
      </div>
  );
};

export default BpmnModelerComponent;
