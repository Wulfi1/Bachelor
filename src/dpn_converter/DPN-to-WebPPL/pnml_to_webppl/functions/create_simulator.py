def create_simulator_enabled_transitions_function(function_str, dpn, verbose):
    # Start the JS function string
    function_str += "var enabledTransitions = filter(function(x) {\nreturn "

    # Dynamically generate conditions based on transition names
    conditions = []
    for i, transition in enumerate(dpn.net.transitions):
        condition = f"(x == {i} && globalStore.enabled_{transition.name})"
        conditions.append(condition)

    # Join all conditions with '||'
    joined_conditions = "||\n".join(conditions)
    indices = ", ".join(str(i) for i in range(len(dpn.net.transitions)))

    # Finish constructing the function string
    function_str += f"{joined_conditions};\n}}, [{indices}]);\n\n"

    # Add the check for no enabled transitions
    function_str += (
                "if (globalStore." + str(list(dpn.final_marking.keys())[0]) + " > 0) {\n"
                + "  log_transition(\"End\");\n"
                + "  return;\n"
                + "}\n\n"
            )
    function_str += (
                "if (steps <= 0) {\n"
              +   "  log_transition(\"Stuck\");\n"
              +   "  return;\n"
              + "}\n\n"
            )
    function_str += (
                "if (enabledTransitions.length == 0) {\n"
              +   "  log_transition(\"Stuck\");\n"
              +   "  return;\n"
              + "}\n\n"
            )

    return function_str


def create_simulator_sample_transition_function(function_str, net, verbose):
    # --- weighted sampling: use explicit probabilities or default to uniform (1) ---
    function_str += """\
// build weight vector for enabled transitions
var weights = map(function(i) {
  var p = globalStore.probabilities[i];
  return (typeof p === 'number') ? p : 1;
}, enabledTransitions);

// compute total weight via reduce (no for‐loops in WebPPL)
var totalWeight = reduce(function(acc, w) {
  return acc + w;
}, 0, weights);

// normalize weights into a probability vector ps
var ps = map(function(w) {
  return w / totalWeight;
}, weights);

// debug print—uncomment if you need to inspect
// console.log('enabled=', enabledTransitions, 'weights=', weights, 'ps=', ps);

var transition = sample(Categorical({ vs: enabledTransitions, ps: ps }));\n\n

var id = globalStore.idList[transition];
var mn = globalStore.timeMinMap[id], mx = globalStore.timeMaxMap[id];
var dur = (typeof mn === 'number' && typeof mx === 'number') 
    ? uniform(mn, mx)
    : 0;
globalStore.totalTime = (globalStore.totalTime || 0) + dur;"""

    # --- logging and firing logic for each transition index ---
    for i, transition in enumerate(net.transitions):
        if i == 0:
            function_str += f"if (transition == {i}) {{\n"
        else:
            function_str += f"else if (transition == {i}) {{\n"
        function_str += f"  log_transition(\"{transition.label}\");\n"
        function_str += f"  fire_{transition.name}();\n"
        function_str += "}\n"

    # --- safety catch and recursive continuation ---
    function_str += """\
else {
  console.log("Selected illegal transition; should never happen.");
}
simulator_loop(steps - 1);
}\n\n"""
    return function_str


def create_simulator_init_function(function_str, verbose):
    function_str += """var simulator_loop = function(steps) {\n\n"""
    function_str += """globalStore.xesOutput = "";\n\n"""
    function_str += """globalStore.totalTime = 0;\n\n"""

    return function_str


def create_simulator_loop_function(function_str, dpn, verbose):
    function_str = create_simulator_init_function(function_str, verbose)
    function_str = create_simulator_enabled_transitions_function(function_str, dpn, verbose)
    function_str = create_simulator_sample_transition_function(function_str, dpn.net, verbose)

    return function_str


def create_simulator_function(function_str, steps, sample_size, dpn, verbose):
    # Initialize the JavaScript function string
    function_str += "var simulator = function(){\ninit();\n"

    # Dynamically add update_enabled_ function calls based on transitions
    for transition in dpn.net.transitions:
        function_str += f"update_enabled_{transition.name}();\n"

    function_str += "\n"

    # Add conditional logging

    function_str += """globalStore.trace += "<trace>\\n";\n\n"""

    # Add the simulator loop with the dynamic steps argument
    function_str += f"simulator_loop({steps});\n\n"

    # Add conditional logging

    function_str += """globalStore.trace += "</trace>\\n";\n\n"""
    function_str += """console.log(globalStore.trace);\n\n"""

    # Add the return statement

    function_str += f"return;\n}}\n\n"

    # Remove in later versions
    function_str += f"var dist = Infer({{\nmethod: 'forward', \nsamples: {sample_size},\n}},simulator);\n\n"

    return function_str