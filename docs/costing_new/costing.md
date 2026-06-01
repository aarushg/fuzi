# Costing Builder Logic

Use this file as the instruction source for building or updating elevator costing workbooks from costing logic supplied later.

The goal is to convert the user's costing rules into a clean, formula-driven Excel workbook. Do not hardcode calculated totals when a formula can express the rule.

## Expected Input From User

When new costing logic is sent, extract these details first:

- Passenger or goods capacity.
- Number of stops.
- Speed.
- Motor type: geared or gearless.
- Vision type: Small/Non vision or Big vision glass door.
- Material: mild steel, stainless steel, or Rose Gold (RG) / Golden.
- Door construction.
- Door type: automatic or manual.
- Door size/opening.
- Flooring.
- Pit, basement-to-ground, floor-to-floor, overhead, and total travel height values.
- Any item-specific quantity, rate, or formula changes.
- Margin percentage.

If a value is not provided, keep the workbook editable and mark the value as an assumption instead of silently inventing a permanent value.

## Workbook Shape

Create one costing sheet per configuration. Name the sheet with a compact configuration code:

- `sv` for Small/Non vision.
- `bv` for Big vision glass door.
- `RG-BV` for source sheets that combine Big vision glass door with Rose Gold (RG) / Golden finish.

Use this layout:

- Rows 1-14: project inputs, LOP/COP lookup, and travel-height calculation.
- Row 15: item table headers.
- Rows 16 onward: itemized costing.
- Final rows: material subtotal, installation, commissioning, warranty, margin, and final offer.

## Input Section

Use these labels and fields:

| Field | Meaning |
| --- | --- |
| Passenger/Goods | Lift capacity, such as `6`. |
| Stops | Number of stops. |
| Speed | Lift speed, such as `0.65`. |
| Geared/Gearless | Motor type. |
| Car Construction | Car/cabin material: mild steel, stainless steel, or RG/Golden. |
| Door Construction | Landing/car door material. |
| Door Type | Door operation type. |
| Door Size | Door opening/door style. |
| Flooring | Cabin floor finish. |

Keep user-editable inputs visually distinct from calculated cells.

## Travel Height Logic

Build a travel-height block with these labels:

- Pit.
- B to G.
- G to 1.
- 1 to 2.
- 2 to 3.
- 3 to 4.
- 4 to 5.
- 5 to 6.
- 6 to 7.
- 7 to 8.
- 8 to 9.
- 9 to 10.
- Overhead.
- Total.

Total travel height formula:

```excel
=SUM(travel_height_values)
```

Source workbook cell-reference form:

```excel
=SUM(R1:R13)
```

The existing 6-passenger examples commonly use:

- Pit: `1600`.
- B to G: `0` unless basement travel is required.
- G to 1: `3800` or `4000`.
- 1 to 2: `0` for 2-stop examples, `3800` for 4-stop examples.
- 2 to 3: `0` for 2-stop examples, `3900` for 4-stop examples.
- Remaining upper floor-to-floor values default to `0` until the stop count requires them.
- Overhead: `4800`.

## LOP/COP Lookup Logic

Create a lookup table for LOP/COP rate by stops.

Common formula pattern:

```excel
=VLOOKUP(stops_cell, lop_cop_lookup_range, 2, 0)+3000
```

Source workbook cell-reference form:

```excel
=VLOOKUP(G3,I1:J10,2,0)+3000
```

Common lookup formulas in the sample files:

```excel
2 stops:  =7500+500+1550+2450+2000
3 stops:  =7850+750+1550+2450+1850+2000
4 stops:  =8200+1000+1550+2450+1850*2+2000
5 stops:  =8550+1250+1550+2450+1850*3+2000
6 stops:  =8900+1500+1550+2450+1850*4+2000
7 stops:  =9250+1750+1550+2450+1850*5+2000
8 stops:  =9600+2000+1550+2450+1850*6+2000
9 stops:  =9950+2250+1550+2450+1850*7+2000
10 stops: =10300+2500+1550+2450+1850*8+2000
```

## Item Table Columns

Use this column structure:

| Column | Header | Purpose |
| --- | --- | --- |
| A | S.No. | Serial number or group number. |
| B | Item | Cost item name. |
| C | Specification | Item description or technical note. |
| D | Unit | Unit, note, or helper formula. |
| E | QTY | Quantity. |
| F | Actual | Actual quantity/length/weight where needed. |
| G | Rate | Unit rate or calculated rate. |
| H | Amount | Final line amount. |

Amount formula rule:

```excel
=rate_cell*quantity_cell
```

When the rate already includes the quantity calculation, set amount equal to the rate cell.

## Standard Item Logic

Use the following item sequence unless the user sends a different sequence:

