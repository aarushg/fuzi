import assert from "node:assert/strict";
import test from "node:test";
import { offerCostSummary, offerInventoryDescription, offerInventoryLineAmount, offerInventoryTemplates, offerInventoryTotal, offerReadOnlyCalculation, offerRecordWithServerCalculations, offerTravelFieldsFromSegments, workbookCostingSummary, workbookMarginInput } from "./offer-costing.mjs";

test("inventory description merges legacy specification text without duplicates", () => {
  assert.equal(offerInventoryDescription({ description: "9mm & 5mm", specification: "9mm & 5mm" }), "9mm & 5mm");
  assert.equal(offerInventoryDescription({ description: "Guide rail", specification: "EN 81" }), "Guide rail / EN 81");
  assert.equal(offerInventoryDescription({ specification: "EN 81" }), "EN 81");
});

test("workbook inventory templates keep one item name and fill only empty values", () => {
  const templates = offerInventoryTemplates([
    { name: "Guide rail", description: "9mm", qty: "", current_price: 5000, costing_notes: "" },
    { name: "guide RAIL", description: "16mm", qty: 7.16, current_price: 7000, costing_notes: "Travel based" },
    { name: "Bracket", description: "95 per kg", current_price: 1350 }
  ]);
  assert.equal(templates.length, 2);
  assert.deepEqual(templates.find((item) => item.name === "Guide rail"), {
    name: "Guide rail",
    description: "9mm",
    qty: 7.16,
    current_price: 5000,
    costing_notes: "Travel based",
    item_id: "Guide rail",
    amount_basis: "quantity"
  });
});

const workbooks = [
  [743285.05, 48000, 12000, 37164.2525, 120000, 960449.3025, "fixed"],
  [846519.3, 56000, 12000, 42325.965, 120000, 1076845.265, "fixed"],
  [904020.05, 56000, 12000, 45201.0025, 120000, 1137221.0525, "fixed"],
  [977732.3, 70000, 12000, 48886.615, 120000, 1228618.915, "fixed"],
  [1099444.8, 80000, 12000, 54972.24, 120000, 1366417.04, "fixed"],
  [667277.3, 48000, 12000, 33363.865, 120000, 880641.165, "fixed"],
  [621885.3, 48000, 12000, 31094.265, 120000, 832979.565, "fixed"],
  [596640.3, 48000, 12000, 29832.015, 120000, 806472.315, "fixed"],
  [420079.5, 24000, 12000, 21003.975, 95416.695, 572500.17, "percentage"],
  [479798.3, 24000, 12000, 23989.915, 107957.643, 647745.858, "percentage"],
  [508472.5, 24000, 12000, 25423.625, 113979.225, 683875.35, "percentage"],
  [568191.3, 24000, 12000, 28409.565, 126520.173, 759121.038, "percentage"],
  [420079.5, 24000, 12000, 21003.975, 95416.695, 572500.17, "percentage"],
  [479798.3, 24000, 12000, 23989.915, 107957.643, 647745.858, "percentage"],
  [471624.5, 24000, 12000, 23581.225, 106241.145, 637446.87, "percentage"],
  [531343.3, 24000, 12000, 26567.165, 118782.093, 712692.558, "percentage"],
  [578191.3, 24000, 12000, 28909.565, 128620.173, 771721.038, "percentage"],
  [369674.5, 24000, 12000, 18483.725, 84831.645, 508989.87, "percentage"],
  [466074.5, 24000, 12000, 23303.725, 105075.645, 630453.87, "percentage"]
];

test("all 19 workbook totals use their exact fixed or percentage margin logic", () => {
  workbooks.forEach(([material, installation, commissioning, warranty, margin, finalOffer, expectedMode], index) => {
    const base = material + installation + commissioning + warranty;
    const marginInput = workbookMarginInput(base, margin);
    const summary = offerCostSummary({
      material_cost: material,
      install_cost: installation + commissioning,
      overhead_cost: warranty,
      ...marginInput,
      discount: 0,
      gst_percent: 0
    });
    assert.equal(marginInput.margin_mode, expectedMode, `workbook ${index + 1} margin mode`);
    assert.ok(Math.abs(summary.totalCost - finalOffer) <= 0.000001, `workbook ${index + 1} total`);
  });
});

