import React from 'react';
import BpmnModelerComponent from './bpmnModeler';

function App() {
    return (
        <div
            className="App"
            style={{
                margin: '0',
                padding: '0',
                minHeight: '100vh',
                border: '4px solid blue', 
                boxSizing: 'border-box'
            }}
        >
            <div style={{ marginLeft: 22 }}>
                <h1>My BPMN Modeler</h1>
            </div>
            <BpmnModelerComponent />
        </div>
    );
}

export default App;
