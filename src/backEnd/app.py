# file: app.py
import os
import traceback
from flask import Flask, request, make_response
from flask_cors import CORS
from pm4py.objects.bpmn.importer import importer as bpmn_importer
from pm4py.objects.conversion.bpmn import converter as bpmn_converter
from pm4py.objects.petri_net.exporter import exporter as pnml_exporter
import tempfile

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/convert_bpmn_to_pnml', methods=['POST'])
def convert_bpmn_to_pnml():
    """
    Expects JSON payload: { "bpmnXml": "<bpmn>...</bpmn>" }
    Returns PNML as text.
    """
    data = request.get_json()
    if not data or 'bpmnXml' not in data:
        return "Missing bpmnXml", 400

    bpmn_xml = data['bpmnXml']

    # 1) Write BPMN XML to a temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bpmn") as tmp_bpmn:
        tmp_bpmn_path = tmp_bpmn.name
        tmp_bpmn.write(bpmn_xml.encode('utf-8'))
        tmp_bpmn.flush()

    try:
        # 2) Use PM4Py to read BPMN
        bpmn_graph = bpmn_importer.apply(tmp_bpmn_path)

        # 3) Convert to Petri net
        net, im, fm = bpmn_converter.apply(
            bpmn_graph,
            variant=bpmn_converter.Variants.TO_PETRI_NET
        )

        # 4) Export Petri net to PNML in memory or to a temp file
        # pm4py's exporter wants a file path, so let's do it in a second temp file:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pnml") as tmp_pnml:
            tmp_pnml_path = tmp_pnml.name

        pnml_exporter.apply(net, im, tmp_pnml_path)

        # read it back
        with open(tmp_pnml_path, 'r', encoding='utf-8') as f:
            pnml_str = f.read()

        # 5) Return PNML as text
        resp = make_response(pnml_str, 200)
        resp.mimetype = "application/xml"
        return resp

    except Exception as e:
        traceback.print_exc()
        return f"Error: {str(e)}", 500
    finally:
        # cleanup if you want
        os.unlink(tmp_bpmn_path)
        # optionally remove tmp_pnml_path as well

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
