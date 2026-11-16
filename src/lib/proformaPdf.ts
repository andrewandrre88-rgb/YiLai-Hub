import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CalculatedDocumentTotals,
  DOCUMENT_THEMES,
  TRADE_CURRENCIES,
  TradeCurrencyCode,
  TradeDocumentState,
  amountToWords,
  formatTradeCurrency,
  formatTradeUnitPrice,
  getLineItemQuantity,
  renderPresetStampDataUrl,
} from './proformaTypes';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [30, 58, 138];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [
    Number.isFinite(r) ? r : 30,
    Number.isFinite(g) ? g : 58,
    Number.isFinite(b) ? b : 138,
  ];
}

function pdfCurrency(amount: number, currency: TradeCurrencyCode, decimals?: number): string {
  const formatted = formatTradeCurrency(amount, currency, decimals);
  return formatted
    .replace(/^\$/, '$ ')
    .replace(/\u20ac/g, 'EUR ')
    .replace(/\u00a3/g, 'GBP ')
    .replace(/\u00a5/g, 'RMB ');
}

function pdfUnit(amount: number, currency: TradeCurrencyCode): string {
  const formatted = formatTradeUnitPrice(amount, currency);
  return formatted
    .replace(/^\$/, '$ ')
    .replace(/\u20ac/g, 'EUR ')
    .replace(/\u00a3/g, 'GBP ')
    .replace(/\u00a5/g, 'RMB ');
}

function safeAscii(text: string): string {
  return (text || '')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u00b7/g, ' | ')
    .replace(/\u00a5/g, 'RMB ')
    .replace(/\u20ac/g, 'EUR ')
    .replace(/\u00a3/g, 'GBP ')
    .trim();
}

async function loadImageData(
  src: string,
  preserveAlpha = false
): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' } | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const size = preserveAlpha ? 400 : 260;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        if (!preserveAlpha) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
        }
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        if (preserveAlpha) {
          resolve({ dataUrl: canvas.toDataURL('image/png'), format: 'PNG' });
        } else {
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.88), format: 'JPEG' });
        }
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

