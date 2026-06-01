from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from costing_engine import calculate_costing, find_matching_source, load_source_scenarios, verify_against_sources


app = Flask(__name__)


@app.get("/")
def index():
    scenarios = load_source_scenarios()
    return render_template("costing_calculator.html", scenarios=scenarios)


@app.post("/api/calculate")
def calculate():
    scenarios = load_source_scenarios()
    result = calculate_costing(request.get_json(silent=True) or {})
    source = find_matching_source(result["params"], scenarios)
    if source:
        result["source"] = source
        result["source_diff"] = {
            "final_offer": round(result["totals"]["final_offer"] - source["final_offer"], 2),
            "material_total": round(result["totals"]["material_total"] - source["material_total"], 2),
        }
    else:
        result["source"] = None
        result["source_diff"] = None
    return jsonify(result)


@app.get("/api/verify")
def verify():
    scenarios = load_source_scenarios()
    return jsonify({"count": len(scenarios), "results": verify_against_sources(scenarios)})


if __name__ == "__main__":
    app.run(debug=False, port=5055, use_reloader=False)