test("saved totals never override the Offer Manager calculation", () => {
  const matching = offerCostSummary({
    material_cost: 100,
    margin_mode: "fixed",
    margin_percent: 15,
    margin_amount: 20,
    gst_percent: 0,
    total_cost: 120
  });
  assert.equal(matching.marginPercent, 0);
  assert.equal(matching.calculatedTotal, 120);
  assert.equal(matching.totalCost, 120);

  const staleSavedTotal = offerCostSummary({
    material_cost: 100,
    margin_mode: "percentage",
    margin_percent: 20,
    gst_percent: 0,
    total_cost: 125
  });
  assert.equal(staleSavedTotal.calculatedTotal, 120);
  assert.equal(staleSavedTotal.totalCost, 120);

  const compactSavedOffer = offerCostSummary({ total_cost: 500 });
  assert.equal(compactSavedOffer.hasCalculationInputs, false);
  assert.equal(compactSavedOffer.calculatedTotal, 0);
  assert.equal(compactSavedOffer.totalCost, 500);
});

test("read-only summary costs are derived from their editable source rows", () => {
  const summary = offerCostSummary({
    material_cost: 999,
    install_cost: 999,
    overhead_cost: 999,
    inventory_items: [{ qty: 2, current_price: 100, amount_basis: "quantity" }],
    installation_local_cost: 50,
    commissioning_cost: 25,
    warranty_cost: 10,
    margin_percent: 0,
    gst_percent: 0
  });
  assert.equal(summary.materialCost, 200);
  assert.equal(summary.installCost, 75);
  assert.equal(summary.overheadCost, 10);
  assert.equal(summary.totalCost, 285);
});

test("percentage and GST calculations are not rounded to integers", () => {
  const summary = offerCostSummary({ material_cost: 100.25, margin_percent: 20, gst_percent: 5 });
  assert.equal(summary.marginAmount, 20.05);
  assert.equal(summary.gstAmount, 6.015);
  assert.equal(summary.totalCost, 126.315);
});

test("inventory lines preserve quantity, actual and direct amount calculation bases", () => {
  const items = [
    { amount_basis: "quantity", qty: 2, actual: 7, current_price: 100, line_total: 999 },
    { amount_basis: "actual", qty: 3, actual: 4, current_price: 50, line_total: 999 },
    { amount_basis: "direct", qty: 8, actual: 9, current_price: 500, line_total: 123.45 }
  ];
  assert.equal(offerInventoryLineAmount(items[0]), 200);
  assert.equal(offerInventoryLineAmount(items[1]), 200);
  assert.equal(offerInventoryLineAmount(items[2]), 123.45);
  assert.equal(offerInventoryTotal(items), 523.45);
});

test("travel segment rows are the source for all saved travel fields", () => {
  assert.deepEqual(offerTravelFieldsFromSegments([
    { label: "Pit", mm: "1600" },
    { label: "B to G", mm: "0" },
    { label: "G to 1", mm: "3800" },
    { label: "overhead", mm: "4800" }
  ]), {
    costing_travel_segments: [
      { label: "Pit", mm: "1600" },
      { label: "B to G", mm: "0" },
      { label: "G to 1", mm: "3800" },
      { label: "overhead", mm: "4800" }
    ],
    costing_pit_mm: "1600",
    costing_overhead_mm: "4800",
    costing_total_travel_mm: "10200",
    costing_travel_profile: "Pit: 1600 mm; B to G: 0 mm; G to 1: 3800 mm; overhead: 4800 mm"
  });
});

test("server calculation replaces every tampered read-only offer value", () => {
  const calculation = offerReadOnlyCalculation({
    inventory_items: [
      { name: "Calculated", amount_basis: "quantity", qty: 2, current_price: 100, line_total: 999 },
      { name: "Direct", amount_basis: "direct", line_total: 45 }
    ],
    material_cost: 999,
    installation_local_cost: 30,
    commissioning_cost: 20,
    install_cost: 999,
    warranty_cost: 10,
    overhead_cost: 999,
    costing_travel_segments: [
      { label: "Pit", mm: "100" },
      { label: "Floor", mm: "300" },
      { label: "overhead", mm: "200" }
    ],
    costing_pit_mm: "999",
    costing_overhead_mm: "999",
    costing_total_travel_mm: "999",
    costing_travel_profile: "tampered",
    margin_mode: "fixed",
    margin_amount: 5,
    gst_percent: 0
  });
  assert.equal(calculation.inventory_items[0].line_total, 200);
  assert.equal(calculation.inventory_items[1].line_total, 45);
  assert.equal(calculation.material_cost, 245);
  assert.equal(calculation.install_cost, 50);
  assert.equal(calculation.overhead_cost, 10);
  assert.equal(calculation.costing_pit_mm, "100");
  assert.equal(calculation.costing_overhead_mm, "200");
  assert.equal(calculation.costing_total_travel_mm, "600");
  assert.equal(calculation.costing_travel_profile, "Pit: 100 mm; Floor: 300 mm; overhead: 200 mm");
  assert.equal(calculation.calculated_total_cost, 310);
});

