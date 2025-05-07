import React, { useEffect, useRef, useState, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import './style.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import ReportModal, { ReportEntry } from './report';
import GatewayDialog, {Flow} from './gateWayDialog';
import TaskDialog, { TaskProps } from './taskDialog';

import customPaletteProvider from "./customPaletteProvider";
import ProbabilityExtension from "./ProbabilityExtension";
import TimeExtension from "./TimeExtension";

const BpmnModelerComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  // State for selected ExclusiveGateway and its outgoing flows
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(null);
  const [outgoingFlows, setOutgoingFlows] = useState<Flow[]>([]);
  
  // State for selected Activity
  const [selectedTask, setSelectedTask] = useState<TaskProps | null>(null);
  
  // States for simulation report
  const [report, setReport] = useState<ReportEntry[] | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // New state for simulation parameters
  const [sampleSize, setSampleSize] = useState<string>("10");
  const [simulationSteps, setSimulationSteps] = useState<string>("10");

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
        probability: ProbabilityExtension,
        time: TimeExtension
      },
      additionalModules: [ customPaletteProvider ]
    });

    modelerRef.current
        .createDiagram()
        .then(() => {
          console.log('Blank BPMN diagram created');
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
            setSelectedTask(null);
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
          
          if (elem.type === 'bpmn:Task') {
            const bo = elem.businessObject;
            setSelectedTask({
              id: elem.id,
              name: bo.name?.split(':')[0].trim() || '',
              timeMin: bo.timeMin ? parseInt(bo.timeMin, 10) : 0,
              timeMax: bo.timeMax ? parseInt(bo.timeMax, 10) : 0
            });
            setOutgoingFlows([]);
            return;
          }
        }

        // Clear if not a valid gateway
        setSelectedGatewayId(null);
        setOutgoingFlows([]);
        setSelectedTask(null);
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


  const handleTaskFieldChange = (field: 'name'|'timeMin'|'timeMax', value: string) => {
    if (!selectedTask) return;
    setSelectedTask({
      ...selectedTask,
      [field]:
          field === 'name'
              ? value
              : parseInt(value, 10)
    });
  };

  const handleUpdateTask = useCallback(() => {
    if (!modelerRef.current || !selectedTask) return;
    const modeling = modelerRef.current.get('modeling') as any;
    const elementRegistry = modelerRef.current.get('elementRegistry') as any;
    const taskElem = elementRegistry.get(selectedTask.id);
    const label = `${selectedTask.name}: \n ${selectedTask.timeMin}-${selectedTask.timeMax} min`;
    modeling.updateProperties(taskElem, {
      name: label,
      timeMin: String(selectedTask.timeMin),
      timeMax: String(selectedTask.timeMax)
    });
    setSelectedTask(null);
  }, [selectedTask]);


  const handleExport = useCallback(async (downloadFile: boolean) => {
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
        body: JSON.stringify({ bpmnXml: xml, download: downloadFile })
      });

      if (!response.ok) {
        console.error(`Server error: ${response.statusText}`);
        return;
      }
      
      if(downloadFile) {
        const pnmlText = await response.text();
        const blob = new Blob([pnmlText], {type: 'application/xml'});
        const fileName = 'diagram.pnml';
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to convert BPMN to PNML:', err);
    }
  }, []);

  const handleSimulate = useCallback(async () => {
    await handleExport(false);
    setLoadingReport(true);
    setShowReport(true);
    setReportError(null);
    try {
      const res = await fetch('http://localhost:5002/convert_pnml_to_webppl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnmlXml: 'dummy', simulationSteps, sampleSize})
      });
      if (!res.ok) throw new Error(res.statusText);
      const data: ReportEntry[] = await res.json();
      setReport(data);
    } catch (err: any) {
      console.error(err);
      setReportError(err.message);
    } finally {
      setLoadingReport(false);
    }
  }, [sampleSize, simulationSteps, handleExport]);

  return (
      <div style={{ width: '100%', height: '80vh', position: 'relative' }}>
        <button onClick={() => handleExport(true)} style={{ marginLeft: 22 }} className="button">
          Export as PNML
        </button>
        <button onClick={handleSimulate} style={{ marginLeft: 8 }} className="button">
          Simulate
        </button>
        <span style={{ marginLeft: 12, fontSize: '0.9rem' }}>
        Sample size:
        <input
            type="number"
            value={sampleSize}
            onChange={e => setSampleSize(e.target.value)}
            placeholder=""
            style={{ width: 60, margin: '0 8px' }}
        />
        Simulation steps:
        <input
            type="number"
            value={simulationSteps}
            onChange={e => setSimulationSteps(e.target.value)}
            placeholder=""
            style={{ width: 60, margin: '0 8px' }}
        />
      </span>
        <div
            ref={containerRef}
            style={{
              width: '100%',
              height: 'calc(80vh - 40px)',
              border: '1px solid #ccc',
              marginTop: 8
            }}
        />
        <GatewayDialog
            flows={outgoingFlows}
            isValid={isProbValid}
            onFieldChange={handleFlowFieldChange}
            onUpdate={handleUpdateFlows}
        />
        {selectedTask && <TaskDialog
            task={selectedTask}
            onFieldChange={handleTaskFieldChange}
            onUpdate={handleUpdateTask}
            onClose={() => setSelectedTask(null)}
        />}
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
