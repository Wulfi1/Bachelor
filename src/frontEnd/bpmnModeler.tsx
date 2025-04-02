import React, { useEffect, useRef, useState, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';

// Optional BPMN modeler styles
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import ProbabilityExtension from './ProbabilityExtension';

const BpmnModelerComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  // State to hold which sequenceFlow is selected + its current prob
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlowProb, setSelectedFlowProb] = useState<string>('');

  useEffect(() => {
    if (!containerRef.current) return;

    // 1) Create BPMN modeler with ProbabilityExtension
    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: window },
      moddleExtensions: {
        probability: ProbabilityExtension
      }
    });

    modelerRef.current.createDiagram()
        .then(() => {
          console.log('Blank BPMN diagram created (with ProbabilityExtension).');
        })
        .catch((err: any) => {
          console.error('Could not create BPMN diagram', err);
        });

    // 2) Listen for selection changes
    // We'll store the subscription in a variable so we can remove it on unmount
    let eventBusOff: any;

    const modeler = modelerRef.current;
    if (modeler) {
      const eventBus = modeler.get('eventBus') as any;
      eventBusOff = eventBus.on('selection.changed', (e: any) => {
        const newSelection = e.newSelection || [];
        if (newSelection.length === 1) {
          const element = newSelection[0];
          // We check if it's a SequenceFlow
          if (element.type === 'bpmn:SequenceFlow') {
            setSelectedFlowId(element.id);
            // read the probability from the businessObject
            const bo = element.businessObject;
            // the property name is 'probability', as per ProbabilityExtension
            const prob = bo && bo.probability ? bo.probability : '';
            setSelectedFlowProb(prob);
            return;
          }
        }
        // if none or multiple selected, or not a SequenceFlow, reset
        setSelectedFlowId(null);
        setSelectedFlowProb('');
      });
    }

    // Cleanup on unmount
    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
      if (eventBusOff) {
        // eventBus.off( 'selection.changed', eventBusOff ) is the typical pattern
        // but eventBusOff might be a function we can call to remove
        // depending on bpmn-js version:
        eventBusOff(); // might do it if the returned object is a remover
      }
    };
  }, []);

  // 3) Let user type in a new probability => update our local state
  const handleProbChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFlowProb(event.target.value);
  };

  // 4) Commit that new probability to the BPMN diagram
  const handleUpdateProbability = useCallback(() => {
    if (!modelerRef.current || !selectedFlowId) return;

    const elementRegistry = modelerRef.current.get('elementRegistry') as any;
    const modeling = modelerRef.current.get('modeling') as any;
    const flowElement = elementRegistry.get(selectedFlowId);
    if (!flowElement) {
      console.warn('Flow not found: ', selectedFlowId);
      return;
    }
    modeling.updateProperties(flowElement, {
      probability: selectedFlowProb
    });
    console.log(`Updated ${selectedFlowId} prob to `, selectedFlowProb);
  }, [selectedFlowId, selectedFlowProb]);

  // Export as BPMN
  const handleExport = useCallback(async () => {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        console.error('No XML returned!');
        return;
      }
      // Instead of local download, we send the XML to a server
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
      // Force client-side download
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
      console.error('Failed to export BPMN and convert to PNML:', err);
    }
  }, []);

  // Some extra button
  const goToLogPPL = useCallback(() => {
    window.location.href = 'http://localhost:5001/upload_page';
  }, []);

  return (
      <div style={{ width: '100%', height: '80vh' }}>
        <button onClick={handleExport}>
          Export as BPMN XML
        </button>
        <button onClick={goToLogPPL} style={{ marginLeft: '8px' }}>
          Go to LogPPL Upload
        </button>

        {/* The main BPMN canvas */}
        <div
            style={{
              width: '100%',
              height: 'calc(80vh - 40px)',
              border: '1px solid #ccc',
              marginTop: '8px'
            }}
            ref={containerRef}
        />

        {/* If we have a selected sequenceFlow, show a small "property editor" */}
        {selectedFlowId && (
            <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '20px',
                  background: '#f0f0f0',
                  padding: '8px',
                  border: '1px solid #ccc'
                }}
            >
              <h4>Sequence Flow: {selectedFlowId}</h4>
              <label>Probability:&nbsp;</label>
              <input
                  type="number"
                  step="0.01"
                  value={selectedFlowProb}
                  onChange={handleProbChange}
              />
              <button onClick={handleUpdateProbability}>
                Update
              </button>
            </div>
        )}
      </div>
  );
};

export default BpmnModelerComponent;