test("server calculation returns empty or zero read-only values when source rows are absent", () => {
  const calculation = offerReadOnlyCalculation({
    material_cost: 999,
    install_cost: 999,
    overhead_cost: 999,
    costing_pit_mm: "999",
    costing_overhead_mm: "999",
    costing_total_travel_mm: "999",
    costing_travel_profile: "tampered",
    margin_mode: "fixed",
    margin_amount: 0,
    gst_percent: 0
  });
  assert.equal(calculation.material_cost, 0);
  assert.equal(calculation.install_cost, 0);
  assert.equal(calculation.overhead_cost, 0);
  assert.equal(calculation.costing_pit_mm, "");
  assert.equal(calculation.costing_overhead_mm, "");
  assert.equal(calculation.costing_total_travel_mm, "0");
  assert.equal(calculation.costing_travel_profile, "");
});

test("partial client updates are calculated from server-persisted source inputs", () => {
  const persisted = {
    inventory_items: [{ name: "Guide rail", amount_basis: "quantity", qty: 2, current_price: 100 }],
    installation_local_cost: 30,
    commissioning_cost: 20,
    warranty_cost: 10,
    costing_travel_segments: [
      { label: "Pit", mm: "100" },
      { label: "overhead", mm: "200" }
    ],
    margin_mode: "percentage",
    margin_percent: 10,
    gst_percent: 0
  };
  const record = offerRecordWithServerCalculations(persisted, {
    margin_percent: 20,
    material_cost: 999,
    install_cost: 999,
    overhead_cost: 999,
    costing_pit_mm: "999",
    costing_overhead_mm: "999",
    costing_total_travel_mm: "999",
    costing_travel_profile: "client calculated",
    inventory_material_total: 999,
    total_cost: 999,
    calculated_total_cost: 999
  });
  assert.equal(record.inventory_items[0].line_total, 200);
  assert.equal(record.material_cost, 200);
  assert.equal(record.install_cost, 50);
  assert.equal(record.overhead_cost, 10);
  assert.equal(record.costing_pit_mm, "100");
  assert.equal(record.costing_overhead_mm, "200");
  assert.equal(record.costing_total_travel_mm, "300");
  assert.equal(record.costing_travel_profile, "Pit: 100 mm; overhead: 200 mm");
  assert.equal(record.inventory_material_total, 200);
  assert.equal(record.total_cost, 312);
  assert.equal(record.calculated_total_cost, 312);
});

test("summary extraction ignores similarly named cells outside the costing summary block", () => {
  const cells = [
    { sheet: "Costing", cell: "B3", value: "Installation: local" },
    { sheet: "Costing", cell: "G3", value: 999999 },
    { sheet: "Costing", cell: "D45", value: "TOTAL" },
    { sheet: "Costing", cell: "L45", value: "977732.3" },
    { sheet: "Costing", cell: "B46", value: "Installation local 10000" },
    { sheet: "Costing", cell: "L46", value: "70000" },
    { sheet: "Costing", cell: "B47", value: "Commissioing" },
    { sheet: "Costing", cell: "L47", value: "12000" },
    { sheet: "Costing", cell: "B48", value: "Warranty" },
    { sheet: "Costing", cell: "L48", value: "48886.615" },
    { sheet: "Costing", cell: "D49", value: "TOTAL" },
    { sheet: "Costing", cell: "L49", value: "1108618.915" },
    { sheet: "Costing", cell: "B50", value: "OUR MARGIN" },
    { sheet: "Costing", cell: "L50", value: "120000" },
    { sheet: "Costing", cell: "B51", value: "FINAL OFFER" },
    { sheet: "Costing", cell: "L51", value: "1228618.915" }
  ];
  assert.deepEqual(workbookCostingSummary(cells), {
    sheet: "Costing",
    rows: { material_total: 45, installation_local: 46, commissioning: 47, warranty: 48, subtotal: 49, margin: 50, final_offer: 51 },
    material_total: 977732.3,
    installation_local: 70000,
    commissioning: 12000,
    warranty: 48886.615,
    pre_margin_total: 1108618.915,
    margin_amount: 120000,
    final_offer: 1228618.915
  });
});
