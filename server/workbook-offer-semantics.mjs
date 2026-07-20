import { offerInventoryLineAmount } from "./offer-costing.mjs";

function normalizedLabel(value = "") {
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

function columnName(column) {
  let value = Number(column) || 0;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function numericValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strictNumericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const text = String(value ?? "").trim().replace(/,/g, "");
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return Number.NaN;
  return Number(text);
}

function textValue(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function sourceCells(source = {}) {
  return Array.isArray(source.cells) ? source.cells : [];
}

function cellValueAt(cells, sheet, column, row) {
  const ref = `${column}${row}`.toUpperCase();
  return textValue(cells.find((cell) => (
    String(cell?.sheet || "") === String(sheet || "")
    && String(cell?.cell || "").toUpperCase() === ref
  ))?.value);
}

function specificationCell(cells, label) {
  const wanted = normalizedLabel(label);
  return cells.find((cell) => cellColumn(cell?.cell) === 2 && normalizedLabel(cell?.value) === wanted) || null;
}

function specificationValue(cells, label, preferredColumns = ["G", "E"]) {
  const labelCell = specificationCell(cells, label);
  if (!labelCell) return "";
  const row = cellRow(labelCell.cell);
  const sheet = String(labelCell.sheet || "");
  for (const column of preferredColumns) {
    const value = cellValueAt(cells, sheet, column, row);
    if (value) return value;
  }
  return "";
}

function itemCell(cells, matcher) {
  return cells.find((cell) => cellColumn(cell?.cell) === 2 && matcher(normalizedLabel(cell?.value))) || null;
}

function itemDetails(cells, matcher, columns = ["C", "D"]) {
  const labelCell = itemCell(cells, matcher);
  if (!labelCell) return "";
  const row = cellRow(labelCell.cell);
  const sheet = String(labelCell.sheet || "");
  return columns.map((column) => cellValueAt(cells, sheet, column, row)).filter(Boolean).join(" / ");
}

function selectedPricingColumns(cells, sheet, headerRow) {
  const finalOfferCell = cells.find((cell) => (
    String(cell?.sheet || "") === sheet
    && normalizedLabel(cell?.value) === "final offer"
  ));
  if (finalOfferCell) {
    const finalRow = cellRow(finalOfferCell.cell);
    const amountColumn = cells
      .filter((cell) => (
        String(cell?.sheet || "") === sheet
        && cellRow(cell?.cell) === finalRow
        && Number.isFinite(strictNumericValue(cell?.value))
      ))
      .map((cell) => cellColumn(cell.cell))
      .sort((a, b) => b - a)[0] || 0;
    if (amountColumn > 1) {
      return {
        priceColumn: columnName(amountColumn - 1),
        amountColumn: columnName(amountColumn)
      };
    }
  }
  const hasLegacyNewPricing = cellValueAt(cells, sheet, "K", headerRow)
    || cells.some((cell) => {
      const row = cellRow(cell?.cell);
      return String(cell?.sheet || "") === sheet
        && cellColumn(cell?.cell) === 12
        && row > headerRow
        && Number.isFinite(strictNumericValue(cell?.value))
        && Number.isFinite(strictNumericValue(cellValueAt(cells, sheet, "K", row)));
    });
  return hasLegacyNewPricing
    ? { priceColumn: "K", amountColumn: "L" }
    : { priceColumn: "G", amountColumn: "H" };
}

function selectedItemCell(cells, matcher, pricing) {
  const candidates = cells.filter((cell) => cellColumn(cell?.cell) === 2 && matcher(normalizedLabel(cell?.value)));
  return candidates.find((cell) => {
    const sheet = String(cell.sheet || "");
    const row = cellRow(cell.cell);
    return numericValue(cellValueAt(cells, sheet, pricing.priceColumn, row)) > 0
      || numericValue(cellValueAt(cells, sheet, pricing.amountColumn, row)) > 0;
  }) || candidates[0] || null;
}

function detailsForItemCell(cells, cell, columns = ["C", "D"]) {
  if (!cell) return "";
  const sheet = String(cell.sheet || "");
  const row = cellRow(cell.cell);
  return columns.map((column) => cellValueAt(cells, sheet, column, row)).filter(Boolean).join(" / ");
}

function displayTechnicalValue(value = "") {
  const text = textValue(value);
  const aliases = {
    co: "Center opening",
    ms: "Mild steel",
    ss: "Stainless steel",
    sv: "Small vision",
    pvc: "PVC flooring",
    granite: "Granite flooring",
    geraless: "Gearless",
    geared: "Geared",
    gearless: "Gearless"
  };
  return aliases[normalizedLabel(text)] || text;
}

function uniqueText(values) {
  const seen = new Set();
  return values.filter((value) => {
    const text = textValue(value);
    const key = normalizedLabel(text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function travelFields(cells) {
  const pitCell = cells.find((cell) => normalizedLabel(cell?.value) === "pit" && cellColumn(cell?.cell) >= 11);
  if (!pitCell) return {};
  const sheet = String(pitCell.sheet || "");
  const labelColumn = cellColumn(pitCell.cell);
  const valueColumn = columnName(labelColumn + 1);
  const startRow = cellRow(pitCell.cell);
  const totalCell = cells.find((cell) => (
    String(cell?.sheet || "") === sheet
    && cellColumn(cell?.cell) === labelColumn
    && cellRow(cell?.cell) > startRow
    && normalizedLabel(cell?.value) === "total"
  ));
  const endRow = totalCell ? cellRow(totalCell.cell) : startRow + 14;
  const segments = [];
  for (let row = startRow; row < endRow; row += 1) {
    const label = cellValueAt(cells, sheet, columnName(labelColumn), row);
    const value = cellValueAt(cells, sheet, valueColumn, row);
    if (label && value !== "") segments.push({ label, mm: value });
  }
  const pit = cellValueAt(cells, sheet, valueColumn, startRow);
  const overheadCell = cells.find((cell) => (
    String(cell?.sheet || "") === sheet
    && cellColumn(cell?.cell) === labelColumn
    && normalizedLabel(cell?.value) === "overhead"
  ));
  const overhead = overheadCell ? cellValueAt(cells, sheet, valueColumn, cellRow(overheadCell.cell)) : "";
  const total = totalCell ? cellValueAt(cells, sheet, valueColumn, cellRow(totalCell.cell)) : "";
  return Object.fromEntries(Object.entries({
    costing_pit_mm: pit,
    costing_overhead_mm: overhead,
    costing_total_travel_mm: total,
    costing_travel_profile: segments.map((segment) => `${segment.label}: ${segment.mm} mm`).join("; "),
    costing_travel_segments: segments
  }).filter(([, value]) => value !== ""));
}

function costingConfiguration(cells) {
  const headerCell = cells.find((cell) => cellColumn(cell?.cell) === 2 && normalizedLabel(cell?.value) === "item");
  if (!headerCell) return "";
  const sheet = String(headerCell.sheet || "");
  const row = cellRow(headerCell.cell);
  const pricing = selectedPricingColumns(cells, sheet, row);
  return cellValueAt(cells, sheet, pricing.priceColumn, row);
}

function workbookDescriptor(source, cells) {
  const sourceFile = textValue(source.source_file);
  const sheetNames = uniqueText(cells.map((cell) => cell?.sheet)).join(" ");
  const headerCell = cells.find((cell) => cellColumn(cell?.cell) === 2 && normalizedLabel(cell?.value) === "item");
  const headerRow = headerCell ? cellRow(headerCell.cell) : 0;
  const selectedConfiguration = headerRow ? costingConfiguration(cells) : "";
  return `${sourceFile} ${sheetNames} ${selectedConfiguration}`.trim();
}

export function costingTechnicalOfferFields(source = {}) {
  const cells = sourceCells(source);
  const descriptor = workbookDescriptor(source, cells);
  const headerCell = cells.find((cell) => cellColumn(cell?.cell) === 2 && normalizedLabel(cell?.value) === "item");
  const pricing = headerCell
    ? selectedPricingColumns(cells, String(headerCell.sheet || ""), cellRow(headerCell.cell))
    : { priceColumn: "G", amountColumn: "H" };
  const capacity = specificationValue(cells, "Passenger/Goods");
  const stops = specificationValue(cells, "Stops");
  const speed = specificationValue(cells, "Speed");
  const driveType = displayTechnicalValue(specificationValue(cells, "Geared/Gearless"));
  const carConstruction = displayTechnicalValue(specificationValue(cells, "Car Construction"));
  const doorConstruction = displayTechnicalValue(specificationValue(cells, "Door Construction"));
  const rawDoorType = specificationValue(cells, "Door Type");
  const rawDoorSize = specificationValue(cells, "Door Size");
  const flooring = displayTechnicalValue(specificationValue(cells, "Flooring"));
  const doorOperation = /\bmanual\b/i.test(descriptor)
    ? "Manual"
    : /\bauto(?:matic)?\s*door\b|\bautodoor\b/i.test(descriptor) ? "Automatic" : "";
  const doorOpeningType = normalizedLabel(rawDoorType) === "co" || /cent(?:er|re)/i.test(rawDoorSize)
    ? "Center opening"
    : "";
  const doorVision = normalizedLabel(rawDoorType) === "sv" || /small\s*vision/i.test(descriptor)
    ? "Small vision"
    : /big\s*vision/i.test(descriptor) ? "Big vision" : /\bnv\b|non\s*vision/i.test(descriptor) ? "Non vision" : "";
  const complianceStandard = /is\s*17900/i.test(`${descriptor} ${cells.map((cell) => textValue(cell?.value)).join(" ")}`)
    ? "IS 17900"
    : "";
  const controllerCell = selectedItemCell(cells, (label) => label.includes("controller") && label.includes("drive"), pricing);
  const motorCell = selectedItemCell(cells, (label) => label === "motor", pricing);
  const cabinCell = selectedItemCell(cells, (label) => label === "car cabin", pricing);
  const safetyCell = selectedItemCell(cells, (label) => label.includes("safety"), pricing);
  const ropeCell = selectedItemCell(cells, (label) => label === "rope", pricing);
  const controllerConfiguration = detailsForItemCell(cells, controllerCell, ["D"]);
  const motorSpecification = detailsForItemCell(cells, motorCell, ["C", "D"]);
  const cabinSpecification = detailsForItemCell(cells, cabinCell, ["C", "D"]);
  const safetySpecification = safetyCell
    ? uniqueText([
        textValue(safetyCell.value),
        detailsForItemCell(cells, safetyCell, ["C", "D"])
      ]).join(" / ")
    : "";
  const ropeSpecification = detailsForItemCell(cells, ropeCell, ["C", "D"]);
  const doorType = uniqueText([doorOperation, doorOpeningType, doorVision, doorConstruction]).join(" / ");
  const finish = uniqueText([carConstruction, flooring]).join(" / ");
  const fields = {
    elevator_type: /\bgoods?\b/i.test(descriptor) && !/passenger/i.test(descriptor) ? "Goods Elevator" : "Passenger Elevator",
    capacity: capacity ? `${capacity} passengers` : "",
    stops,
    speed: speed ? `${speed} m/s` : "",
    drive_type: driveType,
    door_type: doorType,
    finish,
    car_construction: carConstruction,
    door_construction: doorConstruction,
    door_operation: doorOperation,
    door_opening_type: doorOpeningType,
    door_vision: doorVision,
    costing_door_size: rawDoorSize,
    flooring,
    compliance_standard: complianceStandard,
    controller_configuration: controllerConfiguration,
    motor_specification: motorSpecification,
    car_cabin_specification: cabinSpecification,
    safety_specification: safetySpecification,
    rope_specification: ropeSpecification,
    costing_configuration: costingConfiguration(cells),
    ...travelFields(cells)
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => textValue(value) !== ""));
}

function numbersMatch(quantity, price, lineTotal) {
  return Math.abs((quantity * price) - lineTotal) <= Math.max(0.01, Math.abs(lineTotal) * 0.000001);
}

export function costingOfferInventoryFields(source = {}) {
  const cells = sourceCells(source);
  const headerCell = cells.find((cell) => cellColumn(cell?.cell) === 2 && normalizedLabel(cell?.value) === "item");
  if (!headerCell) return { inventory_items: [], inventory_material_total: "", inventory_pricing_source: "" };
  const sheet = String(headerCell.sheet || "");
  const headerRow = cellRow(headerCell.cell);
  const totalRow = cells
    .filter((cell) => (
      String(cell?.sheet || "") === sheet
      && cellRow(cell?.cell) > headerRow
      && normalizedLabel(cell?.value) === "total"
    ))
    .map((cell) => cellRow(cell.cell))
    .sort((a, b) => a - b)[0] || Number.MAX_SAFE_INTEGER;
  const pricing = selectedPricingColumns(cells, sheet, headerRow);
  const noteColumns = Array.from({ length: 16 }, (_, index) => columnName(index + 9))
    .filter((column) => ![pricing.priceColumn, pricing.amountColumn].includes(column));
  const inventoryItems = cells
    .filter((cell) => (
      String(cell?.sheet || "") === sheet
      && cellColumn(cell?.cell) === 2
      && cellRow(cell?.cell) > headerRow
      && cellRow(cell?.cell) < totalRow
      && textValue(cell?.value)
    ))
    .sort((a, b) => cellRow(a.cell) - cellRow(b.cell))
    .map((labelCell) => {
      const row = cellRow(labelCell.cell);
      const name = textValue(labelCell.value);
      const qtyText = cellValueAt(cells, sheet, "E", row);
      const actualText = cellValueAt(cells, sheet, "F", row);
      const selectedPriceText = cellValueAt(cells, sheet, pricing.priceColumn, row);
      const fallbackPriceText = cellValueAt(cells, sheet, "G", row);
      const originalPrice = numericValue(selectedPriceText);
      const basePrice = numericValue(fallbackPriceText);
      const lineTotalText = cellValueAt(cells, sheet, pricing.amountColumn, row);
      const lineTotal = numericValue(lineTotalText);
      if (!name) return null;
      const quantity = qtyText === "" ? "" : numericValue(qtyText);
      const actual = actualText === "" ? "" : numericValue(actualText);
      const amountBasis = actual !== "" && numbersMatch(actual, originalPrice, lineTotal)
        ? "actual"
        : quantity !== "" && numbersMatch(quantity, originalPrice, lineTotal)
          ? "quantity"
          : "direct";
      const description = cellValueAt(cells, sheet, "C", row);
      const costingBasis = cellValueAt(cells, sheet, "D", row);
      const costingNotes = uniqueText([
        ...noteColumns.map((column) => cellValueAt(cells, sheet, column, row))
      ]).join(" / ");
      return {
        serial_no: cellValueAt(cells, sheet, "A", row),
        name,
        description,
        costing_basis: costingBasis,
        costing_notes: costingNotes,
        unit: "",
        qty: quantity,
        actual,
        purchase_price: basePrice,
        current_price: originalPrice,
        amount_basis: amountBasis,
        line_total: lineTotal
      };
    })
    .filter(Boolean);
  const inventoryMaterialTotal = inventoryItems.reduce((sum, item) => sum + offerInventoryLineAmount(item), 0);
  return {
    inventory_items: inventoryItems,
    inventory_material_total: inventoryItems.length ? String(inventoryMaterialTotal) : "",
    inventory_pricing_source: inventoryItems.length ? "Offer Manager manual entry" : ""
  };
}