export async function downloadTradeDocumentPdf(
  docState: TradeDocumentState,
  totals: CalculatedDocumentTotals
): Promise<void> {
  const theme = DOCUMENT_THEMES[docState.themeId] || DOCUMENT_THEMES.navy;
  const currMeta = TRADE_CURRENCIES[docState.currency] || TRADE_CURRENCIES.USD;
  const primaryRgb = hexToRgb(theme.primaryColor);
  const lightRgb = hexToRgb(theme.primaryLight);
  const borderRgb = hexToRgb(theme.borderLight);
  const badgeBgRgb = hexToRgb(theme.badgeBg);
  const badgeTextRgb = hexToRgb(theme.badgeText);

  const isPacking = docState.documentType === 'packing_list';
  const docNumber = isPacking ? docState.packingListNumber : docState.piNumber;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // 1. Top Accent Strip (full width)
  pdf.setFillColor(...primaryRgb);
  pdf.rect(0, 0, pageWidth, 2.8, 'F');

  let y = 9.5;

  // 2. Document Header (PI/PL badge or Seller logo + Seller Legal Name in primaryColor; Right badge + doc number)
  let logoOffset = 0;
  if (docState.sellerLogoUrl) {
    const logo = await loadImageData(docState.sellerLogoUrl, true);
    if (logo) {
      pdf.addImage(logo.dataUrl, logo.format, margin, y - 1.5, 11, 11);
      logoOffset = 14;
    }
  }
  if (logoOffset === 0) {
    pdf.setFillColor(...primaryRgb);
    pdf.roundedRect(margin, y - 1.5, 10.5, 10.5, 1.8, 1.8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text(isPacking ? 'PL' : 'PI', margin + 5.25, y + 4.9, { align: 'center' });
    logoOffset = 14;
  }

  // Right side badge width calculation so seller name wraps cleanly without colliding
  const badgeText = isPacking ? 'COMMERCIAL PACKING LIST' : 'PROFORMA INVOICE';
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  const badgeW = Math.max(38, pdf.getTextWidth(badgeText) + 9);
  const sellerMaxW = contentWidth - logoOffset - badgeW - 6;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(...primaryRgb);
  const sellerLines = pdf.splitTextToSize(
    safeAscii(docState.sellerCompany).toUpperCase(),
    sellerMaxW
  ) as string[];
  pdf.text(sellerLines, margin + logoOffset, y + 2.5);

  let leftY = y + 2.5 + sellerLines.length * 4.8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  const sellerSub = [
    docState.sellerTaxId ? `Tax / VAT: ${safeAscii(docState.sellerTaxId)}` : '',
    safeAscii(docState.sellerWebsite),
  ]
    .filter(Boolean)
    .join('   |   ');
  if (sellerSub) {
    pdf.text(sellerSub, margin + logoOffset, leftY);
    leftY += 4.2;
  }

  // Header Right: Pill Badge + Bold Doc No + Subtitle
  pdf.setFillColor(...badgeBgRgb);
  pdf.roundedRect(pageWidth - margin - badgeW, y - 1.5, badgeW, 6.5, 1.4, 1.4, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.2);
  pdf.setTextColor(...badgeTextRgb);
  pdf.text(badgeText, pageWidth - margin - badgeW / 2, y + 2.8, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(safeAscii(docNumber), pageWidth - margin, y + 10.5, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.8);
  pdf.setTextColor(100, 116, 139);
  const rightSub = docState.poReference
    ? `PO Ref: ${safeAscii(docState.poReference)}`
    : isPacking
      ? 'Packing Specification'
      : 'Commercial Offer';
  pdf.text(rightSub, pageWidth - margin, y + 14.8, { align: 'right' });

  y = Math.max(leftY + 2, y + 18);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.25);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 4;

  // 3. 4-Column Metadata Highlights Bar
  const metaH = 14;
  pdf.setFillColor(...lightRgb);
  pdf.setDrawColor(...borderRgb);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(margin, y, contentWidth, metaH, 1.8, 1.8, 'FD');

  const metaCols = [
    { label: 'DATE OF ISSUE', val: safeAscii(docState.issueDate) },
    { label: 'VALID UNTIL', val: safeAscii(docState.validUntil) },
    {
      label: 'INCOTERMS 2020',
      val: safeAscii(`${docState.incoterm}${docState.incotermPlace ? ` (${docState.incotermPlace})` : ''}`),
    },
    { label: 'INVOICE CURRENCY', val: `${currMeta.name} (${docState.currency})` },
  ];
  const metaColW = contentWidth / 4;
  metaCols.forEach((mc, idx) => {
    const mx = margin + idx * metaColW + 3.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(mc.label, mx, y + 4.8);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    const valClip = pdf.splitTextToSize(mc.val || '-', metaColW - 6) as string[];
    pdf.text(valClip[0] || '-', mx, y + 10.2);
  });

  y += metaH + 4.5;

  // 4. Two-Column Parties Grid (with clean inner padding & safe text wrapping)
  const gap = 4.5;
  const partyW = (contentWidth - gap) / 2;
  const textMaxW = partyW - 8;

  const buildPartyBlock = (
    company: string,
    contact: string,
    address: string,
    email: string,
    phone: string,
    taxId: string
  ) => {
    const nameLines = pdf.splitTextToSize(safeAscii(company).toUpperCase(), textMaxW) as string[];
    const attnLines = contact ? (pdf.splitTextToSize(`Attn: ${safeAscii(contact)}`, textMaxW) as string[]) : [];
    const addrLines = address ? (pdf.splitTextToSize(safeAscii(address), textMaxW) as string[]) : [];
    const contactStr = [email ? `Email: ${safeAscii(email)}` : '', phone ? `Tel: ${safeAscii(phone)}` : '']
      .filter(Boolean)
      .join('  ·  ');
    const contactLines = contactStr ? (pdf.splitTextToSize(contactStr, textMaxW) as string[]) : [];
    const taxLines = taxId ? (pdf.splitTextToSize(`Tax/VAT: ${safeAscii(taxId)}`, textMaxW) as string[]) : [];

    const totalBodyLines =
      nameLines.length + attnLines.length + addrLines.length + contactLines.length + taxLines.length;
    return {
      nameLines,
      attnLines,
      addrLines,
      contactLines,
      taxLines,
      height: Math.max(30, 12 + totalBodyLines * 4 + (contactLines.length > 0 ? 2.5 : 0)),
    };
  };

  const sellerBlock = buildPartyBlock(
    docState.sellerCompany,
    docState.sellerContact,
    docState.sellerAddress,
    docState.sellerEmail,
    docState.sellerPhone,
    docState.sellerTaxId
  );
  const buyerBlock = buildPartyBlock(
    docState.buyerCompany || 'Consignee Company Name',
    docState.buyerContact,
    [docState.buyerAddress, docState.buyerCountry].filter(Boolean).join(', '),
    docState.buyerEmail,
    docState.buyerPhone,
    docState.buyerTaxId
  );

  const partyH = Math.max(sellerBlock.height, buyerBlock.height);

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(margin, y, partyW, partyH, 1.8, 1.8, 'FD');
  pdf.roundedRect(margin + partyW + gap, y, partyW, partyH, 1.8, 1.8, 'FD');

  const drawParty = (
    xStart: number,
    heading: string,
    block: ReturnType<typeof buildPartyBlock>
  ) => {
    let py = y + 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(...primaryRgb);
    pdf.text(heading, xStart + 4, py);
    py += 5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(block.nameLines, xStart + 4, py);
    py += block.nameLines.length * 4.2 + 0.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.8);
    pdf.setTextColor(71, 85, 105);

    if (block.attnLines.length > 0) {
      pdf.text(block.attnLines, xStart + 4, py);
      py += block.attnLines.length * 3.8;
    }
    if (block.addrLines.length > 0) {
      pdf.text(block.addrLines, xStart + 4, py);
      py += block.addrLines.length * 3.8;
    }

    py += 1.5;
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    if (block.contactLines.length > 0) {
      pdf.text(block.contactLines, xStart + 4, py);
      py += block.contactLines.length * 3.6;
    }
    if (block.taxLines.length > 0) {
      pdf.text(block.taxLines, xStart + 4, py);
    }
  };

  drawParty(margin, 'SELLER / EXPORTER', sellerBlock);
  drawParty(margin + partyW + gap, 'BUYER / IMPORTER (CONSIGNEE)', buyerBlock);

  y += partyH + 4;

  // 5. Shipping & Transport Specification Bar
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, contentWidth, 9.5, 1.5, 1.5, 'FD');

  const modeLabel =
    docState.transportMode === 'sea'
      ? 'Ocean Freight'
      : docState.transportMode === 'air'
        ? 'Air Freight'
        : docState.transportMode === 'truck'
          ? 'Land / Courier'
          : 'Multimodal';

  const shipSegments = [
    `Mode: ${modeLabel}`,
    docState.portOfLoading ? `Loading: ${safeAscii(docState.portOfLoading)}` : '',
    docState.portOfDischarge ? `Discharge: ${safeAscii(docState.portOfDischarge)}` : '',
    `Origin: ${safeAscii(docState.countryOfOrigin || 'China')}`,
  ].filter(Boolean);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.8);
  pdf.setTextColor(51, 65, 85);
  const shipClip = pdf.splitTextToSize(shipSegments.join('   |   '), contentWidth - 7) as string[];
  pdf.text(shipClip[0] || '', margin + 3.5, y + 6);

  y += 13;

  // 6. Line Items Table (8 columns for PI with inline product photo inside Description cell)
  const includeImages =
    docState.showProductImages && docState.items.some((i) => Boolean(i.imageUrl?.trim()));
  const resolvedImages = includeImages
    ? await Promise.all(
        docState.items.map((item) =>
          item.imageUrl ? loadImageData(item.imageUrl, false) : Promise.resolve(null)
        )
      )
    : docState.items.map(() => null);

  const tableHead = isPacking
    ? [
        [
          '#',
          'DESCRIPTION & TECHNICAL SPECIFICATIONS',
          'HS CODE',
          'CARTONS',
          'UNITS/CTN',
          'QTY',
          'NET WT',
          'GROSS WT',
          'CBM',
        ],
      ]
    : [
        [
          '#',
          'DESCRIPTION & TECHNICAL SPECIFICATIONS',
          'HS CODE',
          'CARTONS',
          'UNITS/CTN',
          'QTY',
          'UNIT PRICE',
          'TOTAL',
        ],
      ];

  const tableBody = docState.items.map((item, idx) => {
    const qty = getLineItemQuantity(item);
    const descParts = [
      safeAscii(item.description || 'Product'),
      item.specifications ? safeAscii(item.specifications) : '',
    ].filter(Boolean);
    const descText = descParts.join('\n');

    if (isPacking) {
      const cbmPerCtn =
        item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
          ? (item.lengthCm * item.widthCm * item.heightCm) / 1_000_000
          : 0;
      const lineNet = (item.cartons * item.netWeightPerCartonKg).toFixed(1);
      const lineGross = (item.cartons * item.grossWeightPerCartonKg).toFixed(1);
      const lineCbm = (item.cartons * cbmPerCtn).toFixed(2);
      return [
        String(idx + 1),
        descText,
        safeAscii(item.hsCode || '-'),
        item.cartons.toLocaleString('en-US'),
        item.unitsPerCarton.toLocaleString('en-US'),
        `${qty.toLocaleString('en-US')} ${item.unitLabel || 'units'}`,
        `${lineNet} kg`,
        `${lineGross} kg`,
        `${lineCbm} m3`,
      ];
    }

    const lineTotal = qty * item.unitPrice;
    return [
      String(idx + 1),
      descText,
      safeAscii(item.hsCode || '-'),
      item.cartons.toLocaleString('en-US'),
      item.unitsPerCarton.toLocaleString('en-US'),
      `${qty.toLocaleString('en-US')} ${item.unitLabel || 'units'}`,
      pdfUnit(item.unitPrice, docState.currency),
      pdfCurrency(lineTotal, docState.currency),
    ];
  });

  const tableFoot = isPacking
    ? [
        [
          '',
          '',
          'Total Cartons:',
          `${totals.totalCartons.toLocaleString('en-US')} CTN`,
          '',
          `${totals.totalUnits.toLocaleString('en-US')} units`,
          `${totals.totalNetWeightKg.toFixed(1)} kg`,
          `${totals.totalGrossWeightKg.toFixed(1)} kg`,
          `${totals.totalCbm.toFixed(2)} m3`,
        ],
      ]
    : [
        [
          '',
          '',
          'Total Cartons:',
          `${totals.totalCartons.toLocaleString('en-US')} CTN`,
          '',
          '',
          '',
          '',
        ],
      ];

  const colStyles: Record<
    number,
    { cellWidth?: number; halign?: 'left' | 'right' | 'center'; fontStyle?: 'normal' | 'bold' }
  > = isPacking
    ? {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 20 },
        3: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 15, halign: 'right' },
        7: { cellWidth: 16, halign: 'right' },
        8: { cellWidth: 15, halign: 'right', fontStyle: 'bold' },
      }
    : {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 67 },
        2: { cellWidth: 22 },
        3: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 16, halign: 'right' },
        5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      };

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: primaryRgb,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      cellPadding: { top: 2.8, bottom: 2.8, left: 2, right: 2 },
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 7.8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: colStyles,
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.column.index === 1) {
        const hasImg = Boolean(resolvedImages[hook.row.index]);
        if (hasImg) {
          hook.cell.styles.cellPadding = { top: 3.2, bottom: 3.2, left: 13.5, right: 2.5 };
          hook.cell.styles.minCellHeight = 14.5;
        }
      }
      if (hook.section === 'foot' && hook.column.index === 3) {
        hook.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawCell: (hook) => {
      if (hook.section !== 'body' || hook.column.index !== 1) return;
      const img = resolvedImages[hook.row.index];
      if (!img) return;
      const box = 10;
      const ix = hook.cell.x + 2;
      const iy = hook.cell.y + Math.max(2, (hook.cell.height - box) / 2);
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(ix, iy, box, box, 1, 1, 'FD');
      pdf.addImage(img.dataUrl, img.format, ix + 0.4, iy + 0.4, box - 0.8, box - 0.8);
    },
  });

  const lastTableY =
    (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 30;
  y = lastTableY + 5.5;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      pdf.addPage();
      y = 14;
    }
  };

  // 7. Financial & Banking 12-Col Split matching reference layout
  if (!isPacking) {
    const leftW = contentWidth * (7 / 12) - 2.5;
    const rightW = contentWidth * (5 / 12) - 2.5;
    const rightX = margin + leftW + 5;

    const wordsLines = pdf.splitTextToSize(
      safeAscii(amountToWords(totals.grandTotal, docState.currency)),
      leftW - 7
    ) as string[];
    const wordsBoxH = wordsLines.length * 4 + 9.5;

    const bankLines = [
      `Beneficiary: ${safeAscii(docState.bankBeneficiary)}`,
      `Bank Name: ${safeAscii(docState.bankName)}`,
      `SWIFT: ${safeAscii(docState.bankSwift)}  ·  Account: ${safeAscii(docState.bankAccountNumber)}`,
      docState.intermediaryBank
        ? `Intermediary Bank: ${safeAscii(docState.intermediaryBank)}${
            docState.intermediarySwift ? ` (${safeAscii(docState.intermediarySwift)})` : ''
          }`
        : '',
      safeAscii(docState.bankNote),
    ]
      .filter(Boolean)
      .flatMap((l) => pdf.splitTextToSize(l, leftW - 7) as string[]);
    const bankBoxH = bankLines.length * 3.9 + 10;

    // Right card height computation
    const extraFinRows =
      (totals.freight > 0 ? 1 : 0) +
      (totals.insurance > 0 ? 1 : 0) +
      (totals.taxAmount > 0 ? 1 : 0) +
      (totals.discount > 0 ? 1 : 0);
    const subtotalAreaH = 9 + extraFinRows * 4.8;
    const totalBannerH = 9.5;
    const milestoneAreaH = docState.showMilestoneSplit ? 25.5 : 3;
    const rightBoxH = subtotalAreaH + totalBannerH + milestoneAreaH + 3;

    const blockH = Math.max(wordsBoxH + 3.5 + bankBoxH, rightBoxH);
    ensureSpace(blockH + 6);

    // Left Top: Amount in Words
    pdf.setFillColor(...lightRgb);
    pdf.setDrawColor(...borderRgb);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(margin, y, leftW, wordsBoxH, 1.8, 1.8, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text('AMOUNT IN WORDS:', margin + 3.5, y + 4.8);
    pdf.setFont('helvetica', 'bolditalic');
    pdf.setFontSize(8.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text(wordsLines, margin + 3.5, y + 9.2);

    // Left Bottom: Bank Wire Remittance Instructions
    const bankY = y + wordsBoxH + 3.5;
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, bankY, leftW, bankBoxH, 1.8, 1.8, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(...primaryRgb);
    pdf.text('BANK WIRE REMITTANCE INSTRUCTIONS', margin + 3.5, bankY + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.6);
    pdf.setTextColor(71, 85, 105);
    pdf.text(bankLines, margin + 3.5, bankY + 9.5);

    // Right: Unified Financial Totals & Payment Schedule Card
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(rightX, y, rightW, rightBoxH, 1.8, 1.8, 'FD');

    let fy = y + 5.8;
    const drawFinLine = (label: string, val: string, isDiscount = false) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.8);
      pdf.setTextColor(isDiscount ? 190 : 71, isDiscount ? 18 : 85, isDiscount ? 60 : 105);
      pdf.text(label, rightX + 3.5, fy);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(isDiscount ? 190 : 15, isDiscount ? 18 : 23, isDiscount ? 60 : 42);
      pdf.text(val, rightX + rightW - 3.5, fy, { align: 'right' });
      fy += 4.8;
    };

    drawFinLine('Subtotal', pdfCurrency(totals.subtotal, docState.currency));
    if (totals.freight > 0) drawFinLine('Freight / Shipping', pdfCurrency(totals.freight, docState.currency));
    if (totals.insurance > 0) drawFinLine('Cargo Insurance', pdfCurrency(totals.insurance, docState.currency));
    if (totals.taxAmount > 0) drawFinLine(`Tax (${docState.taxRatePct}%)`, pdfCurrency(totals.taxAmount, docState.currency));
    if (totals.discount > 0) drawFinLine('Discount', `-${pdfCurrency(totals.discount, docState.currency)}`, true);

    // Solid primaryColor TOTAL DUE Banner
    fy += 1;
    const bannerX = rightX + 3;
    const bannerW = rightW - 6;
    pdf.setFillColor(...primaryRgb);
    pdf.roundedRect(bannerX, fy, bannerW, 8.2, 1.2, 1.2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`TOTAL DUE (${docState.currency})`, bannerX + 3, fy + 5.4);
    pdf.setFontSize(9.5);
    pdf.text(pdfCurrency(totals.grandTotal, docState.currency), bannerX + bannerW - 3, fy + 5.5, {
      align: 'right',
    });

    fy += 11.5;

    // Payment Schedule & Milestone Rows inside the same right card
    if (docState.showMilestoneSplit) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('PAYMENT SCHEDULE', bannerX + 0.5, fy + 1.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(51, 65, 85);
      pdf.text(`${docState.depositPct}% / ${100 - docState.depositPct}%`, bannerX + bannerW - 0.5, fy + 1.5, {
        align: 'right',
      });

      fy += 3.8;

      // Advance Deposit Row (Blue dot + soft blue fill)
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(191, 219, 254);
      pdf.roundedRect(bannerX, fy, bannerW, 7.2, 1.2, 1.2, 'FD');
      pdf.setFillColor(37, 99, 235);
      pdf.circle(bannerX + 3.2, fy + 3.6, 0.9, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.1);
      pdf.setTextColor(30, 58, 138);
      const depValText = pdfCurrency(totals.depositAmount, docState.currency);
      const depValW = pdf.getTextWidth(depValText);
      const depLabelClip = pdf.splitTextToSize(
        safeAscii(docState.depositLabel),
        bannerW - depValW - 10
      ) as string[];
      pdf.text(depLabelClip[0] || `${docState.depositPct}% Advance Deposit`, bannerX + 5.8, fy + 4.7);
      pdf.text(depValText, bannerX + bannerW - 2.5, fy + 4.7, { align: 'right' });

      fy += 8.6;

      // Balance Payment Row (Emerald dot + soft green fill)
      pdf.setFillColor(236, 253, 245);
      pdf.setDrawColor(167, 243, 208);
      pdf.roundedRect(bannerX, fy, bannerW, 7.2, 1.2, 1.2, 'FD');
      pdf.setFillColor(16, 185, 129);
      pdf.circle(bannerX + 3.2, fy + 3.6, 0.9, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.1);
      pdf.setTextColor(6, 95, 70);
      const balValText = pdfCurrency(totals.balanceAmount, docState.currency);
      const balValW = pdf.getTextWidth(balValText);
      const balLabelClip = pdf.splitTextToSize(
        safeAscii(docState.balanceLabel),
        bannerW - balValW - 10
      ) as string[];
      pdf.text(balLabelClip[0] || `${100 - docState.depositPct}% Balance`, bannerX + 5.8, fy + 4.7);
      pdf.text(balValText, bannerX + bannerW - 2.5, fy + 4.7, { align: 'right' });
    }

    if (docState.pricingFootnote) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      const fnLines = pdf.splitTextToSize(safeAscii(docState.pricingFootnote), rightW - 2) as string[];
      pdf.text(fnLines, rightX + 1, y + rightBoxH + 3.5);
    }

    y += blockH + 7.5;
  } else {
    ensureSpace(26);
    pdf.setFillColor(...lightRgb);
    pdf.setDrawColor(...borderRgb);
    pdf.roundedRect(margin, y, contentWidth, 21, 1.8, 1.8, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...primaryRgb);
    pdf.text('PACKING SPECIFICATIONS & SHIPPING MARKS', margin + 3.5, y + 5.2);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text(
      safeAscii(
        `Package Type: ${docState.packageType}  |  Total Cartons: ${totals.totalCartons} CTN  |  Net Wt: ${totals.totalNetWeightKg.toFixed(
          1
        )} kg  |  Gross Wt: ${totals.totalGrossWeightKg.toFixed(1)} kg  |  Volume: ${totals.totalCbm.toFixed(
          2
        )} m3`
      ),
      margin + 3.5,
      y + 10.8
    );
    pdf.text(
      `Shipping Marks: ${safeAscii(docState.shippingMarks.replace(/\n/g, ' / '))}`,
      margin + 3.5,
      y + 16
    );
    y += 25;
  }

  // 8. Commercial Terms & Declarations + Signatures
  const termsText = docState.termsList.map((t, i) => `${i + 1}. ${safeAscii(t)}`);
  const wrappedTerms = termsText.flatMap((t) => pdf.splitTextToSize(t, contentWidth - 4) as string[]);
  ensureSpace(wrappedTerms.length * 3.8 + 28);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.6);
  pdf.setTextColor(30, 41, 59);
  pdf.text('COMMERCIAL TERMS & DECLARATIONS', margin, y);
  y += 4.2;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.6);
  pdf.setTextColor(71, 85, 105);
  pdf.text(wrappedTerms, margin, y);
  y += wrappedTerms.length * 3.8 + 7;

  ensureSpace(22);
  const sigW = (contentWidth - 18) / 2;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Accepted & Confirmed By (Buyer):', margin, y);
  pdf.text('For and on behalf of (Seller):', margin + sigW + 18, y);

  y += 11;
  pdf.setDrawColor(203, 213, 225);
  pdf.line(margin, y, margin + sigW, y);
  pdf.line(margin + sigW + 18, y, margin + sigW * 2 + 18, y);

  y += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.8);
  pdf.setTextColor(15, 23, 42);
  pdf.text(safeAscii(docState.buyerSignatory || docState.buyerCompany), margin, y);
  pdf.text(safeAscii(docState.authorizedSignatory || docState.sellerCompany), margin + sigW + 18, y);

  // 9. Company Stamp Overlay at exact (stampXPercent, stampYPercent)
  if (docState.stampEnabled) {
    const rawStamp =
      docState.stampStyle === 'custom' && docState.stampCustomUrl
        ? docState.stampCustomUrl
        : renderPresetStampDataUrl(docState.stampStyle, docState.stampText, docState.stampSubText);
    const stampImg = rawStamp ? await loadImageData(rawStamp, true) : null;
    if (stampImg) {
      const stampSizeMm = 31 * Math.max(0.6, Math.min(1.5, docState.stampScale || 1));
      const cx = (Math.max(8, Math.min(92, docState.stampXPercent)) / 100) * pageWidth;
      const cy = (Math.max(8, Math.min(92, docState.stampYPercent)) / 100) * pageHeight;
      pdf.addImage(
        stampImg.dataUrl,
        stampImg.format,
        cx - stampSizeMm / 2,
        cy - stampSizeMm / 2,
        stampSizeMm,
        stampSizeMm
      );
    }
  }

  // Bottom Accent Strip matching reference template
  pdf.setFillColor(...primaryRgb);
  pdf.rect(0, pageHeight - 1.8, pageWidth, 1.8, 'F');

  // Trigger clean Blob download
  const cleanFileName = `${(docNumber || 'Proforma_Invoice').replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`;
  const pdfBlob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = cleanFileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
}
