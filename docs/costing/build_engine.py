"""
Reads extracted_costing.json and prints the COMPONENT_DATA Python constant
ready to paste into app.py.
"""
import json, math

with open('C:/Users/User/Documents/GitHub/fuzi/docs/costing/extracted_costing.json') as f:
    raw = json.load(f)

CAPS = ['6','8','10','13','15','20','26']
CFGS = ['MS Auto Door','SS Auto Door','MS Manual Door','SS Manual Door',
        'MS Gearless Auto Door','SS Gearless Auto Door']

def get_unit(cap, item_name, cfg):
    rows = raw[cap]['items'].get(item_name, [])
    if not rows: return None
    v = rows[0]['unit_costs'].get(cfg)
    return v if isinstance(v, (int,float)) and v > 0 else None

def get_total(cap, item_name, cfg):
    rows = raw[cap]['items'].get(item_name, [])
    if not rows: return None
    v = rows[0]['totals'].get(cfg)
    return v if isinstance(v, (int,float)) and v > 0 else None

def get_qty(cap, item_name):
    rows = raw[cap]['items'].get(item_name, [])
    if not rows: return None
    return rows[0].get('qty') or rows[0].get('qty_actual')

def fallback(v, default):
    return v if v is not None else default

# LOP/COP lookup (same across all sheets)
LOPCOP = {2:14000, 3:16450, 4:18900, 5:21350, 6:23800, 7:26250, 8:28700, 9:31150, 10:33600}

# For gearless bracket: extract from the second Bracket row (side counter)
def get_gearless_bracket_rate(cap):
    rows = raw[cap]['items'].get('Bracket', [])
    if len(rows) < 2: return 1350  # fallback
    v = rows[1]['unit_costs'].get('MS Gearless Auto Door')
    return v if isinstance(v,(int,float)) and v > 0 else 1350

# Rope parsing: extract total_meters at 4 stops and num_ropes from description
def parse_rope(cap, cfg):
    rows = raw[cap]['items'].get('Rope', [])
    gearless = 'Gearless' in cfg
    for r in rows:
        uc = r['unit_costs'].get(cfg)
        if uc is None or not isinstance(uc, (int,float)) or uc <= 0:
            continue
        qty = r.get('qty_actual') or r.get('qty')
        if not isinstance(qty, (int,float)) or qty <= 0:
            continue
        # Parse num_ropes from the qty_actual field of other rows
        # Actually we need to look at the item description
        return {'rate': uc, 'total_meters_4_stops': float(qty)}
    return {'rate': 0, 'total_meters_4_stops': 0}

def get_rope_num_ropes(cap, gearless):
    # From the Excel descriptions: "srt125,13mm,3rope" etc.
    # We know: 6p geared=3, 8p geared=4, 10p geared=4, 20p geared=5
    # 6p gearless seg10 4rope, 10p gearless seg30 5rope, 20p gearless seg30 8rope
    GEARED_ROPES  = {'6':3,'8':4,'10':4,'13':4,'15':4,'20':5,'26':5}
    GEARLESS_ROPES= {'6':4,'8':4,'10':5,'13':5,'15':5,'20':8,'26':8}
    if gearless:
        return GEARLESS_ROPES.get(cap, 4)
    return GEARED_ROPES.get(cap, 4)

