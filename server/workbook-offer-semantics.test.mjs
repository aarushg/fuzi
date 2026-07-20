import assert from "node:assert/strict";
import test from "node:test";
import { costingOfferInventoryFields, costingTechnicalOfferFields } from "./workbook-offer-semantics.mjs";

function source(cells, sourceFile = "6pIS17900NewCostingMay2026.xlsx") {
  return {
    source_file: sourceFile,
    cells: cells.map(([cell, value, sheet = "Costing"]) => ({ sheet, cell, value }))
  };
}

test("technical fields use the column B lift Stops row instead of the LOP/COP table header", () => {
  const fields = costingTechnicalOfferFields(source([
    ["H1", "Stops"],
    ["G1", "not the lift stop count"],
    ["B2", "Passenger/Goods"],
    ["G2", 6],
    ["B3", "Stops"],
    ["G3", 4],
    ["B4", "Speed"],
    ["G4", 1],
    ["B5", "Geared/Gearless"],
    ["G5", "geraless"],
    ["B6", "Car Construction"],
    ["G6", "ss"],
    ["B7", "Door Construction"],
    ["G7", "ss"],
    ["B8", "Door Type"],
    ["G8", "co"],
    ["B9", "Door Size"],
    ["G9", 700],
    ["B10", "Flooring"],
    ["G10", "granite"]
  ]));
  assert.equal(fields.stops, "4");
  assert.equal(fields.capacity, "6 passengers");
  assert.equal(fields.drive_type, "Gearless");
  assert.equal(fields.car_construction, "Stainless steel");
  assert.equal(fields.door_opening_type, "Center opening");
  assert.equal(fields.costing_door_size, "700");
  assert.equal(fields.flooring, "Granite flooring");
  assert.equal(fields.compliance_standard, "IS 17900");
  assert.equal(Object.hasOwn(fields, "source_file"), false);
});

test("technical fields preserve selected travel, controller, motor, safety, cabin and rope meaning", () => {
  const fields = costingTechnicalOfferFields(source([
    ["B2", "Passenger/Goods"], ["G2", 10],
    ["B3", "Stops"], ["G3", 4],
    ["B4", "Speed"], ["G4", 1],
    ["K1", "Pit"], ["L1", 1600],
    ["K2", "B to G"], ["L2", 0],
    ["K3", "G to 1"], ["L3", 3800],
    ["K13", "overhead"], ["L13", 4800],
    ["K14", "Total"], ["L14", 10200],
    ["B15", "Item"], ["K15", "SSGearless Auto Door"],
    ["B18", "Car cabin"], ["C18", "1.2mm hairline"],
    ["B23", "Controller with Drive +DBR"], ["D23", "7.5hp closeloop"],
    ["B26", "Motor"], ["D26", "as per IS 17900"],
    ["B28", "Rope"], ["C28", "seg 10,8mm,4rope"], ["D28", "rate+2"],
    ["B30", "Gearless Progressive Safety"],
    ["D45", "TOTAL"]
  ], "10pIS17900NewCostingMay2026.xlsx"));
  assert.equal(fields.door_operation, "Automatic");
  assert.equal(fields.controller_configuration, "7.5hp closeloop");
  assert.equal(fields.motor_specification, "as per IS 17900");
  assert.equal(fields.car_cabin_specification, "1.2mm hairline");
  assert.equal(fields.safety_specification, "Gearless Progressive Safety");
  assert.equal(fields.rope_specification, "seg 10,8mm,4rope / rate+2");
  assert.equal(fields.costing_pit_mm, "1600");
  assert.equal(fields.costing_overhead_mm, "4800");
  assert.equal(fields.costing_total_travel_mm, "10200");
  assert.match(fields.costing_travel_profile, /Pit: 1600 mm/);
  assert.match(fields.costing_travel_profile, /G to 1: 3800 mm/);
  assert.equal(fields.costing_configuration, "SSGearless Auto Door");
  assert.deepEqual(fields.costing_travel_segments, [
    { label: "Pit", mm: "1600" },
    { label: "B to G", mm: "0" },
    { label: "G to 1", mm: "3800" },
    { label: "overhead", mm: "4800" }
  ]);
});

test("old-template inventory reads H line totals and exposes description, basis and notes as editable values", () => {
  const result = costingOfferInventoryFields(source([
    ["B15", "Item"],
    ["B16", "Guide rail"],
    ["C16", "9mm & 5mm"],
    ["D16", "Purchase+100"],
    ["E16", 2],
    ["F16", 5],
    ["G16", 100],
    ["H16", 500],
    ["N16", "width up to 1800"],
    ["D17", "TOTAL"]
  ], "6 passenger Big vision stainless steel gearless autodoor 2 stops.xlsx"));
  assert.equal(result.inventory_items.length, 1);
  assert.deepEqual(result.inventory_items[0], {
    serial_no: "",
    name: "Guide rail",
    description: "9mm & 5mm",
    costing_basis: "Purchase+100",
    costing_notes: "width up to 1800",
    unit: "",
    qty: 2,
    actual: 5,
    purchase_price: 100,
    current_price: 100,
    amount_basis: "actual",
    line_total: 500
  });
  assert.equal(result.inventory_material_total, "500");
});