| Item | Quantity / Rate Logic |
| --- | --- |
| Guide rail | Quantity commonly `=(total_travel_height/5000)*2`; rate commonly `=4800+200`; amount `=rate*actual`. |
| Bracket | Geared/back-counter formula commonly `=((total_travel_height-900)/2000)+2`; actual is `7` for 2-stop examples and `11` for 4-stop examples; geared rate commonly `950`. Gearless side-counter examples use specification `Comb (Side Counter300mm) angle`, rate `=1100+250`, actual `7` or `11`, and should use a valid quantity such as `6.75` or a derived replacement instead of the broken source formula `=#REF!`. Manual-door examples use rate `=1800*stops` and amount `6650` in the source files. |
| Car cabin | Quantity `1`; rate varies by material/vision/finish. See the variant rate tables below. |
| Overload | Quantity `1`; rate commonly `4000`. |
| Cabin packing charges | Quantity `1`; rate commonly `2500`. |
| Cabin inward transport and local freight | Quantity `1`; rate commonly `6000`. |
| Controller with drive + DBR | Quantity `1`; geared/open-loop rate `=37500+1500`; gearless/close-loop rate `=55500+1500+6800+4200`. Manual-door source files place the geared controller amount directly in the amount column. |
| ARD (UPS) with battery | Quantity `1`; rate commonly `=12500+500`; manual-door source files may place `13000` or `=12500+500` directly in amount. |
| LOP/COP | Quantity `1`; rate from LOP/COP lookup. |
| Motor | Quantity `1`; model `ste125`; geared rate `=62000+2000+2500`; gearless rate `=75100+2000+2500`. Manual-door source files may place the geared motor amount directly in amount. |
| Motor hoisting | Quantity `1`; rate/amount commonly `2500`. |
| Rope | Geared/manual rope spec `srt125,13mm,3rope`, quantity `=((total_travel_height/1000)+2)*3`, rate `113`. Gearless rope spec `seg 10,8mm,4rope`, quantity `=(((total_travel_height/1000)*2)+2)*4`, rate `77`. |
| Cable | Quantity commonly `=((total_travel_height+3000+3000)/1000)*4`; rate depends on cable spec. |
| Safety | Quantity `1`; geared/manual rate `28000`; gearless rate `40000`. |
| OSG with rope | Geared/manual quantity may be `=(total_travel_height/1000)*2+2`; gearless quantity is usually `=rope_quantity/4`; rate commonly `=(quantity*77)+4000+1000`; amount equals rate. Equivalent source formulas include `=4000+1000+(77*quantity)`. |
| Counterweight with granite floor | Quantity `1`; rate commonly `=15.5*38*(15.5+2)` unless user overrides. |
| Sensor door | Include for auto door only; quantity `1`; rate commonly `4500`. |
| Wiring - limit switch | Helper formula `=total_travel_height/1000+10+10`; rate `=50+2`; actual commonly `31` for 2-stop examples and `38` for 4-stop examples. |
| Wiring - LOP/COP/car top | Helper formula `=(total_travel_height/1000)+stops*3+13`; rate `=67+2`; actual commonly `30` for 2-stop examples and `43` for 4-stop examples. |
| Wiring - lock/LOP/fireman alarm/car top | Helper formula `=((total_travel_height/1000)+5)+stops*2+(total_travel_height/1000*8)`; rate `=20+3`; actual commonly `103` for 2-stop examples and `175` for 4-stop examples. |
| Wiring - motor flexible | Rate commonly `=35+2.2`; actual commonly `50`. |
| Wiring - brake cable | Rate commonly `=25+2`; actual commonly `50`. |
| Car door | Quantity `1`; rate depends on door type, finish, and size. See the variant rate tables below. |
| Landing door | Quantity equals stops; rate depends on door type, finish, and size. See the variant rate tables below. |
| Other | Quantity `1`; rate commonly `25000` for auto-door files; manual-door source files use `10000`. |
| Freight | Quantity `1`; local rate commonly `5000`; some source files use `10000`; outstation note is `10000`. |
| Loading and unloading | Quantity `1`; rate commonly `5000`. |
| Scaffolding | Quantity `1`; rate commonly `7500`. |
| Installation | Quantity equals stops; local rate commonly `12000`; outstation may be `12500`. |
| Commissioning | Quantity `1`; rate commonly `12000`. |
| Warranty | Quantity `1`; rate commonly `material_subtotal*5%`. |

Source workbook cell-reference forms for key formulas:

```excel
Bracket geared quantity: =((R14-900)/2000)+2
Bracket manual-door rate: =1800*G3
Wiring limit-switch helper: =R14/1000+10+10
Wiring LOP/COP/car-top helper: =(R14/1000)+G3*3+13
Wiring lock/LOP/fireman-alarm/car-top helper: =((R14/1000)+5)+G3*2+(R14/1000*8)
```

## Variant Rate Tables

These values come from the 6-passenger source workbooks and should be used as defaults when the user sends a matching configuration.

### Cabin Rates

| Configuration | Cabin Rate |
| --- | --- |
| Mild steel, any vision, geared/gearless/auto/manual | `45000` |
| Stainless steel, Small/Non vision or Big vision glass door | `75000` |
| RG/Golden, Big vision glass door source rate | `=75000+10000` |