print("COMPONENT_DATA: dict = {")
for cap in CAPS:
    print(f"    '{cap}': {{")
    for cfg in CFGS:
        gearless = 'Gearless' in cfg

        # Guide rail
        gr_rate = fallback(get_unit(cap, 'Guide rail', cfg), 5000)

        # Bracket
        if gearless:
            brk_rate = get_gearless_bracket_rate(cap)
            brk_qty = 11
        else:
            brk_rate = fallback(get_unit(cap, 'Bracket', cfg), 950)
            brk_qty = 11

        # Fixed items (unit costs)
        cabin  = fallback(get_unit(cap, 'Car cabin', cfg), 0)
        overld = fallback(get_unit(cap, 'Overload', cfg), 4000)
        pkg    = fallback(get_unit(cap, 'Cabin Packing Charges', cfg), 2500)
        frt    = fallback(get_unit(cap, 'Cabin inward Transport & local Freight', cfg), 6000)
        ctrl   = fallback(get_unit(cap, 'Controlller with Drive +DBR', cfg) or
                          get_unit(cap, 'Controller with Drive +DBR', cfg), 0)
        ard    = fallback(get_unit(cap, 'ARD (UPS) with battery', cfg), 0)
        motor  = fallback(get_unit(cap, 'Motor', cfg), 0)
        mhost  = fallback(get_unit(cap, 'Motor Hosting', cfg), 2500)
        safety = fallback(get_unit(cap, 'Geared/Gearless Safety', cfg), 0)
        osg    = fallback(get_total(cap, 'OSG with rope', cfg), 0)
        wt     = fallback(get_unit(cap, 'Weight counter with granite floor', cfg), 0)
        sen    = fallback(get_unit(cap, 'Sensor door', cfg), 0)
        car_door = fallback(get_unit(cap, 'Car Door', cfg), 0)
        ld_rate  = fallback(get_unit(cap, 'Landing Door', cfg), 0)
        other  = fallback(get_unit(cap, 'OTHER', cfg), 25000)
        freight= fallback(get_unit(cap, 'Freight', cfg), 5000)
        load   = fallback(get_unit(cap, 'loading & Unloading', cfg) or get_total(cap, 'loading & Unloading', cfg), 5000)
        scaff  = fallback(get_unit(cap, 'Scafolding', cfg) or get_total(cap, 'Scafolding', cfg), 7500)

        # Wiring totals (5 lines, use total per config)
        wiring_rows = raw[cap]['items'].get('Wiring', [])
        wiring_totals = []
        labels = [
            'Limit switch wiring (6c 0.5mm)',
            'LOP/COP/car-top wiring (12c 0.5mm)',
            'Lock/alarm/car-top wiring (2c 0.5mm)',
            'Motor flexible wiring (2.5mm)',
            'Brake wiring (2c 0.5mm)',
        ]
        for i, wr in enumerate(wiring_rows[:5]):
            t = wr['totals'].get(cfg)
            wiring_totals.append(t if isinstance(t,(int,float)) and t > 0 else 0)
        while len(wiring_totals) < 5:
            wiring_totals.append(0)

        # Rope
        rope = parse_rope(cap, cfg)
        num_ropes = get_rope_num_ropes(cap, gearless)

        print(f"        '{cfg}': {{")
        print(f"            'guide_rail_rate': {gr_rate},")
        print(f"            'bracket_rate': {brk_rate}, 'bracket_qty': {brk_qty},")
        print(f"            'cabin': {cabin}, 'overload': {overld}, 'cabin_packing': {pkg}, 'cabin_freight': {frt},")
        print(f"            'controller': {ctrl}, 'ard': {ard},")
        print(f"            'motor': {motor}, 'motor_hoisting': {mhost},")
        print(f"            'safety': {safety}, 'osg': {round(osg)},")
        print(f"            'weight_counter': {round(wt) if isinstance(wt,float) else wt},")
        print(f"            'sensor_door': {sen}, 'car_door': {car_door},")
        print(f"            'landing_door_rate': {ld_rate},")
        print(f"            'wiring': {wiring_totals},")
        print(f"            'other': {other}, 'freight': {freight}, 'loading': {round(load) if isinstance(load,float) else load}, 'scaffolding': {round(scaff) if isinstance(scaff,float) else scaff},")
        print(f"            'rope_rate': {rope['rate']}, 'rope_meters_4_stops': {rope['total_meters_4_stops']}, 'rope_num': {num_ropes},")
        print(f"        }},")
    print("    },")
print("}")
