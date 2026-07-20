import crypto from "node:crypto";

const formulaResultSentinel = "__FUZI_OPENCLAW_FORMULA_RESULT__";

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalJsonValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJsonValue(value[key])]));
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalJsonValue(value))).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isFormulaText(value) {
  return typeof value === "string" && value.trim().startsWith("=");
}

function isCalculatedScalar(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return ["string", "boolean"].includes(typeof value);
}

function sourceSheetIndex(source, sheetName) {
  return (Array.isArray(source?.sheets) ? source.sheets : []).findIndex((sheet) => String(sheet?.name || "") === String(sheetName || ""));
}

function matrixEntriesForCell(source, sheetIndex, cellRef) {
  const matrix = Array.isArray(source?.sheets_matrix?.[sheetIndex]) ? source.sheets_matrix[sheetIndex] : [];
  return matrix.filter((entry) => Array.isArray(entry) && String(entry[0] || "").toUpperCase() === String(cellRef || "").toUpperCase());
}

export function createOpenClawValueReceipt(calculatedData = {}) {
  const sources = Array.isArray(calculatedData?.sources) ? calculatedData.sources : [];
  const sourceReceipts = sources.map((source, sourceIndex) => {
    const values = (Array.isArray(source?.cells) ? source.cells : []).map((cell, valueIndex) => ({
      value_index: valueIndex,
      sheet: String(cell?.sheet || ""),
      cell: String(cell?.cell || "").toUpperCase(),
      value: canonicalJsonValue(cell?.value)
    }));
    return {
      source_index: sourceIndex,
      value_count: values.length,
      values_digest: digest(values)
    };
  });
  return {
    algorithm: "sha256-canonical-workbook-cells-v1",
    source_count: sourceReceipts.length,
    value_count: sourceReceipts.reduce((sum, source) => sum + source.value_count, 0),
    values_digest: digest(sourceReceipts),
    sources: sourceReceipts
  };
}

export function createOpenClawCalculationContract(data = {}) {
  const validationShape = clone(data);
  const formulaCells = [];
  const sourceFormulaCounts = [];
  const sources = Array.isArray(validationShape.sources) ? validationShape.sources : [];

  sources.forEach((source, sourceIndex) => {
    let sourceFormulaCount = 0;
    const cells = Array.isArray(source.cells) ? source.cells : [];
    cells.forEach((cell) => {
      if (!String(cell?.formula || "").trim()) return;
      const sheetIndex = sourceSheetIndex(source, cell.sheet);
      if (sheetIndex < 0) throw new Error(`Formula cell ${cell.cell || ""} has no matching worksheet.`);
      const matrixEntries = matrixEntriesForCell(source, sheetIndex, cell.cell);
      if (matrixEntries.length !== 1) throw new Error(`Formula cell ${cell.cell || ""} does not have exactly one worksheet-array entry.`);
      formulaCells.push({
        source_index: sourceIndex,
        sheet_index: sheetIndex,
        sheet: String(cell.sheet || ""),
        cell: String(cell.cell || "").toUpperCase()
      });
      sourceFormulaCount += 1;
      delete cell.formula;
      cell.value = formulaResultSentinel;
      matrixEntries[0][1] = formulaResultSentinel;
    });
    sourceFormulaCounts.push({ source_index: sourceIndex, formula_count: sourceFormulaCount });
  });

  return {
    expected_calculated_data_digest: digest(validationShape),
    formula_cells: formulaCells,
    formula_count: formulaCells.length,
    source_formula_counts: sourceFormulaCounts,
    endpoint_evaluated_formula_count: 0
  };
}