test("new-template inventory reads K prices and L totals without retaining formulas or workbook coordinates", () => {
  const result = costingOfferInventoryFields(source([
    ["B15", "Item"],
    ["K15", "SSGearless Auto Door"],
    ["A16", 14],
    ["B16", "Landing Door"],
    ["D16", "up to 800mm"],
    ["E16", 4],
    ["K16", 25000],
    ["L16", 100000],
    ["O16", "outstation add 10000"],
    ["D17", "TOTAL"]
  ]));
  assert.equal(result.inventory_items[0].serial_no, "14");
  assert.equal(result.inventory_items[0].qty, 4);
  assert.equal(result.inventory_items[0].actual, "");
  assert.equal(result.inventory_items[0].costing_basis, "up to 800mm");
  assert.equal(result.inventory_items[0].costing_notes, "outstation add 10000");
  assert.equal(result.inventory_items[0].purchase_price, 0);
  assert.equal(result.inventory_items[0].current_price, 25000);
  assert.equal(result.inventory_items[0].amount_basis, "quantity");
  assert.equal(result.inventory_items[0].line_total, 100000);
  assert.equal(result.inventory_material_total, "100000");
  assert.equal(JSON.stringify(result).includes("workbook_cell"), false);
  assert.equal(JSON.stringify(result).includes("formula"), false);
});

test("direct line totals preserve the original quantities and prices instead of inventing effective rates", () => {
  const result = costingOfferInventoryFields(source([
    ["B15", "Item"],
    ["B16", "Bracket"], ["E16", 6.75], ["F16", 7], ["G16", 3600], ["H16", 6650],
    ["B17", "Controller"], ["E17", 1], ["H17", 39000],
    ["D19", "TOTAL"]
  ], "manual-door.xlsx"));
  assert.equal(result.inventory_items.length, 2);
  assert.equal(result.inventory_items[0].qty, 6.75);
  assert.equal(result.inventory_items[0].actual, 7);
  assert.equal(result.inventory_items[0].current_price, 3600);
  assert.equal(result.inventory_items[0].amount_basis, "direct");
  assert.equal(result.inventory_items[0].line_total, 6650);
  assert.equal(result.inventory_items[1].current_price, 0);
  assert.equal(result.inventory_items[1].amount_basis, "direct");
  assert.equal(result.inventory_items[1].line_total, 39000);
  assert.equal(result.inventory_material_total, "45650");
});

test("selected Q:R pricing drives inventory and technical choices in the expanded template", () => {
  const expanded = source([
    ["B3", "Stops"], ["G3", 4],
    ["B5", "Geared/Gearless"], ["G5", "gearless"],
    ["B15", "Item"], ["K15", "MS Manual door"], ["Q15", "SSGearless Auto Door"],
    ["A16", 4], ["B16", "Controller with Drive +DBR"], ["D16", "5hp openloop"], ["K16", 39000], ["L16", 39000], ["Q16", 0], ["R16", 0],
    ["A17", 4], ["B17", "Controller with Drive +DBR"], ["D17", "5hp closeloop"], ["Q17", 68000], ["R17", 68000],
    ["A18", 6], ["B18", "Rope"], ["C18", "srt125,13mm,3rope"], ["D18", "rate+2"], ["Q18", 0], ["R18", 0],
    ["A19", 6], ["B19", "Rope"], ["C19", "seg 10,8mm,4rope"], ["D19", "rate+2"], ["E19", 10], ["Q19", 77], ["R19", 770],
    ["D20", "TOTAL"], ["R20", 68770],
    ["D21", "TOTAL"], ["R21", 68770],
    ["B22", "OUR MARGIN"], ["R22", 120000],
    ["B23", "FINAL OFFER"], ["R23", 188770]
  ], "6pNewCostingMay2026.xlsx");
  const inventory = costingOfferInventoryFields(expanded);
  const technical = costingTechnicalOfferFields(expanded);
  assert.equal(inventory.inventory_items.length, 4);
  assert.equal(inventory.inventory_items[1].current_price, 68000);
  assert.equal(inventory.inventory_items[1].line_total, 68000);
  assert.equal(inventory.inventory_items[3].current_price, 77);
  assert.equal(inventory.inventory_items[3].line_total, 770);
  assert.equal(inventory.inventory_material_total, "68770");
  assert.equal(technical.costing_configuration, "SSGearless Auto Door");
  assert.equal(technical.door_operation, "Automatic");
  assert.equal(technical.controller_configuration, "5hp closeloop");
  assert.equal(technical.rope_specification, "seg 10,8mm,4rope / rate+2");
});

test("blank workbook quantities remain blank when a direct line amount supplies the cost", () => {
  const result = costingOfferInventoryFields(source([
    ["B15", "Item"],
    ["B16", "Pit ladder"], ["E16", " "], ["F16", 1], ["G16", 9000], ["K16", 9000], ["L16", 9000],
    ["D17", "TOTAL"]
  ]));
  assert.equal(result.inventory_items[0].qty, "");
  assert.equal(result.inventory_items[0].actual, 1);
  assert.equal(result.inventory_items[0].current_price, 9000);
  assert.equal(result.inventory_items[0].amount_basis, "actual");
  assert.equal(result.inventory_items[0].line_total, 9000);
});

test("old and new template notes include every non-price item column", () => {
  const oldResult = costingOfferInventoryFields(source([
    ["B15", "Item"], ["G15", "MS Auto door"],
    ["B16", "Landing Door"], ["G16", 100], ["H16", 100], ["T16", "old far note"],
    ["D17", "TOTAL"]
  ], "old-template.xlsx"));
  const newResult = costingOfferInventoryFields(source([
    ["B15", "Item"], ["K15", "SSGearless Auto Door"],
    ["B16", "Landing Door"], ["K16", 100], ["L16", 100], ["T16", "new far note"],
    ["D17", "TOTAL"]
  ]));
  assert.equal(oldResult.inventory_items[0].costing_notes, "old far note");
  assert.equal(newResult.inventory_items[0].costing_notes, "new far note");
  assert.equal(newResult.inventory_items[0].costing_notes.includes("100"), false);
});
