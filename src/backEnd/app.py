# file: app.py
import os
import sys
sys.path.append(os.path.abspath('C:/Users/sebastian.wulf/RiderProjects/Bachelor/src/dpn_converter/DPN-to-WebPPL'))
import traceback
from flask import Flask, request, make_response, jsonify, send_file
from flask_cors import CORS
import tempfile
import subprocess, re
from collections import Counter

from pm4py.objects.bpmn.importer import importer as bpmn_importer
from pm4py.objects.conversion.bpmn import converter as bpmn_converter
from pm4py.objects.petri_net.exporter import exporter as pnml_exporter
from pm4py import generate_marking
from pnml_to_webppl.converter import convert_dpn_to_webPPL
import helpers

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/convert_bpmn_to_pnml', methods=['POST'])
def convert_bpmn_to_pnml():
    data = request.get_json()
    if not data or 'bpmnXml' not in data:
        return "Missing bpmnXml", 400

    bpmn_xml = data['bpmnXml']

    flow_probs, flow_targets = helpers.parse_probabilities(bpmn_xml)
    time_map = helpers.parse_time_intervals(bpmn_xml)

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

        pnml_str = helpers.inject_probs_on_transitions(pnml_str, flow_probs, flow_targets)
        pnml_str = helpers.inject_times_on_transitions(pnml_str, time_map)
        pnml_str = helpers.inject_final_markings(pnml_str, fm)
    
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
    if not data:
        return "No data received in simulation", 400
    
    simulationSteps = data['simulationSteps']
    sampleSize = data['sampleSize']
    download        = data.get('download', False)
    
    
    path_pnml   = os.path.abspath('generated/converted.pnml')
    webPPL_code = convert_dpn_to_webPPL(
        path_pnml, verbose=True,
        simulation_steps=simulationSteps,
        sample_size=sampleSize 
    )

    wppl_path = os.path.abspath('generated/simple_auction.wppl')
    with open(wppl_path, 'w', encoding='utf-8') as f:
        f.write(webPPL_code)

    if download:
        return send_file(
            wppl_path,
            as_attachment=True,
            download_name='model.wppl',
            mimetype='application/javascript'
        )


    try:
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

        trace_times = []
        for block in raw_traces:
            activities = re.findall(r'<string key="concept:name" value="([^"]+)"', block )
            trace_str = " → ".join(activities)

            time_strs = re.findall(r'<string key="totalTime" value="([^"]+)"', block)
            # if no tags found, fall back to None
            if time_strs:
                    total_time = sum(float(t) for t in time_strs)
            else:
                total_time = None

            trace_times.append((trace_str, total_time))

        from collections import defaultdict
        time_lists = defaultdict(list)
        for tr, tt in trace_times:
            if tt is not None:
                time_lists[tr].append(tt)

        counts = Counter(tr for tr, _ in trace_times)
        total_runs = len(trace_times) or 1

        report = []
        for tr, times in time_lists.items():
            count      = counts[tr]
            percentage = round(100.0 * count / total_runs, 2)
            avg_time   = round(sum(times) / len(times), 2)
            report.append({
                'trace':      tr,
                'count':      count,
                'percentage': percentage,
                'avgTime':    avg_time
            })

        return jsonify(report), 200

    except subprocess.CalledProcessError as e:
        app.logger.error(e.stdout)
        app.logger.error(e.stderr)
        return jsonify({
            'error':  'WebPPL execution failed',
            'stdout': e.stdout,
            'stderr': e.stderr
        }), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
