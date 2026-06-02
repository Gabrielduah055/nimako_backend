import ExcelJS from 'exceljs';

export interface IParsedProduct {
  name: string;
  barcode: string;
  category: string;
  priceSingle: number;
  priceBulk: number;
  bulkQuantity: number;
  stock: number;
  lowStockThreshold: number;
  unit: 'piece' | 'carton' | 'kg' | 'liter';
}

/**
 * Parses an Excel file buffer and returns an array of product objects.
 * Uses ExcelJS (actively maintained, security vulnerability-free SheetJS alternative).
 *
 * @param buffer - The Excel file buffer from multer
 * @returns Array of parsed & validated products
 */
export const parseExcelBuffer = async (buffer: any): Promise<IParsedProduct[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel file contains no sheets.');
  }

  // Extract headers
  const headers: (string | null)[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    headers.push(cell.value ? String(cell.value).trim() : null);
  });

  if (headers.length === 0 || headers.every((h) => !h)) {
    throw new Error('Excel sheet has no header row or headers are empty.');
  }

  const REQUIRED_HEADERS = ['name', 'barcode'];
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      throw new Error(
        `Missing required column "${req}" in the Excel header row. ` +
          `Found columns: ${headers.filter(Boolean).join(', ')}`
      );
    }
  }

  const VALID_UNITS = ['piece', 'carton', 'kg', 'liter'] as const;
  const products: IParsedProduct[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const rowData: Record<string, any> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        let val: any = cell.value;
        // Parse cell value structures (dates, rich text, formula result)
        if (val && typeof val === 'object') {
          if (val instanceof Date) {
            val = val.toISOString();
          } else if ('text' in val) {
            val = val.text;
          } else if ('result' in val) {
            val = val.result;
          }
        }
        rowData[header] = val;
      }
    });

    // Skip empty rows
    if (Object.values(rowData).every((v) => v === null || v === undefined || v === '')) {
      return;
    }

    const name = rowData['name'] != null ? String(rowData['name']).trim() : null;
    const barcode = rowData['barcode'] != null ? String(rowData['barcode']).trim() : null;

    if (!name) {
      throw new Error(`Row ${rowNumber}: "name" is required and cannot be empty.`);
    }
    if (!barcode) {
      throw new Error(`Row ${rowNumber}: "barcode" is required and cannot be empty.`);
    }

    const priceSingleRaw = rowData['priceSingle'];
    const priceSingle =
      priceSingleRaw != null && priceSingleRaw !== ''
        ? parseFloat(priceSingleRaw)
        : 0;

    if (isNaN(priceSingle) || priceSingle < 0) {
      throw new Error(`Row ${rowNumber}: "priceSingle" must be a non-negative number.`);
    }

    const stockRaw = rowData['stock'];
    const stock =
      stockRaw != null && stockRaw !== '' ? parseInt(stockRaw, 10) : 0;

    if (isNaN(stock) || stock < 0) {
      throw new Error(`Row ${rowNumber}: "stock" must be a non-negative integer.`);
    }

    const category = rowData['category'] ? String(rowData['category']).trim() : '';

    const priceBulkRaw = rowData['priceBulk'];
    const priceBulk =
      priceBulkRaw != null && priceBulkRaw !== '' ? parseFloat(priceBulkRaw) : 0;

    const bulkQuantityRaw = rowData['bulkQuantity'];
    const bulkQuantity =
      bulkQuantityRaw != null && bulkQuantityRaw !== ''
        ? parseInt(bulkQuantityRaw, 10)
        : 1;

    const lowStockThresholdRaw = rowData['lowStockThreshold'];
    const lowStockThreshold =
      lowStockThresholdRaw != null && lowStockThresholdRaw !== ''
        ? parseInt(lowStockThresholdRaw, 10)
        : 10;

    const unitRaw = rowData['unit']
      ? String(rowData['unit']).trim().toLowerCase()
      : 'piece';
    const unit = VALID_UNITS.includes(unitRaw as any)
      ? (unitRaw as typeof VALID_UNITS[number])
      : 'piece';

    products.push({
      name,
      barcode,
      category,
      priceSingle,
      priceBulk: isNaN(priceBulk) ? 0 : priceBulk,
      bulkQuantity: isNaN(bulkQuantity) || bulkQuantity < 1 ? 1 : bulkQuantity,
      stock,
      lowStockThreshold: isNaN(lowStockThreshold) ? 10 : lowStockThreshold,
      unit,
    });
  });

  if (products.length === 0) {
    throw new Error('Excel sheet is empty or has no data rows below the header.');
  }

  return products;
};
