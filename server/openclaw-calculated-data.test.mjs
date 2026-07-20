import assert from "node:assert/strict";
import test from "node:test";
import { createOpenClawCalculationContract, createOpenClawValueReceipt, validateOpenClawCalculatedData } from "./openclaw-calculated-data.mjs";

function rawData() {
  return {
    source_count: 1,
    sources: [{
      source_file: "costing.xlsx",
      sheets: [{ name: "Costing", non_empty_cell_count: 2 }],
      sheets_matrix: [[
        ["A1", "11"],
        ["B1", "=A1+10"]
      ]],
      non_empty_cell_count: 2,
      cells: [
        { sheet: "Costing", cell: "A1", value: 11 },
        { sheet: "Costing", cell: "B1", value: null, formula: "A1+10" }
      ]
    }]
  };
}

function calculatedData() {
  const data = rawData();
  data.sources[0].cells[1] = { sheet: "Costing", cell: "B1", value: 21 };
  data.sources[0].sheets_matrix[0][1][1] = "21";
  return data;
}

test("accepts a complete formula-free OpenClaw calculation", () => {
  const contract = createOpenClawCalculationContract(rawData());
  const result = validateOpenClawCalculatedData(calculatedData(), contract);
  assert.equal(contract.formula_count, 1);
  assert.equal(result.ok, true);
  assert.equal(result.audit.validated_formula_result_count, 1);
  assert.equal(result.audit.formula_count_received_by_fuzi, 0);
  assert.equal(result.audit.endpoint_evaluated_formula_count, 0);
  assert.equal(result.audit.workbook_value_receipt.value_count, 2);
  assert.equal(result.audit.workbook_value_receipt.sources[0].value_count, 2);
  assert.match(result.audit.workbook_value_receipt.values_digest, /^[a-f0-9]{64}$/);
});

test("receipts cover every workbook cell value and change with a calculated value", () => {
  const first = createOpenClawValueReceipt(calculatedData());
  const changedData = calculatedData();
  changedData.sources[0].cells[1].value = 22;
  changedData.sources[0].sheets_matrix[0][1][1] = "22";
  const changed = createOpenClawValueReceipt(changedData);
  assert.equal(first.value_count, 2);
  assert.notEqual(first.values_digest, changed.values_digest);
  assert.notEqual(first.sources[0].values_digest, changed.sources[0].values_digest);
});

test("rejects a missing calculated formula result", () => {
  const contract = createOpenClawCalculationContract(rawData());
  const data = calculatedData();
  data.sources[0].cells[1].value = null;
  const result = validateOpenClawCalculatedData(data, contract);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "FORMULA_RESULT_NOT_CALCULATED"));
});

test("rejects formulas sent back to FUZI", () => {
  const contract = createOpenClawCalculationContract(rawData());
  const result = validateOpenClawCalculatedData(rawData(), contract);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "FORMULA_SENT_TO_FUZI"));
  assert.ok(result.audit.formula_count_received_by_fuzi > 0);
});

test("rejects altered non-formula workbook data", () => {
  const contract = createOpenClawCalculationContract(rawData());
  const data = calculatedData();
  data.sources[0].cells[0].value = 12;
  data.sources[0].sheets_matrix[0][0][1] = "12";
  const result = validateOpenClawCalculatedData(data, contract);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "CALCULATED_DATA_STRUCTURE_CHANGED"));
});

test("rejects inconsistent calculated cell and worksheet-array values", () => {
  const contract = createOpenClawCalculationContract(rawData());
  const data = calculatedData();
  data.sources[0].sheets_matrix[0][1][1] = "22";
  const result = validateOpenClawCalculatedData(data, contract);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "FORMULA_RESULT_REPRESENTATIONS_DIFFER"));
});

test("rejects duplicate calculated formula result cells", () => {
  const contract = createOpenClawCalculationContract(rawData());
  const data = calculatedData();
  data.sources[0].cells.push({ sheet: "Costing", cell: "B1", value: 21 });
  const result = validateOpenClawCalculatedData(data, contract);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "FORMULA_RESULT_CELL_DUPLICATED"));
});
