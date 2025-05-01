# file: app.py
import os
import sys
sys.path.append(os.path.abspath('C:/Users/sebastian.wulf/RiderProjects/Bachelor/src/dpn_converter/DPN-to-WebPPL'))
import traceback
from flask import Flask, request, make_response, jsonify
from flask_cors import CORS
import tempfile
import xml.etree.ElementTree as ET
import subprocess, re
from collections import Counter

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
    flow_targets = {}
    for sf in root.findall('.//bpmn:sequenceFlow', ns):
        fid = sf.get('id')
        prob = sf.get('{http://example.com/probability}probability')
        tgt  = sf.get('targetRef')
        if fid and prob is not None and tgt:
            flow_probs[fid]   = prob
            flow_targets[fid] = tgt
    return flow_probs, flow_targets

def inject_probs_on_transitions(pnml_str, flow_probs, flow_targets):
    root = ET.fromstring(pnml_str)
    for fid, prob in flow_probs.items():
        target_id = flow_targets.get(fid)
        if not target_id:
            continue
        trans = root.find(f".//{{*}}transition[@id='{target_id}']")
        if trans is not None:
            p = ET.Element('probability')
            p.set('value', prob)
            trans.append(p)
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

    flow_probs, flow_targets = parse_probabilities(bpmn_xml)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bpmn") as tmp_bpmn:
        tmp_bpmn_path = tmp_bpmn.name
        tmp_bpmn.write(bpmn_xml.encode('utf-8'))
        tmp_bpmn.flush()

    try:

        bpmn_graph = bpmn_importer.apply(tmp_bpmn_path)
        net, im, fm = bpmn_converter.apply(
            bpmn_graph,
            variant=bpmn_converter.Variants.TO_PETRI_NET,
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

        pnml_str = inject_probs_on_transitions(pnml_str, flow_probs, flow_targets)
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
    try:
        path_pnml   = os.path.abspath('generated/converted.pnml')
        webPPL_code = convert_dpn_to_webPPL(
            path_pnml, verbose=True,
            simulation_steps=10,
            sample_size=1000 
        )

        wppl_path = os.path.abspath('generated/simple_auction.wppl')
        with open(wppl_path, 'w', encoding='utf-8') as f:
            f.write(webPPL_code)

        cmd = ['npx', '--yes', 'webppl', wppl_path]
        app.logger.info(f"Spawning WebPPL: {cmd}")
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=30
        )

        stdout = proc.stdout
    
        raw_traces = re.findall(r'<trace>(.*?)</trace>', stdout, flags=re.DOTALL)
        
        simplified = []
        for block in raw_traces:
            activities = re.findall(r'<string key="concept:name" value="([^"]+)"', block)
            simplified.append(" → ".join(activities))
        
        counts = Counter(simplified)
        total = sum(counts.values()) or 1

        report = [{
            'trace': t.replace('\n',''),  
            'count': counts[t],
            'percentage': round(100.0 * counts[t] / total, 2)
        } for t in counts]

        return jsonify(report), 200

    except subprocess.CalledProcessError as e:
        app.logger.error(e.stdout)
        app.logger.error(e.stderr)
        return jsonify({
            'error':   'WebPPL execution failed',
            'stdout':  e.stdout,
            'stderr':  e.stderr
        }), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
