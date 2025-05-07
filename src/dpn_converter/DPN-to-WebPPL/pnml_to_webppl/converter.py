import xml.etree.ElementTree as ET
import pnml_to_webppl.functions.create_init as init_function
import pnml_to_webppl.functions.create_enabler as enabler_function
from pnml_to_webppl.dpn import DPN
from pnml_to_webppl.functions.create_logging import create_logging as logging_function
import pnml_to_webppl.functions.create_firing as firing_function
from pnml_to_webppl.functions.create_simulator import create_simulator_loop_function, create_simulator_function
import pnml_to_webppl.functions.utils_string as utils_string
from pnml_to_webppl.functions.utils import rename_variable_names
#fml

def convert_dpn_to_webPPL(path, verbose, simulation_steps, sample_size):
    dpn  = DPN(path)
    tree = ET.parse(path)
    root = tree.getroot()

    transition_ids = [t.name for t in dpn.net.transitions]

    # Extract probabilities and time intervals from PNML
    prob_map     = {}
    time_min_map = {}
    time_max_map = {}
    for t in dpn.net.transitions:
        # probability
        pe = root.find(f".//transition[@id='{t.name}']/probability")
        if pe is not None and pe.get('value') is not None:
            prob_map[t.name] = float(pe.get('value'))
        # time interval
        te = root.find(f".//transition[@id='{t.name}']/time")
        if te is not None:
            if te.get('min') is not None and te.get('max') is not None:
                time_min_map[t.name] = float(te.get('min'))
                time_max_map[t.name] = float(te.get('max'))

    # Serialize JS header: idList, probMap, probabilities
    js_id_list          = ",".join(f'"{tid}"' for tid in transition_ids)
    js_prob_entries     = ",".join(f'"{tid}":{prob_map[tid]}' for tid in transition_ids if tid in prob_map)
    js_time_min_entries = ",".join(f'"{tid}":{time_min_map[tid]}' for tid in transition_ids if tid in time_min_map)
    js_time_max_entries = ",".join(f'"{tid}":{time_max_map[tid]}' for tid in transition_ids if tid in time_max_map)

    header = f"""
// Transition IDs in sampling order
var idList = [{js_id_list}];

// Probabilities map (default 1)
var probMap = {{ {js_prob_entries} }};
var probabilities = map(function(id) {{ return probMap[id] != null ? probMap[id] : 1; }}, idList);

// Time interval maps and sampled durations
var timeMinMap = {{ {js_time_min_entries} }};
var timeMaxMap = {{ {js_time_max_entries} }};
var durations   = map(function(id) {{ 
    var mn = timeMinMap[id], mx = timeMaxMap[id]; 
    return (typeof mn === 'number' && typeof mx === 'number') 
           ? uniform(mn, mx) 
           : 0; 
}}, idList);

// Store globally
globalStore.idList        = idList;
globalStore.probabilities = probabilities;
globalStore.durations    = durations;

"""

    # Initialize WebPPL function string with header
    function_str = header
    function_str += init_function.create_init_function(dpn, verbose)

    # Normalize names
    dpn = utils_string.string_to_long(dpn)
    dpn.net = rename_variable_names(dpn.net)

    # Add enabler logic
    function_str = enabler_function.create_enabler_function(function_str, dpn, verbose)

    # Add firing functions
    function_str += firing_function.generate_firings(dpn)

    # Add logging
    function_str = logging_function(function_str, dpn, verbose)

    # Create simulator loop and main
    function_str = create_simulator_loop_function(function_str, dpn, verbose)
    function_str = create_simulator_function(
        function_str,
        simulation_steps,
        sample_size,
        dpn,
        verbose
    )

    return function_str