export function validateOpenClawCalculatedData(calculatedData = {}, contract = {}) {
  const errors = [];
  const addError = (code, details = {}) => {
    if (errors.length < 30) errors.push({ code, ...details });
  };
  if (!calculatedData || typeof calculatedData !== "object" || Array.isArray(calculatedData)) {
    return {
      ok: false,
      errors: [{ code: "CALCULATED_DATA_REQUIRED" }],
      audit: {
        expected_formula_result_count: Number(contract.formula_count || 0),
        validated_formula_result_count: 0,
        formula_count_received_by_fuzi: 0,
        endpoint_evaluated_formula_count: 0
      }
    };
  }

  const validationShape = clone(calculatedData);
  const sources = Array.isArray(validationShape.sources) ? validationShape.sources : [];
  let formulasReceived = 0;
  for (const [sourceIndex, source] of sources.entries()) {
    for (const cell of Array.isArray(source?.cells) ? source.cells : []) {
      if (Object.prototype.hasOwnProperty.call(cell || {}, "formula") || isFormulaText(cell?.value)) {
        formulasReceived += 1;
        addError("FORMULA_SENT_TO_FUZI", { source_index: sourceIndex, sheet: cell?.sheet || "", cell: cell?.cell || "" });
      }
    }
    for (const [sheetIndex, matrix] of (Array.isArray(source?.sheets_matrix) ? source.sheets_matrix : []).entries()) {
      for (const entry of Array.isArray(matrix) ? matrix : []) {
        if (Array.isArray(entry) && isFormulaText(entry[1])) {
          formulasReceived += 1;
          addError("FORMULA_SENT_TO_FUZI", { source_index: sourceIndex, sheet_index: sheetIndex, cell: entry[0] || "" });
        }
      }
    }
  }

  let validatedFormulaResults = 0;
  for (const expected of Array.isArray(contract.formula_cells) ? contract.formula_cells : []) {
    const source = sources[expected.source_index];
    const matchingCells = (Array.isArray(source?.cells) ? source.cells : []).filter((cell) => (
      String(cell?.sheet || "") === expected.sheet
      && String(cell?.cell || "").toUpperCase() === expected.cell
    ));
    if (matchingCells.length !== 1) {
      addError(matchingCells.length ? "FORMULA_RESULT_CELL_DUPLICATED" : "FORMULA_RESULT_CELL_MISSING", {
        ...expected,
        matching_cell_count: matchingCells.length
      });
      continue;
    }
    const cell = matchingCells[0];
    if (!isCalculatedScalar(cell.value)) {
      addError("FORMULA_RESULT_NOT_CALCULATED", expected);
      continue;
    }
    const matrixEntries = matrixEntriesForCell(source, expected.sheet_index, expected.cell);
    if (matrixEntries.length !== 1 || !isCalculatedScalar(matrixEntries[0][1])) {
      addError("FORMULA_RESULT_MATRIX_VALUE_MISSING", expected);
      continue;
    }
    if (String(matrixEntries[0][1]) !== String(cell.value)) {
      addError("FORMULA_RESULT_REPRESENTATIONS_DIFFER", {
        ...expected,
        cell_value: cell.value,
        matrix_value: matrixEntries[0][1]
      });
      continue;
    }
    delete cell.formula;
    cell.value = formulaResultSentinel;
    matrixEntries[0][1] = formulaResultSentinel;
    validatedFormulaResults += 1;
  }

  const suppliedShapeDigest = digest(validationShape);
  const workbookValueReceipt = createOpenClawValueReceipt(calculatedData);
  if (suppliedShapeDigest !== String(contract.expected_calculated_data_digest || "")) {
    addError("CALCULATED_DATA_STRUCTURE_CHANGED", {
      calculated_data_structure_matches: false
    });
  }
  const expectedFormulaResults = Number(contract.formula_count || 0);
  if (validatedFormulaResults !== expectedFormulaResults) {
    addError("FORMULA_RESULT_COUNT_MISMATCH", {
      expected_formula_result_count: expectedFormulaResults,
      validated_formula_result_count: validatedFormulaResults
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    audit: {
      expected_formula_result_count: expectedFormulaResults,
      validated_formula_result_count: validatedFormulaResults,
      formula_count_received_by_fuzi: formulasReceived,
      endpoint_evaluated_formula_count: 0,
      calculated_data_structure_matches: suppliedShapeDigest === String(contract.expected_calculated_data_digest || ""),
      workbook_value_receipt: workbookValueReceipt,
      source_formula_counts: Array.isArray(contract.source_formula_counts) ? contract.source_formula_counts : []
    }
  };
}