### Controller, Motor, Rope, And Safety Rates

| Motor Type | Controller | Motor | Rope | Safety |
| --- | --- | --- | --- | --- |
| Geared auto | Controller spec `5hp openloop`, rate `=37500+1500` | `ste125`, rate `=62000+2000+2500` | `srt125,13mm,3rope`, quantity `=((R14/1000)+2)*3`, rate `113` | `28000` |
| Geared manual | Same geared controller/motor/safety values, but source files sometimes put amounts directly in column H | `ste125`, amount `=62000+2000+2500` | `srt125,13mm,3rope`, quantity `=((R14/1000)+2)*3`, rate `113` | `28000` |
| Gearless auto | Controller spec `5hp closeloop`, rate `=55500+1500+6800+4200` | `ste125`, rate `=75100+2000+2500` | `seg 10,8mm,4rope`, quantity `=(((R14/1000)*2)+2)*4`, rate `77` | `40000` |

### Door Rates

| Configuration | Car Door Rate | Landing Door Rate |
| --- | --- | --- |
| Mild steel auto door, Small/Non vision or Big vision glass door | `43245` | `17880` |
| Stainless steel auto door, Small/Non vision | `47840` | `26355` |
| Stainless steel auto door, Big vision glass door | `57016` | `=38191+2000` |
| RG/Golden auto door, Big vision glass door source rate | `57016` | `=38191+2000` |
| Mild steel manual door, Small/Non vision | `=7000+1500` | `=7000+3800+1500` |
| Stainless steel manual door, Small/Non vision | `=25000+1500` | `=35000+1500` |

All door rates in the source files are for `upto 800mm`. If the user sends a different door size, keep the rate editable or ask for the rate if it cannot be derived.

## Manual Door Differences

Manual-door source files are Small/Non vision geared files only. Apply these differences when building a manual-door costing:

- Do not include `Sensor door` unless the user explicitly requests it.
- Door rates use the manual-door formulas in the door rate table.
- The material subtotal range shifts up by one row because `Sensor door` is removed.
- Controller, ARD, motor, motor hoisting, safety, freight, loading, other, and some totals may be entered directly in amount cells in the source files; prefer the normalized rate-times-quantity structure unless the user asks to mirror the source workbook exactly.
- Final offer may appear as `=H48+H47` in manual files because the row numbers shift; preserve the same logical meaning: final offer equals post-installation total plus margin.

## Totals Logic

Material subtotal:

```excel
=SUM(item_amount_range_before_installation)
```

Post-installation total:

```excel
=material_subtotal+installation+commissioning+warranty
```

Margin:

```excel
=post_installation_total*margin_percent
```

Final offer:

```excel
=post_installation_total+margin_amount
```

Default margin in the sample files is `20%`.

## Variant Rules

Apply these switches when the user sends variant logic:

- `Small/Non vision` and `Big vision glass door` affect cabin, door, and finish-specific rates.
- `Mild steel`, `stainless steel`, and `RG/Golden` affect cabin, car door, and landing door rates.
- `Geared motor` and `gearless motor` affect controller, motor, speed, rope, and safety rows.
- Geared motor speed is `0.65 mps`; gearless motor speed is `1.0 mps`.
- `Auto door` includes sensor door and automatic car/landing door rates.
- `Manual door` excludes sensor door unless explicitly requested.
- Stops affect LOP/COP, landing door quantity, installation quantity, wiring lengths, and travel-height-dependent quantities.

## Source Workbook Coverage

This logic was checked against these source workbook groups:

- Small/Non vision, mild steel: geared auto, geared manual, gearless auto.
- Small/Non vision, stainless steel: geared auto, geared manual, gearless auto.
- Big vision glass door, mild steel: geared auto and gearless auto.
- Big vision glass door, stainless steel: geared auto and gearless auto.
- RG/Golden Big vision glass door, mild-steel source files: geared auto and gearless auto.
- RG/Golden Big vision glass door, stainless-source files: geared auto and gearless auto.

The source files contain four known broken formulas: gearless bracket quantity cells with `=#REF!`. When generating a new workbook, replace those with a valid side-counter bracket quantity formula or a visible editable assumption; do not reproduce the broken formula.

## Quality Rules

- Preserve the user's formulas exactly when they send specific formulas.
- Convert plain-language logic into Excel formulas where practical.
- Keep assumptions in a visible assumptions area or cell note.
- Use formula references to input cells instead of repeating constants throughout the sheet.
- Do not leave broken formulas such as `#REF!`, `#VALUE!`, `#DIV/0!`, or `#NAME?`.
- Make all totals traceable from item rows.
- Keep item names consistent enough that rows can be compared across variants.

## Response Format When Building From New Logic

When the user sends costing logic, produce:

1. A short summary of extracted assumptions.
2. The workbook or table structure that will be generated.
3. Any missing inputs that were assumed.
4. The final costing file or updated formulas.

If the user's logic conflicts with this file, the user's latest logic wins.
