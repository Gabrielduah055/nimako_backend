import Sale from '../models/Sale';

/**
 * Generates the next sequential invoice number for a given date.
 * Format: INV-YYYYMMDD-XXXX  (e.g. INV-20250101-0001)
 *
 * Queries the DB for the last invoice of the day and increments the counter.
 * This is called INSIDE a MongoDB transaction so duplicate invoice numbers
 * under concurrent requests are prevented by the unique index on Sale.
 */
export const generateInvoiceNumber = async (date: Date = new Date()): Promise<string> => {
  // Build the date prefix — e.g. "20250101"
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  const invoicePrefix = `INV-${datePrefix}-`;

  // Find the last invoice created today, sorted descending
  const lastSale = await Sale.findOne({
    invoiceNumber: { $regex: `^${invoicePrefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select('invoiceNumber')
    .lean();

  let nextCounter = 1;
  if (lastSale) {
    // Extract numeric counter from the end of the invoice number
    const parts = lastSale.invoiceNumber.split('-');
    const lastCounter = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastCounter)) {
      nextCounter = lastCounter + 1;
    }
  }

  const paddedCounter = String(nextCounter).padStart(4, '0');
  return `${invoicePrefix}${paddedCounter}`;
};
