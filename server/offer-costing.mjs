function numericInput(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function offerInventoryDescription(record = {}) {
  const values = [record.description, record.specification]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" / ");
}

const offerInventoryTemplateFields = [
  "item_id",
  "serial_no",
  "description",
  "costing_basis",
  "costing_notes",
  "category",
  "unit",
  "qty",
  "actual",
  "purchase_price",
  "current_price",
  "amount_basis",
  "line_total",
  "price_date",
  "vendor"
];

function emptyInventoryTemplateValue(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function offerInventoryTemplates(records = []) {
  const templates = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const name = String(record?.name || record?.item || record?.item_id || "").trim();
    const key = name.toLowerCase();
    if (!key) continue;
    const normalized = {
      ...record,
      item_id: String(record?.item_id || record?.id || name).trim(),
      name,
      description: offerInventoryDescription(record),
      amount_basis: offerInventoryAmountBasis(record)
    };
    delete normalized.specification;
    const existing = templates.get(key);
    if (!existing) {
      templates.set(key, normalized);
      continue;
    }
    for (const field of offerInventoryTemplateFields) {
      if (emptyInventoryTemplateValue(existing[field]) && !emptyInventoryTemplateValue(normalized[field])) {
        existing[field] = normalized[field];
      }
    }
  }
  return [...templates.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function offerInventoryAmountBasis(record = {}) {
  const basis = String(record.amount_basis || "").trim().toLowerCase();
  if (["quantity", "actual", "direct"].includes(basis)) return basis;
  return String(record.actual ?? "").trim() ? "actual" : "quantity";
}

export function offerInventoryLineAmount(record = {}) {
  const basis = offerInventoryAmountBasis(record);
  if (basis === "direct") return numericInput(record.line_total);
  const price = numericInput(record.current_price ?? record.unit_price ?? record.sale_price ?? record.unit_cost);
  const factorValue = basis === "actual" ? record.actual : record.qty;
  const factorFallback = factorValue === undefined || factorValue === null ? 1 : 0;
  return numericInput(factorValue, factorFallback) * price;
}

export function offerInventoryTotal(items = []) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + offerInventoryLineAmount(item), 0);
}

export function offerTravelFieldsFromSegments(rows = []) {
  const segments = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      label: String(row?.label || "").trim(),
      mm: row?.mm === undefined || row?.mm === null ? "" : String(row.mm).trim()
    }))
    .filter((row) => row.label || row.mm !== "");
  const findValue = (label) => segments.find((row) => normalizedLabel(row.label) === label)?.mm || "";
  const total = segments.reduce((sum, row) => sum + numericInput(row.mm), 0);
  return {
    costing_travel_segments: segments,
    costing_pit_mm: findValue("pit"),
    costing_overhead_mm: findValue("overhead"),
    costing_total_travel_mm: String(total),
    costing_travel_profile: segments
      .filter((row) => row.label && row.mm !== "")
      .map((row) => `${row.label}: ${row.mm} mm`)
      .join("; ")
  };
}

function strictCellNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const text = String(value ?? "").trim().replace(/,/g, "").replace(/^\$\s*/, "");
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return Number.NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizedLabel(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function cellRow(cellRef = "") {
  const match = String(cellRef || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function cellColumn(cellRef = "") {
  const match = String(cellRef || "").toUpperCase().match(/[A-Z]+/);
  if (!match) return 0;
  let column = 0;
  for (const char of match[0]) column = (column * 26) + char.charCodeAt(0) - 64;
  return column;
}

function rightmostRowNumber(cells, sheet, row) {
  const rowCells = cells
    .filter((cell) => String(cell?.sheet || "") === sheet && cellRow(cell?.cell) === row)
    .sort((a, b) => cellColumn(b?.cell) - cellColumn(a?.cell));
  for (const cell of rowCells) {
    const numeric = strictCellNumber(cell?.value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function lastLabelCell(cells, sheet, matcher, minimumRow, maximumRow) {
  return cells
    .filter((cell) => (
      String(cell?.sheet || "") === sheet
      && cellRow(cell?.cell) > minimumRow
      && cellRow(cell?.cell) < maximumRow
      && matcher(normalizedLabel(cell?.value))
    ))
    .sort((a, b) => cellRow(b?.cell) - cellRow(a?.cell))[0] || null;
}

export function offerCostSummary(record = {}) {
  const inventoryItems = Array.isArray(record.inventory_items) ? record.inventory_items : [];
  const materialCost = inventoryItems.length ? offerInventoryTotal(inventoryItems) : numericInput(record.material_cost);
  const hasInstallationBreakdown = String(record.installation_local_cost ?? "").trim() !== ""
    || String(record.commissioning_cost ?? "").trim() !== "";
  const installCost = hasInstallationBreakdown
    ? numericInput(record.installation_local_cost) + numericInput(record.commissioning_cost)
    : numericInput(record.install_cost);
  const hasWarrantyBreakdown = String(record.warranty_cost ?? "").trim() !== "";
  const overheadCost = hasWarrantyBreakdown ? numericInput(record.warranty_cost) : numericInput(record.overhead_cost);
  const marginMode = String(record.margin_mode || "").trim().toLowerCase() === "fixed" ? "fixed" : "percentage";
  const marginPercent = marginMode === "fixed" ? 0 : numericInput(record.margin_percent, 15);
  const fixedMarginAmount = numericInput(record.margin_amount);
  const discount = numericInput(record.discount);
  const gstPercent = numericInput(record.gst_percent, 18);
  const baseCost = materialCost + installCost + overheadCost;
  const marginAmount = marginMode === "fixed" ? fixedMarginAmount : (baseCost * marginPercent) / 100;
  const subtotal = Math.max(0, baseCost + marginAmount - discount);
  const gstAmount = (subtotal * gstPercent) / 100;
  const calculatedTotal = subtotal + gstAmount;
  const hasCalculationInputs = [
    "material_cost",
    "install_cost",
    "overhead_cost",
    "margin_mode",
    "margin_percent",
    "margin_amount",
    "discount",
    "gst_percent"
  ].some((key) => Object.prototype.hasOwnProperty.call(record, key));
  const totalCost = hasCalculationInputs
    ? calculatedTotal
    : numericInput(record.calculated_total_cost ?? record.total_cost);
  return {
    materialCost,
    installCost,
    overheadCost,
    marginMode,
    marginPercent,
    marginAmount,
    discount,
    gstPercent,
    gstAmount,
    baseCost,
    subtotal,
    calculatedTotal,
    hasCalculationInputs,
    totalCost
  };
}

export function offerReadOnlyCalculation(record = {}) {
  const inventoryItems = (Array.isArray(record.inventory_items) ? record.inventory_items : []).map((item) => {
    const amountBasis = offerInventoryAmountBasis(item);
    const normalized = { ...item, amount_basis: amountBasis };
    return { ...normalized, line_total: offerInventoryLineAmount(normalized) };
  });
  const travelFields = offerTravelFieldsFromSegments(record.costing_travel_segments);
  const strictCostRecord = {
    ...record,
    ...travelFields,
    inventory_items: inventoryItems,
    material_cost: offerInventoryTotal(inventoryItems),
    install_cost: numericInput(record.installation_local_cost) + numericInput(record.commissioning_cost),
    overhead_cost: numericInput(record.warranty_cost)
  };
  const cost = offerCostSummary(strictCostRecord);
  return {
    ...travelFields,
    inventory_items: inventoryItems,
    inventory_material_total: cost.materialCost,
    material_cost: cost.materialCost,
    install_cost: cost.installCost,
    overhead_cost: cost.overheadCost,
    margin_mode: cost.marginMode,
    margin_percent: cost.marginPercent,
    margin_amount: cost.marginMode === "fixed" ? cost.marginAmount : "",
    discount: cost.discount,
    gst_percent: cost.gstPercent,
    gst_amount: cost.gstAmount,
    base_cost: cost.baseCost,
    subtotal: cost.subtotal,
    total_cost: cost.totalCost,
    calculated_total_cost: cost.calculatedTotal
  };
}

export function offerRecordWithServerCalculations(record = {}, patch = {}) {
  const merged = { ...record, ...patch };
  return { ...merged, ...offerReadOnlyCalculation(merged) };
}

export function workbookMarginInput(baseCost, marginAmount) {
  const base = numericInput(baseCost);
  const margin = numericInput(marginAmount);
  if (base <= 0 || margin <= 0) {
    return { margin_mode: "percentage", margin_percent: 0, margin_amount: "" };
  }
  const percentage = Number(((margin / base) * 100).toFixed(4));
  const percentageAmount = (base * percentage) / 100;
  if (Math.abs(percentageAmount - margin) <= 0.000001) {
    return { margin_mode: "percentage", margin_percent: percentage, margin_amount: "" };
  }
  return { margin_mode: "fixed", margin_percent: "", margin_amount: margin };
}

export function workbookCostingSummary(cells = []) {
  const values = Array.isArray(cells) ? cells : [];
  const finalOfferCell = values.find((cell) => normalizedLabel(cell?.value) === "final offer");
  if (!finalOfferCell) return null;
  const sheet = String(finalOfferCell.sheet || "");
  const finalOfferRow = cellRow(finalOfferCell.cell);
  const marginCell = lastLabelCell(values, sheet, (label) => label === "our margin", 0, finalOfferRow);
  if (!marginCell) return null;
  const marginRow = cellRow(marginCell.cell);
  const totalRows = [...new Set(values
    .filter((cell) => (
      String(cell?.sheet || "") === sheet
      && normalizedLabel(cell?.value) === "total"
      && cellRow(cell?.cell) < marginRow
    ))
    .map((cell) => cellRow(cell.cell)))]
    .sort((a, b) => a - b);
  if (totalRows.length < 2) return null;
  const subtotalRow = totalRows[totalRows.length - 1];
  const materialTotalRow = totalRows[totalRows.length - 2];
  const installationCell = lastLabelCell(values, sheet, (label) => label.startsWith("installation local"), materialTotalRow, subtotalRow);
  const commissioningCell = lastLabelCell(values, sheet, (label) => label.startsWith("commissio"), materialTotalRow, subtotalRow);
  const warrantyCell = lastLabelCell(values, sheet, (label) => label.startsWith("warranty"), materialTotalRow, subtotalRow);
  const rowValue = (cell) => cell ? rightmostRowNumber(values, sheet, cellRow(cell.cell)) : 0;
  return {
    sheet,
    rows: {
      material_total: materialTotalRow,
      installation_local: installationCell ? cellRow(installationCell.cell) : 0,
      commissioning: commissioningCell ? cellRow(commissioningCell.cell) : 0,
      warranty: warrantyCell ? cellRow(warrantyCell.cell) : 0,
      subtotal: subtotalRow,
      margin: marginRow,
      final_offer: finalOfferRow
    },
    material_total: rightmostRowNumber(values, sheet, materialTotalRow),
    installation_local: rowValue(installationCell),
    commissioning: rowValue(commissioningCell),
    warranty: rowValue(warrantyCell),
    pre_margin_total: rightmostRowNumber(values, sheet, subtotalRow),
    margin_amount: rightmostRowNumber(values, sheet, marginRow),
    final_offer: rightmostRowNumber(values, sheet, finalOfferRow)
  };
}
