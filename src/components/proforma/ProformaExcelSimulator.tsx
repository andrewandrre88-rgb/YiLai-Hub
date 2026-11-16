import { useMemo, useState } from 'react';
import {
  CalculatedDocumentTotals,
  DOCUMENT_THEMES,
  TradeDocumentState,
  amountToWords,
  formatTradeCurrency,
  formatTradeUnitPrice,
} from '../../lib/proformaTypes';

interface ProformaExcelSimulatorProps {
  doc: TradeDocumentState;
  totals: CalculatedDocumentTotals;
}

interface SheetCellData {
  value: string;
  formula?: string;
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
  mono?: boolean;
  bg?: string;
  color?: string;
  colSpan?: number;
  borderBottom?: 'thin' | 'double' | 'medium';
}

interface SheetRowData {
  rowNum: number;
  cells: Array<SheetCellData | null>;
}

export default function ProformaExcelSimulator({ doc, totals }: ProformaExcelSimulatorProps) {
  const theme = DOCUMENT_THEMES[doc.themeId] || DOCUMENT_THEMES.navy;
  const isPacking = doc.documentType === 'packing_list';
  const docNumber = isPacking ? doc.packingListNumber : doc.piNumber;

  const colLetters = isPacking
    ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
    : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  const [selectedRef, setSelectedRef] = useState<string>('H20');

  const { rows, cellLookup } = useMemo(() => {
    const builtRows: SheetRowData[] = [];
    const lookup = new Map<string, { display: string; formula: string }>();

    const recordCell = (r: number, cIdx: number, cell: SheetCellData | null) => {
      if (!cell) return;
      const ref = `${colLetters[cIdx]}${r}`;
      lookup.set(ref, {
        display: cell.value,
        formula: cell.formula || cell.value,
      });
    };

    const totalCols = colLetters.length;
    const emptyCells = (): Array<SheetCellData | null> => Array(totalCols).fill(null);

    // Row 1: Theme Accent Strip
    const r1 = emptyCells();
    r1[0] = {
      value: `${theme.name.toUpperCase()} — ${isPacking ? 'COMMERCIAL PACKING LIST' : 'PROFORMA INVOICE'}`,
      colSpan: totalCols,
      bg: theme.primaryColor,
      color: '#FFFFFF',
      bold: true,
      align: 'center',
    };
    builtRows.push({ rowNum: 1, cells: r1 });

    // Row 2: Company & Document Title
    const r2 = emptyCells();
    r2[0] = { value: doc.sellerCompany, colSpan: 5, bold: true, color: theme.primaryColor };
    r2[5] = {
      value: isPacking ? 'COMMERCIAL PACKING LIST' : 'PROFORMA INVOICE',
      colSpan: totalCols - 5,
      bold: true,
      align: 'right',
      bg: theme.badgeBg,
      color: theme.badgeText,
    };
    builtRows.push({ rowNum: 2, cells: r2 });

    // Row 3: Meta & Doc Number
    const r3 = emptyCells();
    r3[0] = {
      value: [doc.sellerWebsite, doc.sellerTaxId ? `Tax ID: ${doc.sellerTaxId}` : ''].filter(Boolean).join('  |  '),
      colSpan: 5,
      color: '#475569',
    };
    r3[5] = {
      value: `No.: ${docNumber} | PO: ${doc.poReference || '-'}`,
      colSpan: totalCols - 5,
      align: 'right',
      bold: true,
      mono: true,
    };
    builtRows.push({ rowNum: 3, cells: r3 });

    // Row 4: Metadata Strip
    const r4 = emptyCells();
    r4[0] = { value: `Issue: ${doc.issueDate}`, colSpan: 2, bg: theme.primaryLight, color: theme.primaryColor, bold: true, mono: true };
    r4[2] = { value: `Valid: ${doc.validUntil}`, colSpan: 2, bg: theme.primaryLight, color: theme.primaryColor, bold: true, mono: true };
    r4[4] = {
      value: `Incoterms 2020: ${doc.incoterm} ${doc.incotermPlace}`,
      colSpan: totalCols - 5,
      bg: theme.primaryLight,
      color: theme.primaryColor,
      bold: true,
    };
    r4[totalCols - 1] = {
      value: `Currency: ${doc.currency}`,
      bg: theme.primaryLight,
      color: theme.primaryColor,
      bold: true,
      align: 'right',
      mono: true,
    };
    builtRows.push({ rowNum: 4, cells: r4 });

    // Row 5-8: Parties
    const splitCol = isPacking ? 4 : 4;
    const r5 = emptyCells();
    r5[0] = { value: 'SELLER / EXPORTER', colSpan: splitCol, bold: true, color: theme.primaryColor, bg: '#F8FAFC' };
    r5[splitCol] = {
      value: 'BUYER / IMPORTER (CONSIGNEE)',
      colSpan: totalCols - splitCol,
      bold: true,
      color: theme.primaryColor,
      bg: '#F8FAFC',
    };
    builtRows.push({ rowNum: 5, cells: r5 });

    const r6 = emptyCells();
    r6[0] = { value: doc.sellerCompany, colSpan: splitCol, bold: true };
    r6[splitCol] = { value: doc.buyerCompany || 'TBD', colSpan: totalCols - splitCol, bold: true };
    builtRows.push({ rowNum: 6, cells: r6 });

    const r7 = emptyCells();
    r7[0] = { value: `${doc.sellerAddress} (${doc.sellerContact})`, colSpan: splitCol, color: '#475569' };
    r7[splitCol] = {
      value: `${[doc.buyerAddress, doc.buyerCountry].filter(Boolean).join(', ')} (${doc.buyerContact || '-'})`,
      colSpan: totalCols - splitCol,
      color: '#475569',
    };
    builtRows.push({ rowNum: 7, cells: r7 });

    // Row 8: Transport Bar
    const r8 = emptyCells();
    r8[0] = {
      value: `Mode: ${doc.transportMode.toUpperCase()}  |  Loading: ${doc.portOfLoading}  |  Discharge: ${doc.portOfDischarge}  |  Origin: ${doc.countryOfOrigin}`,
      colSpan: totalCols,
      bg: '#F1F5F9',
      color: '#334155',
    };
    builtRows.push({ rowNum: 8, cells: r8 });

    // Row 9: Table Header
    const headers = isPacking
      ? ['#', 'Description & Specifications', 'HS Code', 'Cartons', 'Units/Ctn', 'Total Qty', 'Net Wt (kg)', 'Gross Wt (kg)', 'CBM']
      : ['#', 'Description & Specifications', 'HS Code', 'Cartons', 'Units/Ctn', 'Total Qty', `Unit (${doc.currency})`, `Total (${doc.currency})`];
    const r9 = headers.map((h, idx) => ({
      value: h,
      bg: theme.primaryColor,
      color: '#FFFFFF',
      bold: true,
      align: (idx >= 3 ? 'right' : idx === 0 ? 'center' : 'left') as 'left' | 'right' | 'center',
    }));
    builtRows.push({ rowNum: 9, cells: r9 });

    const firstItemRow = 10;
    doc.items.forEach((item, idx) => {
      const r = firstItemRow + idx;
      const qty = item.cartons * item.unitsPerCarton;
      const zebra = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
      const qtyFormula = `=D${r}*E${r}`;

      if (isPacking) {
        const cbmPerCtn =
          item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
            ? (item.lengthCm * item.widthCm * item.heightCm) / 1_000_000
            : 0;
        const lineNet = (item.cartons * item.netWeightPerCartonKg).toFixed(1);
        const lineGross = (item.cartons * item.grossWeightPerCartonKg).toFixed(1);
        const lineCbm = (item.cartons * cbmPerCtn).toFixed(2);
        builtRows.push({
          rowNum: r,
          cells: [
            { value: String(idx + 1), align: 'center', mono: true, bg: zebra },
            { value: `${item.description}${item.sku ? ` (${item.sku})` : ''}`, bg: zebra },
            { value: item.hsCode || '-', mono: true, bg: zebra },
            { value: item.cartons.toLocaleString('en-US'), align: 'right', mono: true, bg: zebra },
            { value: item.unitsPerCarton.toLocaleString('en-US'), align: 'right', mono: true, bg: zebra },
            {
              value: `${qty.toLocaleString('en-US')} ${item.unitLabel || 'pcs'}`,
              formula: qtyFormula,
              align: 'right',
              mono: true,
              bg: zebra,
            },
            { value: lineNet, formula: `=D${r}*${item.netWeightPerCartonKg}`, align: 'right', mono: true, bg: zebra },
            { value: lineGross, formula: `=D${r}*${item.grossWeightPerCartonKg}`, align: 'right', mono: true, bg: zebra },
            { value: lineCbm, formula: `=D${r}*${cbmPerCtn.toFixed(4)}`, align: 'right', mono: true, bold: true, bg: zebra },
          ],
        });
      } else {
        const lineTotal = qty * item.unitPrice;
        builtRows.push({
          rowNum: r,
          cells: [
            { value: String(idx + 1), align: 'center', mono: true, bg: zebra },
            { value: `${item.description}${item.sku ? ` (${item.sku})` : ''}`, bg: zebra },
            { value: item.hsCode || '-', mono: true, bg: zebra },
            { value: item.cartons.toLocaleString('en-US'), align: 'right', mono: true, bg: zebra },
            { value: item.unitsPerCarton.toLocaleString('en-US'), align: 'right', mono: true, bg: zebra },
            {
              value: `${qty.toLocaleString('en-US')} ${item.unitLabel || 'pcs'}`,
              formula: qtyFormula,
              align: 'right',
              mono: true,
              bg: zebra,
            },
            { value: formatTradeUnitPrice(item.unitPrice, doc.currency), align: 'right', mono: true, bg: zebra },
            {
              value: formatTradeCurrency(lineTotal, doc.currency),
              formula: `=F${r}*G${r}`,
              align: 'right',
              mono: true,
              bold: true,
              bg: zebra,
            },
          ],
        });
      }
    });

    const lastItemRow = firstItemRow + Math.max(0, doc.items.length - 1);
    const footRowNum = firstItemRow + doc.items.length;
    const footerCells = emptyCells();
    footerCells[0] = {
      value: 'TOTAL CARTONS & SUMMARY',
      colSpan: 3,
      bold: true,
      bg: theme.primaryLight,
      color: theme.primaryColor,
    };
    footerCells[3] = {
      value: `${totals.totalCartons.toLocaleString('en-US')} ctns`,
      formula: doc.items.length > 0 ? `=SUM(D${firstItemRow}:D${lastItemRow})` : '=0',
      align: 'right',
      bold: true,
      mono: true,
      bg: theme.primaryLight,
      color: theme.primaryColor,
    };
    footerCells[4] = { value: '', bg: theme.primaryLight };
    footerCells[5] = {
      value: `${totals.totalUnits.toLocaleString('en-US')} pcs`,
      formula: doc.items.length > 0 ? `=SUM(F${firstItemRow}:F${lastItemRow})` : '=0',
      align: 'right',
      bold: true,
      mono: true,
      bg: theme.primaryLight,
      color: theme.primaryColor,
    };
    if (isPacking) {
      footerCells[6] = {
        value: `${totals.totalNetWeightKg.toFixed(1)} kg`,
        formula: doc.items.length > 0 ? `=SUM(G${firstItemRow}:G${lastItemRow})` : '=0',
        align: 'right',
        bold: true,
        mono: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
      };
      footerCells[7] = {
        value: `${totals.totalGrossWeightKg.toFixed(1)} kg`,
        formula: doc.items.length > 0 ? `=SUM(H${firstItemRow}:H${lastItemRow})` : '=0',
        align: 'right',
        bold: true,
        mono: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
      };
      footerCells[8] = {
        value: `${totals.totalCbm.toFixed(2)} m3`,
        formula: doc.items.length > 0 ? `=SUM(I${firstItemRow}:I${lastItemRow})` : '=0',
        align: 'right',
        bold: true,
        mono: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
      };
    } else {
      footerCells[6] = {
        value: 'SUBTOTAL',
        align: 'right',
        bold: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
      };
      footerCells[7] = {
        value: formatTradeCurrency(totals.subtotal, doc.currency),
        formula: doc.items.length > 0 ? `=SUM(H${firstItemRow}:H${lastItemRow})` : '=0',
        align: 'right',
        bold: true,
        mono: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
      };
    }
    builtRows.push({ rowNum: footRowNum, cells: footerCells });

    if (!isPacking) {
      let finRow = footRowNum + 1;
      const subR = finRow;
      const rSub = emptyCells();
      rSub[0] = {
        value: amountToWords(totals.grandTotal, doc.currency),
        colSpan: 5,
        bold: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
      };
      rSub[5] = { value: 'Subtotal', colSpan: 2, align: 'right' };
      rSub[7] = {
        value: formatTradeCurrency(totals.subtotal, doc.currency),
        formula: `=H${footRowNum}`,
        align: 'right',
        mono: true,
      };
      builtRows.push({ rowNum: finRow++, cells: rSub });

      const rFr = emptyCells();
      rFr[0] = {
        value: `Bank: ${doc.bankName} | SWIFT: ${doc.bankSwift} | Acct: ${doc.bankAccountNumber}`,
        colSpan: 5,
        mono: true,
        color: '#334155',
      };
      rFr[5] = { value: 'Freight & Insurance', colSpan: 2, align: 'right' };
      rFr[7] = {
        value: formatTradeCurrency(totals.freight + totals.insurance, doc.currency),
        formula: `=${totals.freight}+${totals.insurance}`,
        align: 'right',
        mono: true,
      };
      const frR = finRow;
      builtRows.push({ rowNum: finRow++, cells: rFr });

      const rTax = emptyCells();
      rTax[0] = {
        value: `Beneficiary: ${doc.bankBeneficiary}`,
        colSpan: 5,
        color: '#475569',
      };
      rTax[5] = { value: `Tax (${doc.taxRatePct}%) - Discount`, colSpan: 2, align: 'right' };
      rTax[7] = {
        value: formatTradeCurrency(totals.taxAmount - totals.discount, doc.currency),
        formula: `=${totals.taxAmount}-${totals.discount}`,
        align: 'right',
        mono: true,
      };
      const taxR = finRow;
      builtRows.push({ rowNum: finRow++, cells: rTax });

      const totalR = finRow;
      const rTot = emptyCells();
      rTot[5] = {
        value: `TOTAL DUE (${doc.currency})`,
        colSpan: 2,
        align: 'right',
        bold: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
      };
      rTot[7] = {
        value: formatTradeCurrency(totals.grandTotal, doc.currency),
        formula: `=H${subR}+H${frR}+H${taxR}`,
        align: 'right',
        bold: true,
        mono: true,
        bg: theme.primaryLight,
        color: theme.primaryColor,
        borderBottom: 'double',
      };
      builtRows.push({ rowNum: finRow++, cells: rTot });

      if (doc.showMilestoneSplit) {
        const depR = emptyCells();
        depR[5] = {
          value: `${doc.depositPct}% Advance Deposit`,
          colSpan: 2,
          align: 'right',
          bg: '#EFF6FF',
          color: '#1E40AF',
          bold: true,
        };
        depR[7] = {
          value: formatTradeCurrency(totals.depositAmount, doc.currency),
          formula: `=H${totalR}*${(doc.depositPct / 100).toFixed(2)}`,
          align: 'right',
          mono: true,
          bold: true,
          bg: '#EFF6FF',
          color: '#1E40AF',
        };
        builtRows.push({ rowNum: finRow++, cells: depR });

        const balR = emptyCells();
        balR[5] = {
          value: `${100 - doc.depositPct}% Balance Payment`,
          colSpan: 2,
          align: 'right',
          bg: '#ECFDF5',
          color: '#065F46',
          bold: true,
        };
        balR[7] = {
          value: formatTradeCurrency(totals.balanceAmount, doc.currency),
          formula: `=H${totalR}*${((100 - doc.depositPct) / 100).toFixed(2)}`,
          align: 'right',
          mono: true,
          bold: true,
          bg: '#ECFDF5',
          color: '#065F46',
        };
        builtRows.push({ rowNum: finRow++, cells: balR });
      }
    }

    builtRows.forEach((row) => {
      let c = 0;
      while (c < row.cells.length) {
        const cell = row.cells[c];
        if (cell) {
          recordCell(row.rowNum, c, cell);
          c += cell.colSpan || 1;
        } else {
          c += 1;
        }
      }
    });

    return { rows: builtRows, cellLookup: lookup };
  }, [colLetters, doc, docNumber, isPacking, theme, totals]);

  const activeCell = cellLookup.get(selectedRef) || { display: '', formula: '' };

  return (
    <div className="w-full max-w-[980px] mx-auto bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Formula Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-300">
        <div className="w-14 px-2 py-1 text-center text-xs font-semibold font-['JetBrains_Mono',monospace] bg-white border border-slate-300 rounded text-slate-800">
          {selectedRef}
        </div>
        <span className="text-xs font-serif italic font-semibold text-slate-500 px-1">fx</span>
        <div className="flex-1 px-2.5 py-1 text-xs font-['JetBrains_Mono',monospace] bg-white border border-slate-300 rounded text-slate-700 truncate min-h-[26px]">
          {activeCell.formula || 'Click any spreadsheet cell to inspect its formula'}
        </div>
      </div>

      {/* Interactive Spreadsheet Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="w-10 px-2 py-1.5 text-[11px] font-['JetBrains_Mono',monospace] font-medium text-slate-500 border-r border-slate-300 bg-slate-100 select-none">
                #
              </th>
              {colLetters.map((letter) => (
                <th
                  key={letter}
                  className="px-2 py-1.5 text-[11px] font-['JetBrains_Mono',monospace] font-semibold text-slate-600 border-r border-slate-300 bg-slate-100 select-none text-center"
                >
                  {letter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cellsToRender: Array<{ cell: SheetCellData | null; colIdx: number }> = [];
              let c = 0;
              while (c < colLetters.length) {
                const cell = row.cells[c] || null;
                cellsToRender.push({ cell, colIdx: c });
                c += cell?.colSpan || 1;
              }

              return (
                <tr key={row.rowNum} className="border-b border-slate-200">
                  <td className="px-2 py-1.5 text-[11px] font-['JetBrains_Mono',monospace] text-slate-500 text-center bg-slate-50 border-r border-slate-300 select-none">
                    {row.rowNum}
                  </td>
                  {cellsToRender.map(({ cell, colIdx }) => {
                    const ref = `${colLetters[colIdx]}${row.rowNum}`;
                    const isSelected = selectedRef === ref;
                    return (
                      <td
                        key={ref}
                        colSpan={cell?.colSpan || 1}
                        onClick={() => setSelectedRef(ref)}
                        style={{
                          backgroundColor: cell?.bg || '#FFFFFF',
                          color: cell?.color || '#0F172A',
                        }}
                        className={`px-2.5 py-1.5 border-r border-slate-200 cursor-pointer transition-shadow ${
                          cell?.align === 'right'
                            ? 'text-right'
                            : cell?.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                        } ${cell?.bold ? 'font-semibold' : 'font-normal'} ${
                          cell?.mono ? "font-['JetBrains_Mono',monospace] tabular-nums" : ''
                        } ${cell?.borderBottom === 'double' ? 'border-b-4 border-double border-slate-800' : ''} ${
                          isSelected ? 'ring-2 ring-inset ring-sky-600' : 'hover:brightness-[0.98]'
                        }`}
                      >
                        <div className="truncate max-w-[360px]">{cell?.value ?? ''}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
