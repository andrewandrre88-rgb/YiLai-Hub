import ExcelJS from 'exceljs';
import {
  CalculatedDocumentTotals,
  DOCUMENT_THEMES,
  TRADE_CURRENCIES,
  TradeDocumentState,
  amountToWords,
  renderPresetStampDataUrl,
} from './proformaTypes';

function hexToArgb(hex: string): string {
  const clean = hex.replace('#', '').toUpperCase();
  return clean.length === 6 ? `FF${clean}` : 'FF1E3A8A';
}

async function fetchImageBase64Jpeg(src: string): Promise<string | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const size = 200;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.replace(/^data:image\/jpeg;base64,/, ''));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

export async function exportTradeDocumentExcel(
  docState: TradeDocumentState,
  totals: CalculatedDocumentTotals
): Promise<void> {
  const theme = DOCUMENT_THEMES[docState.themeId] || DOCUMENT_THEMES.navy;
  const currMeta = TRADE_CURRENCIES[docState.currency] || TRADE_CURRENCIES.USD;
  const isPacking = docState.documentType === 'packing_list';
  const docNumber = isPacking ? docState.packingListNumber : docState.piNumber;

  const primaryArgb = hexToArgb(theme.primaryColor);
  const lightArgb = hexToArgb(theme.primaryLight);
  const borderArgb = hexToArgb(theme.borderLight);
  const badgeBgArgb = hexToArgb(theme.badgeBg);
  const badgeTextArgb = hexToArgb(theme.badgeText);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = docState.sellerCompany || 'Yi Lai Hub';
  workbook.created = new Date();

  const sheetName = isPacking ? 'Packing List' : 'Proforma Invoice';
  const ws = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  const includeImages =
    docState.showProductImages && docState.items.some((i) => Boolean(i.imageUrl?.trim()));

  // 8 columns for PI (or 9 with Photo), 9 columns for Packing List (or 10 with Photo)
  const totalCols = isPacking ? (includeImages ? 10 : 9) : includeImages ? 9 : 8;
  const lastColLetter = String.fromCharCode(64 + totalCols);

  if (isPacking) {
    ws.columns = includeImages
      ? [
          { width: 6 },
          { width: 10 },
          { width: 32 },
          { width: 14 },
          { width: 10 },
          { width: 11 },
          { width: 12 },
          { width: 12 },
          { width: 12 },
          { width: 16 },
        ]
      : [
          { width: 6 },
          { width: 36 },
          { width: 14 },
          { width: 10 },
          { width: 11 },
          { width: 12 },
          { width: 12 },
          { width: 12 },
          { width: 18 },
        ];
  } else {
    ws.columns = includeImages
      ? [
          { width: 6 },
          { width: 10 },
          { width: 34 },
          { width: 14 },
          { width: 10 },
          { width: 11 },
          { width: 13 },
          { width: 14 },
          { width: 16 },
        ]
      : [
          { width: 6 },
          { width: 38 },
          { width: 14 },
          { width: 10 },
          { width: 11 },
          { width: 13 },
          { width: 14 },
          { width: 16 },
        ];
  }

  // Row 1: Top Accent Bar
  ws.mergeCells(`A1:${lastColLetter}1`);
  const accentRow = ws.getRow(1);
  accentRow.height = 8;
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };

  // Row 2-4: Header
  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = docState.sellerCompany;
  ws.getCell('A2').font = { name: 'Plus Jakarta Sans', size: 15, bold: true, color: { argb: primaryArgb } };

  const titleStartCol = String.fromCharCode(64 + Math.max(6, totalCols - 2));
  ws.mergeCells(`${titleStartCol}2:${lastColLetter}2`);
  ws.getCell(`${titleStartCol}2`).value = isPacking ? 'COMMERCIAL PACKING LIST' : 'PROFORMA INVOICE';
  ws.getCell(`${titleStartCol}2`).font = {
    name: 'Plus Jakarta Sans',
    size: 13,
    bold: true,
    color: { argb: badgeTextArgb },
  };
  ws.getCell(`${titleStartCol}2`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: badgeBgArgb },
  };
  ws.getCell(`${titleStartCol}2`).alignment = { horizontal: 'right', vertical: 'middle' };

  ws.mergeCells('A3:E3');
  ws.getCell('A3').value = [docState.sellerWebsite, docState.sellerTaxId ? `Tax/VAT: ${docState.sellerTaxId}` : '']
    .filter(Boolean)
    .join('  |  ');
  ws.getCell('A3').font = { name: 'Plus Jakarta Sans', size: 9, color: { argb: 'FF475569' } };

  ws.mergeCells(`${titleStartCol}3:${lastColLetter}3`);
  ws.getCell(`${titleStartCol}3`).value = `No.: ${docNumber}   |   PO Ref: ${docState.poReference || '-'}`;
  ws.getCell(`${titleStartCol}3`).font = {
    name: 'JetBrains Mono',
    size: 9.5,
    bold: true,
    color: { argb: 'FF0F172A' },
  };
  ws.getCell(`${titleStartCol}3`).alignment = { horizontal: 'right', vertical: 'middle' };

  // Row 5: 4-Col Metadata Highlights Bar
  ws.addRow([]);
  const metaRow = ws.getRow(5);
  metaRow.height = 24;
  ws.getCell('A5').value = `Date: ${docState.issueDate}`;
  ws.mergeCells('A5:B5');
  ws.getCell('C5').value = `Valid Until: ${docState.validUntil}`;
  ws.mergeCells('C5:D5');
  ws.getCell('E5').value = `Incoterms 2020: ${docState.incoterm} ${docState.incotermPlace}`;
  ws.mergeCells(`E5:${String.fromCharCode(64 + totalCols - 2)}5`);
  const currCol = String.fromCharCode(64 + totalCols - 1);
  ws.mergeCells(`${currCol}5:${lastColLetter}5`);
  ws.getCell(`${currCol}5`).value = `Currency: ${docState.currency}`;

  for (let c = 1; c <= totalCols; c++) {
    const cell = metaRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightArgb } };
    cell.font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: primaryArgb } };
    cell.border = {
      top: { style: 'thin', color: { argb: borderArgb } },
      bottom: { style: 'thin', color: { argb: borderArgb } },
    };
    cell.alignment = { vertical: 'middle', horizontal: c >= totalCols - 1 ? 'right' : 'left' };
  }

  // Rows 7-11: Seller & Buyer Parties
  ws.addRow([]);
  const splitCol = Math.floor(totalCols / 2);
  const leftEnd = String.fromCharCode(64 + splitCol);
  const rightStart = String.fromCharCode(64 + splitCol + 1);

  ws.mergeCells(`A7:${leftEnd}7`);
  ws.getCell('A7').value = 'SELLER / EXPORTER';
  ws.getCell('A7').font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: primaryArgb } };

  ws.mergeCells(`${rightStart}7:${lastColLetter}7`);
  ws.getCell(`${rightStart}7`).value = 'BUYER / CONSIGNEE';
  ws.getCell(`${rightStart}7`).font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: primaryArgb } };

  const sellerRows = [
    docState.sellerCompany,
    `Attn: ${docState.sellerContact} | Tel: ${docState.sellerPhone}`,
    docState.sellerAddress,
    `${docState.sellerEmail}${docState.sellerTaxId ? ` | Tax ID: ${docState.sellerTaxId}` : ''}`,
  ];
  const buyerRows = [
    docState.buyerCompany || 'TBD',
    `Attn: ${docState.buyerContact || '-'} | Tel: ${docState.buyerPhone || '-'}`,
    [docState.buyerAddress, docState.buyerCountry].filter(Boolean).join(', '),
    `${docState.buyerEmail || ''}${docState.buyerTaxId ? ` | Tax ID: ${docState.buyerTaxId}` : ''}`,
  ];

  for (let i = 0; i < 4; i++) {
    const r = 8 + i;
    ws.mergeCells(`A${r}:${leftEnd}${r}`);
    ws.getCell(`A${r}`).value = sellerRows[i];
    ws.getCell(`A${r}`).font = { name: 'Plus Jakarta Sans', size: 9, bold: i === 0 };

    ws.mergeCells(`${rightStart}${r}:${lastColLetter}${r}`);
    ws.getCell(`${rightStart}${r}`).value = buyerRows[i];
    ws.getCell(`${rightStart}${r}`).font = { name: 'Plus Jakarta Sans', size: 9, bold: i === 0 };
  }

  // Row 12: Transport Bar
  ws.mergeCells(`A12:${lastColLetter}12`);
  const transportRow = ws.getRow(12);
  transportRow.height = 20;
  ws.getCell('A12').value = `Transport: ${docState.transportMode.toUpperCase()}   |   Loading: ${docState.portOfLoading}   |   Discharge: ${docState.portOfDischarge}   |   Origin: ${docState.countryOfOrigin}`;
  ws.getCell('A12').font = { name: 'Plus Jakarta Sans', size: 9, color: { argb: 'FF334155' } };
  ws.getCell('A12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getCell('A12').alignment = { vertical: 'middle' };

  ws.addRow([]); // Row 13 blank

  // Row 14: Table Header
  const headerRowIdx = 14;
  const headers = isPacking
    ? [
        '#',
        ...(includeImages ? ['Photo'] : []),
        'Description & Specifications',
        'HS Code',
        'Cartons',
        'Units/Ctn',
        'Total Qty',
        'Net Wt (kg)',
        'Gross Wt (kg)',
        'CBM (m3)',
      ]
    : [
        '#',
        ...(includeImages ? ['Photo'] : []),
        'Description & Specifications',
        'HS Code',
        'Cartons',
        'Units/Ctn',
        'Total Qty',
        `Unit Price (${docState.currency})`,
        `Total (${docState.currency})`,
      ];

  const headerRow = ws.getRow(headerRowIdx);
  headerRow.height = 24;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx >= (includeImages ? 4 : 3) ? 'right' : idx === 0 ? 'center' : 'left',
    };
  });

  // Resolve images in parallel if needed
  const itemImages = includeImages
    ? await Promise.all(
        docState.items.map((item) =>
          item.imageUrl ? fetchImageBase64Jpeg(item.imageUrl) : Promise.resolve(null)
        )
      )
    : [];

  const firstItemRow = headerRowIdx + 1;
  const ctnColLetter = String.fromCharCode(64 + (includeImages ? 5 : 4));
  const unitsPerCtnColLetter = String.fromCharCode(64 + (includeImages ? 6 : 5));
  const qtyColLetter = String.fromCharCode(64 + (includeImages ? 7 : 6));
  const priceOrNetColLetter = String.fromCharCode(64 + (includeImages ? 8 : 7));
  const totalOrGrossColLetter = String.fromCharCode(64 + (includeImages ? 9 : 8));
  const cbmColLetter = String.fromCharCode(64 + (includeImages ? 10 : 9));

  const moneyNumFmt = `${currMeta.symbol}#,##0.${'0'.repeat(currMeta.decimals)}`;
  const unitPriceNumFmt = `${currMeta.symbol}#,##0.${docState.currency === 'JPY' ? '00' : '0000'}`;

  docState.items.forEach((item, idx) => {
    const r = firstItemRow + idx;
    const row = ws.getRow(r);
    row.height = includeImages ? 36 : 28;
    const descFull = [
      item.description || 'Product',
      item.sku ? `SKU: ${item.sku}` : '',
      item.specifications,
    ]
      .filter(Boolean)
      .join(' | ');

    const qtyFormula = `${ctnColLetter}${r}*${unitsPerCtnColLetter}${r}`;
    const qtyValue = item.cartons * item.unitsPerCarton;

    if (isPacking) {
      const cbmPerCtn =
        item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
          ? (item.lengthCm * item.widthCm * item.heightCm) / 1_000_000
          : 0;
      const lineNet = item.cartons * item.netWeightPerCartonKg;
      const lineGross = item.cartons * item.grossWeightPerCartonKg;
      const lineCbm = Number((item.cartons * cbmPerCtn).toFixed(3));

      const values = [
        idx + 1,
        ...(includeImages ? [''] : []),
        descFull,
        item.hsCode || '-',
        item.cartons,
        item.unitsPerCarton,
        { formula: qtyFormula, result: qtyValue },
        Number(lineNet.toFixed(2)),
        Number(lineGross.toFixed(2)),
        lineCbm,
      ];

      values.forEach((v, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = v as ExcelJS.CellValue;
      });
    } else {
      const lineTotalFormula = `${qtyColLetter}${r}*${priceOrNetColLetter}${r}`;
      const lineTotalVal = Number((qtyValue * item.unitPrice).toFixed(2));
      const values = [
        idx + 1,
        ...(includeImages ? [''] : []),
        descFull,
        item.hsCode || '-',
        item.cartons,
        item.unitsPerCarton,
        { formula: qtyFormula, result: qtyValue },
        item.unitPrice,
        { formula: lineTotalFormula, result: lineTotalVal },
      ];

      values.forEach((v, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = v as ExcelJS.CellValue;
      });
    }

    const isZebra = idx % 2 === 1;
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.font = {
        name: c >= (includeImages ? 4 : 3) ? 'JetBrains Mono' : 'Plus Jakarta Sans',
        size: 9,
        color: { argb: 'FF0F172A' },
      };
      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: c >= (includeImages ? 5 : 4) ? 'right' : c === 1 ? 'center' : 'left',
      };
    }

    const ctnIdx = includeImages ? 5 : 4;
    row.getCell(ctnIdx).numFmt = '#,##0';
    row.getCell(ctnIdx + 1).numFmt = '#,##0';
    row.getCell(ctnIdx + 2).numFmt = `#,##0 "${item.unitLabel || 'pcs'}"`;
    if (isPacking) {
      row.getCell(ctnIdx + 3).numFmt = '#,##0.00';
      row.getCell(ctnIdx + 4).numFmt = '#,##0.00';
      row.getCell(ctnIdx + 5).numFmt = '#,##0.000';
    } else {
      row.getCell(ctnIdx + 3).numFmt = unitPriceNumFmt;
      row.getCell(ctnIdx + 4).numFmt = moneyNumFmt;
    }

    if (includeImages && itemImages[idx]) {
      const imgId = workbook.addImage({
        base64: itemImages[idx] as string,
        extension: 'jpeg',
      });
      ws.addImage(imgId, {
        tl: { col: 1.1, row: r - 0.9 },
        ext: { width: 36, height: 36 },
        editAs: 'oneCell',
      });
    }
  });

  const lastItemRow = firstItemRow + docState.items.length - 1;
  const totalFooterRowIdx = lastItemRow + 1;
  const footerRow = ws.getRow(totalFooterRowIdx);
  footerRow.height = 22;

  ws.mergeCells(`A${totalFooterRowIdx}:${String.fromCharCode(64 + (includeImages ? 4 : 3))}${totalFooterRowIdx}`);
  ws.getCell(`A${totalFooterRowIdx}`).value = 'TOTAL SUMMARY';
  ws.getCell(`A${totalFooterRowIdx}`).font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: primaryArgb } };

  ws.getCell(`${ctnColLetter}${totalFooterRowIdx}`).value = {
    formula: `SUM(${ctnColLetter}${firstItemRow}:${ctnColLetter}${lastItemRow})`,
    result: totals.totalCartons,
  };
  ws.getCell(`${ctnColLetter}${totalFooterRowIdx}`).numFmt = '#,##0 "ctns"';

  ws.getCell(`${qtyColLetter}${totalFooterRowIdx}`).value = {
    formula: `SUM(${qtyColLetter}${firstItemRow}:${qtyColLetter}${lastItemRow})`,
    result: totals.totalUnits,
  };
  ws.getCell(`${qtyColLetter}${totalFooterRowIdx}`).numFmt = '#,##0 "pcs"';

  if (isPacking) {
    ws.getCell(`${priceOrNetColLetter}${totalFooterRowIdx}`).value = {
      formula: `SUM(${priceOrNetColLetter}${firstItemRow}:${priceOrNetColLetter}${lastItemRow})`,
      result: Number(totals.totalNetWeightKg.toFixed(2)),
    };
    ws.getCell(`${priceOrNetColLetter}${totalFooterRowIdx}`).numFmt = '#,##0.00 "kg"';

    ws.getCell(`${totalOrGrossColLetter}${totalFooterRowIdx}`).value = {
      formula: `SUM(${totalOrGrossColLetter}${firstItemRow}:${totalOrGrossColLetter}${lastItemRow})`,
      result: Number(totals.totalGrossWeightKg.toFixed(2)),
    };
    ws.getCell(`${totalOrGrossColLetter}${totalFooterRowIdx}`).numFmt = '#,##0.00 "kg"';

    ws.getCell(`${cbmColLetter}${totalFooterRowIdx}`).value = {
      formula: `SUM(${cbmColLetter}${firstItemRow}:${cbmColLetter}${lastItemRow})`,
      result: Number(totals.totalCbm.toFixed(3)),
    };
    ws.getCell(`${cbmColLetter}${totalFooterRowIdx}`).numFmt = '#,##0.000 "m3"';
  } else {
    ws.getCell(`${totalOrGrossColLetter}${totalFooterRowIdx}`).value = {
      formula: `SUM(${totalOrGrossColLetter}${firstItemRow}:${totalOrGrossColLetter}${lastItemRow})`,
      result: Number(totals.subtotal.toFixed(2)),
    };
    ws.getCell(`${totalOrGrossColLetter}${totalFooterRowIdx}`).numFmt = moneyNumFmt;
  }

  for (let c = 1; c <= totalCols; c++) {
    const cell = footerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightArgb } };
    cell.font = { name: 'JetBrains Mono', size: 9, bold: true, color: { argb: primaryArgb } };
    cell.border = {
      top: { style: 'thin', color: { argb: borderArgb } },
      bottom: { style: 'medium', color: { argb: primaryArgb } },
    };
  }

  let nextRow = totalFooterRowIdx + 2;

  if (!isPacking) {
    // Financials Summary with live Excel formulas
    const subtotalRow = nextRow;
    const labelCol = String.fromCharCode(64 + totalCols - 1);
    const valCol = lastColLetter;

    const addSummaryLine = (
      rIdx: number,
      label: string,
      value: ExcelJS.CellValue,
      bold = false,
      highlight = false
    ) => {
      const r = ws.getRow(rIdx);
      r.height = 20;
      r.getCell(totalCols - 1).value = label;
      r.getCell(totalCols - 1).font = {
        name: 'Plus Jakarta Sans',
        size: bold ? 10 : 9,
        bold,
        color: { argb: highlight ? primaryArgb : 'FF334155' },
      };
      r.getCell(totalCols - 1).alignment = { horizontal: 'right', vertical: 'middle' };

      r.getCell(totalCols).value = value;
      r.getCell(totalCols).font = {
        name: 'JetBrains Mono',
        size: bold ? 10 : 9,
        bold,
        color: { argb: highlight ? primaryArgb : 'FF0F172A' },
      };
      r.getCell(totalCols).numFmt = moneyNumFmt;
      r.getCell(totalCols).alignment = { horizontal: 'right', vertical: 'middle' };
      if (highlight) {
        r.getCell(totalCols - 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightArgb } };
        r.getCell(totalCols).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightArgb } };
        r.getCell(totalCols).border = { bottom: { style: 'double', color: { argb: primaryArgb } } };
      }
    };

    addSummaryLine(subtotalRow, 'Subtotal', {
      formula: `${totalOrGrossColLetter}${totalFooterRowIdx}`,
      result: Number(totals.subtotal.toFixed(2)),
    });
    let cursor = subtotalRow + 1;

    addSummaryLine(cursor, 'Freight / Shipping', totals.freight);
    const freightRow = cursor++;
    addSummaryLine(cursor, 'Cargo Insurance', totals.insurance);
    const insRow = cursor++;
    addSummaryLine(cursor, `Tax (${docState.taxRatePct || 0}%)`, totals.taxAmount);
    const taxRow = cursor++;
    addSummaryLine(cursor, 'Discount (-)', totals.discount);
    const discRow = cursor++;

    const grandRow = cursor++;
    addSummaryLine(
      grandRow,
      `TOTAL DUE (${docState.currency})`,
      {
        formula: `${valCol}${subtotalRow}+${valCol}${freightRow}+${valCol}${insRow}+${valCol}${taxRow}-${valCol}${discRow}`,
        result: totals.grandTotal,
      },
      true,
      true
    );

    if (docState.showMilestoneSplit) {
      const depFrac = Number(((docState.depositPct || 30) / 100).toFixed(4));
      const balFrac = Number((1 - depFrac).toFixed(4));
      addSummaryLine(cursor++, docState.depositLabel, {
        formula: `${valCol}${grandRow}*${depFrac}`,
        result: totals.depositAmount,
      });
      addSummaryLine(cursor++, docState.balanceLabel, {
        formula: `${valCol}${grandRow}*${balFrac}`,
        result: totals.balanceAmount,
      });
    }

    // Amount in words & Bank Details on left side of same rows
    ws.mergeCells(`A${subtotalRow}:E${subtotalRow}`);
    ws.getCell(`A${subtotalRow}`).value = amountToWords(totals.grandTotal, docState.currency);
    ws.getCell(`A${subtotalRow}`).font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: primaryArgb } };

    ws.mergeCells(`A${subtotalRow + 2}:E${subtotalRow + 2}`);
    ws.getCell(`A${subtotalRow + 2}`).value = 'BANK WIRE REMITTANCE DETAILS';
    ws.getCell(`A${subtotalRow + 2}`).font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: primaryArgb } };

    const bankLines = [
      `Beneficiary: ${docState.bankBeneficiary} | Bank: ${docState.bankName}`,
      `SWIFT/BIC: ${docState.bankSwift} | Account No.: ${docState.bankAccountNumber}`,
      docState.intermediaryBank
        ? `Intermediary: ${docState.intermediaryBank} (${docState.intermediarySwift})`
        : '',
      docState.bankNote,
    ].filter(Boolean);

    bankLines.forEach((line, i) => {
      const rIdx = subtotalRow + 3 + i;
      ws.mergeCells(`A${rIdx}:E${rIdx}`);
      ws.getCell(`A${rIdx}`).value = line;
      ws.getCell(`A${rIdx}`).font = { name: 'JetBrains Mono', size: 8.5, color: { argb: 'FF334155' } };
    });

    nextRow = Math.max(cursor + 1, subtotalRow + 3 + bankLines.length + 1);
  } else {
    ws.mergeCells(`A${nextRow}:E${nextRow}`);
    ws.getCell(`A${nextRow}`).value = `Shipping Marks: ${docState.shippingMarks.replace(/\n/g, ' / ')}`;
    ws.getCell(`A${nextRow}`).font = { name: 'JetBrains Mono', size: 9, color: { argb: 'FF334155' } };
    nextRow += 2;
  }

  // Embed company stamp if enabled
  if (docState.stampEnabled) {
    const stampDataUrl =
      docState.stampStyle === 'custom' && docState.stampCustomUrl
        ? docState.stampCustomUrl
        : renderPresetStampDataUrl(docState.stampStyle, docState.stampText, docState.stampSubText);
    if (stampDataUrl && stampDataUrl.startsWith('data:image/')) {
      const isPng = stampDataUrl.startsWith('data:image/png');
      const base64 = stampDataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      const stampImgId = workbook.addImage({
        base64,
        extension: isPng ? 'png' : 'jpeg',
      });
      ws.addImage(stampImgId, {
        tl: { col: totalCols - 2, row: nextRow - 1 },
        ext: { width: 96, height: 96 },
        editAs: 'oneCell',
      });
    }
  }

  ws.getCell(`A${nextRow}`).value = `Authorized Signatory: ${docState.authorizedSignatory}`;
  ws.getCell(`A${nextRow}`).font = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: 'FF334155' } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = `${(docNumber || 'Trade_Document').replace(/[^a-zA-Z0-9_\-]/g, '_')}.xlsx`;
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}
