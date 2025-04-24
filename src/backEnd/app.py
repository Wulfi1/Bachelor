# file: app.py
import os
import sys
sys.path.append(os.path.abspath('C:/Users/sebastian.wulf/RiderProjects/Bachelor/src/dpn_converter/DPN-to-WebPPL'))
import traceback
from flask import Flask, request, make_response
from flask_cors import CORS
import tempfile
import xml.etree.ElementTree as ET

from pm4py.objects.bpmn.importer import importer as bpmn_importer
from pm4py.objects.conversion.bpmn import converter as bpmn_converter
from pm4py.objects.petri_net.exporter import exporter as pnml_exporter
from pm4py import generate_marking
from pnml_to_webppl.converter import convert_dpn_to_webPPL

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
        for bpmn_flow_id, prob_val in flow_probs.items():
            if bpmn_flow_id in trans_id:
                prob_elem = ET.Element('probability')
                prob_elem.set('value', prob_val)
                trans_el.append(prob_elem)
                break  
    return ET.tostring(root, encoding='utf-8', method='xml').decode('utf-8')

def inject_final_markings(pnml_str, fm):
    root = ET.fromstring(pnml_str)
    net_elem = root.find('.//{*}net')
    if net_elem is None:
        return pnml_str

    for old in net_elem.findall('finalmarkings'):
        net_elem.remove(old)

    fm_block = ET.Element('finalmarkings')
    marking = ET.Element('marking')
    for place_obj, tokens in fm.items():
        p = ET.Element('place', { 'idref': getattr(place_obj, 'id', str(place_obj)) })
        txt = ET.Element('text')
        txt.text = str(tokens)
        p.append(txt)
        marking.append(p)
    fm_block.append(marking)

    net_elem.append(fm_block)

    return ET.tostring(root, encoding='utf-8', method='xml').decode('utf-8')


@app.route('/convert_bpmn_to_pnml', methods=['POST'])
def convert_bpmn_to_pnml():
    data = request.get_json()
    if not data or 'bpmnXml' not in data:
        return "Missing bpmnXml", 400

    bpmn_xml = data['bpmnXml']

    flow_probs = parse_probabilities(bpmn_xml)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bpmn") as tmp_bpmn:
        tmp_bpmn_path = tmp_bpmn.name
        tmp_bpmn.write(bpmn_xml.encode('utf-8'))
        tmp_bpmn.flush()

    try:

        bpmn_graph = bpmn_importer.apply(tmp_bpmn_path)
        net, im, fm = bpmn_converter.apply(
            bpmn_graph,
            variant=bpmn_converter.Variants.TO_PETRI_NET
        )

        if not fm or len(fm) == 0:
            fm = generate_marking(net)
        net.final_marking = fm

        destination_folder = os.path.join('generated')
        os.makedirs(destination_folder, exist_ok=True)
        output_filename = 'converted.pnml'
        output_file_path = os.path.join(destination_folder, output_filename)
        pnml_exporter.apply(net, im, output_file_path)

        with open(output_file_path, 'r', encoding='utf-8') as f:
            pnml_str = f.read()

        pnml_str = inject_probs_on_transitions(pnml_str, flow_probs)
        pnml_str = inject_final_markings(pnml_str, fm)
    
        with open(output_file_path, 'w', encoding='utf-8') as f:
            f.write(pnml_str)
    
        resp = make_response(pnml_str, 200)
        resp.mimetype = "application/xml"
        return resp
    
    except Exception as e:
        traceback.print_exc()
        return f"Error: {str(e)}", 500
    finally:
        if os.path.exists(tmp_bpmn_path):
            os.unlink(tmp_bpmn_path)

@app.route('/convert_pnml_to_webppl', methods=['POST'])
def convert_pnml_to_webppl():
    data = request.get_json()
    if not data or 'pnmlXml' not in data:
        return "Missing pnmlXml", 400

    path_pnml = os.path.abspath('generated/converted.pnml')

    webPPL_file = convert_dpn_to_webPPL(path_pnml, verbose=True, simulation_steps=10, sample_size=10)
    print(webPPL_file)

    with open('simple_auction.wppl', 'w') as f:
        f.write(webPPL_file)

    return "Conversion complete", 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
