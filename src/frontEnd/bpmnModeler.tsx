import React, { useEffect, useRef, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';

// Optional: default styles
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import CustomModule from './customModule';

const BpmnModelerComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: window },
      additionalModules: [ CustomModule ]
    });

    modelerRef.current.createDiagram()
      .then(() => {
        console.log('Blank BPMN diagram created');
      })
      .catch((err: any) => {
        console.error('Could not create BPMN diagram', err);
      });

    // Cleanup on unmount
    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  /**
   * Called when the user clicks "Export as BPMN XML"
   */
  const handleExport = useCallback(async () => {
    if (!modelerRef.current) return;
  
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) {
        console.error('No XML returned!');
        return;
      }
      // Instead of downloading locally, we send the XML to the server
      const response = await fetch('http://localhost:5002/convert_bpmn_to_pnml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpmnXml: xml })
      });
  
      if (!response.ok) {
        console.error(`Server error: ${response.statusText}`);
        return;
      }
  
      // The server returns PNML as text or a file
      const pnmlText = await response.text();
  
      // Force download on the client side
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
      console.error('Failed to convert to PNML:', err);
    }
  }, []);

  /**
   * A new button for going to LogPPL's upload page.
   */
  const goToLogPPL = useCallback(() => {
    // If LogPPL is running at e.g. http://localhost:5000
    // and "upload_page" is the route:
    window.location.href = 'http://localhost:5001/upload_page';
  }, []);

  return (
    <div style={{ width: '100%', height: '80vh' }}>
      {/* Export BPMN */}
      <button onClick={handleExport}>
        Export as BPMN XML
      </button>

      {/* NEW: Send to LogPPL */}
      <button onClick={goToLogPPL} style={{ marginLeft: '8px' }}>
        Go to LogPPL Upload
      </button>

      <div
        style={{
          width: '100%',
          height: 'calc(80vh - 40px)',
          border: '1px solid #ccc',
          marginTop: '8px'
        }}
        ref={containerRef}
      />
    </div>
  );
};

export default BpmnModelerComponent;
