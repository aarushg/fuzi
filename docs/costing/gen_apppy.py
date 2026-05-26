"""
Generate COMPONENT_DATA in app.py field-naming convention with correct values.
app.py field names: car_cabin, motor_hosting, ard_battery, osg_rope,
                    cable(fixed), wiring_totals, loading_unloading,
                    rope_base_4stops, rope_num_ropes
"""
import json

with open('C:/Users/User/Documents/GitHub/fuzi/docs/costing/extracted_costing.json') as f:
    raw = json.load(f)

CAPS = ['6','8','10','13','15','20','26']
CFGS = ['MS Auto Door','SS Auto Door','MS Manual Door','SS Manual Door',
        'MS Gearless Auto Door','SS Gearless Auto Door']

GEARED_ROPES  = {'6':3,'8':4,'10':4,'13':4,'15':4,'20':5,'26':5}
GEARLESS_ROPES= {'6':4,'8':4,'10':5,'13':5,'15':5,'20':8,'26':8}

def get_unit(cap, item, cfg):
    rows = raw[cap]['items'].get(item, [])
    if not rows: return None
    v = rows[0]['unit_costs'].get(cfg)
    return v if isinstance(v,(int,float)) and v > 0 else None

def get_total(cap, item, cfg):
    rows = raw[cap]['items'].get(item, [])
    if not rows: return None
    v = rows[0]['totals'].get(cfg)
    return v if isinstance(v,(int,float)) and v > 0 else None

def fb(v, default=0):
    return v if v is not None else default

def get_gl_bracket_rate(cap):
    rows = raw[cap]['items'].get('Bracket', [])
    if len(rows) < 2: return 1350
    v = rows[1]['unit_costs'].get('MS Gearless Auto Door')
    return v if isinstance(v,(int,float)) and v > 0 else 1350

def parse_rope(cap, cfg):
    gearless = 'Gearless' in cfg
    rows = raw[cap]['items'].get('Rope', [])
    for r in rows:
        uc = r['unit_costs'].get(cfg)
        if not isinstance(uc,(int,float)) or uc <= 0: continue
        qty = r.get('qty_actual') or r.get('qty')
        if not isinstance(qty,(int,float)) or qty <= 0: continue
        return float(qty), float(uc)
    return 0.0, 0.0

print("COMPONENT_DATA: dict[str, dict] = {")
for cap in CAPS:
    print(f'    "{cap}": {{')
    for cfg in CFGS:
        gearless = 'Gearless' in cfg

        # Guide rail
        gr_rate = fb(get_unit(cap, 'Guide rail', cfg), 5000)

        # Bracket
        if gearless:
            brk_rate = get_gl_bracket_rate(cap)
        else:
            brk_rate = fb(get_unit(cap, 'Bracket', cfg), 950)

        # Fixed item costs
        cabin   = fb(get_unit(cap, 'Car cabin', cfg))
        overld  = fb(get_unit(cap, 'Overload', cfg), 4000)
        pkg     = fb(get_unit(cap, 'Cabin Packing Charges', cfg), 2500)
        frt     = fb(get_unit(cap, 'Cabin inward Transport & local Freight', cfg), 6000)
        ctrl    = fb(get_unit(cap, 'Controlller with Drive +DBR', cfg) or
                     get_unit(cap, 'Controller with Drive +DBR', cfg))
        ard     = fb(get_unit(cap, 'ARD (UPS) with battery', cfg))
        motor   = fb(get_unit(cap, 'Motor', cfg))
        mhost   = fb(get_unit(cap, 'Motor Hosting', cfg), 2500)
        safety  = fb(get_unit(cap, 'Geared/Gearless Safety', cfg))
        osg     = fb(get_total(cap, 'OSG with rope', cfg))
        wt      = fb(get_unit(cap, 'Weight counter with granite floor', cfg))
        sen     = fb(get_unit(cap, 'Sensor door', cfg))
        car_door= fb(get_unit(cap, 'Car Door', cfg))
        ld_rate = fb(get_unit(cap, 'Landing Door', cfg))
        other   = fb(get_unit(cap, 'OTHER', cfg), 25000)
        freight = fb(get_unit(cap, 'Freight', cfg), 5000)
        load    = fb(get_unit(cap, 'loading & Unloading', cfg) or
                     get_total(cap, 'loading & Unloading', cfg), 5000)
        scaff   = fb(get_unit(cap, 'Scafolding', cfg) or
                     get_total(cap, 'Scafolding', cfg), 7500)

        # Wiring (5 fixed totals)
        wrows = raw[cap]['items'].get('Wiring', [])
        wt_list = []
        for wr in wrows[:5]:
            t = wr['totals'].get(cfg)
            wt_list.append(int(t) if isinstance(t,(int,float)) and t > 0 else 0)
        while len(wt_list) < 5: wt_list.append(0)

        # Rope
        rope_base, rope_rate_v = parse_rope(cap, cfg)
        rope_num = GEARLESS_ROPES[cap] if gearless else GEARED_ROPES[cap]

        print(f'        "{cfg}": {{')
        print(f'            "car_cabin": {int(cabin)}, "overload": {int(overld)}, "cabin_packing": {int(pkg)},')
        print(f'            "cabin_freight": {int(frt)}, "controller": {int(ctrl)}, "ard_battery": {int(ard)},')
        print(f'            "safety": {int(safety)}, "osg_rope": {round(osg, 2)}, "weight_counter": {round(wt, 2)},')
        print(f'            "sensor_door": {int(sen)}, "motor": {int(motor)}, "motor_hosting": {int(mhost)},')
        print(f'            "cable": 12236.8,')
        print(f'            "wiring_totals": {wt_list},')
        print(f'            "car_door": {int(car_door)}, "other": {int(other)}, "freight": {int(freight)},')
        print(f'            "loading_unloading": {int(load)}, "scaffolding": {int(scaff)},')
        print(f'            "guide_rail_rate": {int(gr_rate)}, "bracket_rate": {int(brk_rate)},')
        print(f'            "rope_base_4stops": {rope_base}, "rope_rate": {int(rope_rate_v)}, "rope_num_ropes": {rope_num},')
        print(f'            "landing_door_rate": {int(ld_rate)},')
        print(f'        }},')
    print('    },')
print('}')
