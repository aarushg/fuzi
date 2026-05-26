import json
with open('C:/Users/User/Documents/GitHub/fuzi/docs/costing/extracted_costing.json') as f:
    d = json.load(f)

KEY_ITEMS = [
    'Guide rail','Bracket','Car cabin','Overload',
    'Controlller with Drive +DBR','Controller with Drive +DBR',
    'ARD (UPS) with battery','LOP/COP','Motor','Motor Hosting',
    'Rope','Cable','Geared/Gearless Safety','OSG with rope',
    'Weight counter with granite floor','Sensor door','Wiring',
    'Car Door','Landing Door','OTHER','Freight',
    'loading & Unloading','Scafolding','Commissioing','Warranty',
    'Installation local 10000',
]

for cap in ['6','8','10','13','15','20','26']:
    data = d[cap]
    print(f'\n=== {cap}p ===')
    print('LOP/COP:', data['lopcop_by_stops'])
    print('GR qty:', data['guiderail_qty_by_stops'])
    print('Floor heights:', data['floor_heights'])
    for item in KEY_ITEMS:
        rows = data['items'].get(item, [])
        if rows:
            r = rows[0]
            qty = r.get('qty') or r.get('qty_actual')
            uc = r['unit_costs']
            print(f"  {item}: qty={qty} | {uc}")
    if len(data['items'].get('Wiring', [])) > 1:
        print('  Wiring lines:', len(data['items']['Wiring']))
        for wr in data['items']['Wiring']:
            print('   ', wr)
    print('  Install:', data.get('install'))
