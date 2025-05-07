# file: helpers.py
import xml.etree.ElementTree as ET

def parse_probabilities(bpmn_xml_str):
    """Return two dicts: flow_id → probability, flow_id → targetRef."""
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
    """Inject <probability value="..."/> into the correct <transition> tags."""
    root = ET.fromstring(pnml_str)
    transitions = { t.get('id'): t for t in root.findall('.//{*}transition') }

    for fid, prob in flow_probs.items():
        target_id = flow_targets.get(fid, "")
        trans = transitions.get(target_id) or transitions.get(fid)
        if not trans:
            print(f"[inject_probs] no transition for flow {fid}→{target_id}")
            continue
        p = ET.Element('probability')
        p.set('value', prob)
        trans.append(p)

    return ET.tostring(root, encoding='utf-8', method='xml').decode('utf-8')

def parse_time_intervals(bpmn_xml_str):
    """Return dict task_id → (min, max)."""
    root = ET.fromstring(bpmn_xml_str)
    ns = {
        'bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
        'time': 'http://example.com/time'
    }
    time_map = {}
    for task in root.findall('.//bpmn:task', ns):
        tid  = task.get('id')
        tmin = task.get('{http://example.com/time}timeMin')
        tmax = task.get('{http://example.com/time}timeMax')
        if tid and tmin is not None and tmax is not None:
            time_map[tid] = (float(tmin), float(tmax))
    return time_map

def inject_times_on_transitions(pnml_str, time_map):
    """Inject <time min=".." max=".."/> under each <transition>."""
    root = ET.fromstring(pnml_str)
    for t in root.findall('.//{*}transition'):
        tid = t.get('id')
        if tid in time_map:
            tmin, tmax = time_map[tid]
            time_el = ET.Element('time', {'min': str(tmin), 'max': str(tmax)})
            t.append(time_el)
    return ET.tostring(root, encoding='utf-8', method='xml').decode('utf-8')

def inject_final_markings(pnml_str, fm):
    """Replace or append a finalmarkings block from a PM4Py final marking."""
    root = ET.fromstring(pnml_str)
    net_elem = root.find('.//{*}net')
    if net_elem is None:
        return pnml_str

    # remove old
    for old in net_elem.findall('finalmarkings'):
        net_elem.remove(old)

    fm_block = ET.Element('finalmarkings')
    marking  = ET.Element('marking')
    for place_obj, tokens in fm.items():
        p = ET.Element('place', {'idref': getattr(place_obj, 'id', str(place_obj))})
        txt = ET.Element('text'); txt.text = str(tokens)
        p.append(txt)
        marking.append(p)
    fm_block.append(marking)
    net_elem.append(fm_block)

    return ET.tostring(root, encoding='utf-8', method='xml').decode('utf-8')
