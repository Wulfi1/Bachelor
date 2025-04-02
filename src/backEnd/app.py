# file: app.py
import os
import traceback
from flask import Flask, request, make_response
from flask_cors import CORS
import tempfile

from pm4py.objects.bpmn.importer import importer as bpmn_importer
from pm4py.objects.conversion.bpmn import converter as bpmn_converter
from pm4py.objects.petri_net.exporter import exporter as pnml_exporter

import xml.etree.ElementTree as ET

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

def parse_probabilities(bpmn_xml_str):
    root = ET.fromstring(bpmn_xml_str)
    ns = {
        'bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
        'prob': 'http://example.com/probability'
    }
    flow_probs = {}
    for seq_flow in root.findall('.//bpmn:sequenceFlow', ns):
        fid = seq_flow.get('id')
        if fid:
            prob_val = seq_flow.get('{http://example.com/probability}probability')
            if prob_val is not None:
                flow_probs[fid] = prob_val
    return flow_probs

def inject_probs_on_transitions(pnml_str, flow_probs):
    root = ET.fromstring(pnml_str)
    for trans_el in root.findall('.//{*}transition'):
        trans_id = trans_el.get('id', '')
        # If PM4Py used the prefix "sfl_Flow_..."
        for bpmn_flow_id, prob_val in flow_probs.items():
            # if your BPMN had "Flow_0pz3pqz", we can see if that is a substring
            # of "sfl_Flow_0pz3pqz"
            if bpmn_flow_id in trans_id:
                prob_elem = ET.Element('probability')
                prob_elem.set('value', prob_val)
                trans_el.append(prob_elem)
                break  # break if only one match
    return ET.tostring(root, encoding='utf-8', method='xml').decode('utf-8')


@app.route('/convert_bpmn_to_pnml', methods=['POST'])
def convert_bpmn_to_pnml():
    data = request.get_json()
    if not data or 'bpmnXml' not in data:
        return "Missing bpmnXml", 400

    bpmn_xml = data['bpmnXml']

    # Step 1: parse BPMN for custom probabilities
    flow_probs = parse_probabilities(bpmn_xml)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bpmn") as tmp_bpmn:
        tmp_bpmn_path = tmp_bpmn.name
        tmp_bpmn.write(bpmn_xml.encode('utf-8'))
        tmp_bpmn.flush()

    try:
        # Step 2: read BPMN via PM4Py
        bpmn_graph = bpmn_importer.apply(tmp_bpmn_path)

        # Step 3: convert BPMN to Petri net
        net, im, fm = bpmn_converter.apply(
            bpmn_graph,
            variant=bpmn_converter.Variants.TO_PETRI_NET
        )

        # Step 4: export Petri net to PNML (as normal)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pnml") as tmp_pnml:
            tmp_pnml_path = tmp_pnml.name

        pnml_exporter.apply(net, im, tmp_pnml_path)

        with open(tmp_pnml_path, 'r', encoding='utf-8') as f:
            pnml_str = f.read()

        # Step 5: post-process that PNML, injecting <probability/> for arcs 
        # that correspond to the original BPMN flows
        updated_pnml_str = inject_probs_on_transitions(pnml_str, flow_probs)

        # Step 6: return final PNML
        resp = make_response(updated_pnml_str, 200)
        resp.mimetype = "application/xml"
        return resp

    except Exception as e:
        traceback.print_exc()
        return f"Error: {str(e)}", 500
    finally:
        if os.path.exists(tmp_bpmn_path):
            os.unlink(tmp_bpmn_path)

        # optional: remove the tmp_pnml_path as well
        # if os.path.exists(tmp_pnml_path):
        #    os.unlink(tmp_pnml_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
