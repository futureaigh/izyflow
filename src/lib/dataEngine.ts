import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createWorker } from 'tesseract.js';
import { Transaction, Invoice, Account, Workspace, StaffReceipt } from '../types';
import { format, parseISO } from 'date-fns';

// --- IMPORT ENGINE ---

export async function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
}

export async function parseExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);
      resolve(json);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export async function performOCR(imageOrPdf: File): Promise<string> {
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(imageOrPdf);
  await worker.terminate();
  return text;
}

// --- EXPORT ENGINE ---

export function exportToCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPDF(data: any[], filename: string, title: string, summary?: string, recommendation?: string) {
  const doc = new jsPDF();
  const headers = Object.keys(data[0] || {});
  const rows = data.map(obj => Object.values(obj));
  
  doc.setFontSize(18);
  doc.text(title, 14, 15);
  
  let y = 20;
  
  if (summary) {
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(`Summary: ${summary}`, 180);
    doc.text(splitSummary, 14, y);
    y += (splitSummary.length * 5) + 5;
  }
  
  if (recommendation) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const splitRec = doc.splitTextToSize(`Recommendation: ${recommendation}`, 180);
    doc.text(splitRec, 14, y);
    y += (splitRec.length * 5) + 10;
    doc.setFont('helvetica', 'normal');
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: y,
  });
  doc.save(`${filename}.pdf`);
}

// Helper to load image as base64
async function loadImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Helper to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// Sanitize strings for jsPDF — replace em dashes and other non-latin1 chars
function cleanForPDF(str: string): string {
  return str
    .replace(/\u2014/g, ' - ')   // em dash
    .replace(/\u2013/g, ' - ')   // en dash
    .replace(/\u2018|\u2019/g, "'") // smart quotes
    .replace(/\u201c|\u201d/g, '"') // smart double quotes
    .replace(/[^\x00-\xFF]/g, '');  // strip remaining non-latin1
}

export async function generateInvoicePDF(invoice: Invoice, workspace: Workspace) {
  const doc = new jsPDF();
  const margin = 14;
  let y = 20;
  const brandColorRgb = hexToRgb(workspace.brandColor || '#2563eb');

  // Header & Logo
  const logoData = workspace.logoUrl ? await loadImage(workspace.logoUrl) : null;
  
  if (logoData) {
    doc.addImage(logoData, 'PNG', margin, y - 10, 25, 25);
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFont('helvetica', 'bold');
    doc.text(cleanForPDF(workspace.name), margin + 30, y + 5);
    y += 25;
  } else {
    doc.setFontSize(24);
    doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanForPDF(workspace.name), margin, y);
    y += 15;
  }
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  if (workspace.businessAddress) { doc.text(cleanForPDF(workspace.businessAddress), margin, y); y += 5; }
  if (workspace.businessEmail) { doc.text(cleanForPDF(workspace.businessEmail), margin, y); y += 5; }
  if (workspace.businessPhone) { doc.text(cleanForPDF(workspace.businessPhone), margin, y); y += 5; }
  if (workspace.taxId) { doc.text(`Tax ID: ${cleanForPDF(workspace.taxId)}`, margin, y); y += 5; }

  y += 5;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.line(margin, y, 210 - margin, y);
  y += 15;

  // Invoice Title & Meta
  doc.setFontSize(24);
  doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', margin, y);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Invoice #: ${invoice.id.slice(-6).toUpperCase()}`, 150, y - 5);
  doc.text(`Date: ${(() => {
    try {
      return format(parseISO(invoice.createdAt), 'MMM d, yyyy');
    } catch (e) {
      return invoice.createdAt || 'N/A';
    }
  })()}`, 150, y);
  doc.text(`Due Date: ${(() => {
    try {
      return invoice.dueDate ? format(parseISO(invoice.dueDate), 'MMM d, yyyy') : 'No Due Date';
    } catch (e) {
      return 'N/A';
    }
  })()}`, 150, y + 5);
  if (invoice.paymentTerms) {
    doc.text(`Terms: ${invoice.paymentTerms}`, 150, y + 10);
  }
  
  y += 20;
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(cleanForPDF(invoice.clientBusinessName || invoice.clientName), margin, y);
  
  if (invoice.clientBusinessName) {
    y += 5;
    doc.text(`Attn: ${cleanForPDF(invoice.clientName)}`, margin, y);
  }
  if (invoice.clientEmail) {
    y += 5;
    doc.text(cleanForPDF(invoice.clientEmail), margin, y);
  }
  if (invoice.clientPhone) {
    y += 5;
    doc.text(cleanForPDF(invoice.clientPhone), margin, y);
  }
  
  y += 15;

  if (invoice.introduction) {
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const splitIntro = doc.splitTextToSize(cleanForPDF(invoice.introduction), 180);
    doc.text(splitIntro, margin, y);
    y += (splitIntro.length * 5) + 10;
  }
  
  // Items Table
  const tableData = invoice.items.map(item => {
    const itemName = item.name || (item as any).description || 'Item';
    const itemDesc = item.name ? item.description : '';
    
    return [
      { content: itemName, styles: { fontStyle: 'bold', fontSize: 10 } },
      item.quantity.toString(),
      `${invoice.currency} ${item.price.toLocaleString()}`,
      `${invoice.currency} ${(item.quantity * item.price).toLocaleString()}`
    ];
  });

  // Add descriptions as separate rows or handle them in the same cell with different styles
  // jsPDF-autotable doesn't easily support multiple styles in one cell without complex hooks.
  // A better way is to use the 'didDrawCell' hook or just format the string.
  // Let's try the string format first but with a clear visual distinction if possible.
  // Actually, we can use an array of strings for the cell content, but styles apply to the whole cell.
  // Let's use the 'body' with descriptions as separate rows if they exist, or just use a custom draw.
  
  const formattedTableData: any[] = [];
  invoice.items.forEach(item => {
    const itemName = item.name || (item as any).description || 'Item';
    formattedTableData.push([
      itemName,
      item.quantity.toString(),
      `${invoice.currency} ${item.price.toLocaleString()}`,
      `${invoice.currency} ${(item.quantity * item.price).toLocaleString()}`
    ]);
    if (item.name && item.description) {
      formattedTableData.push([
        { content: item.description, colSpan: 1, styles: { fontSize: 8, textColor: [100, 116, 139], fontStyle: 'italic' } },
        '', '', ''
      ]);
    }
  });

  autoTable(doc, {
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: formattedTableData,
    startY: y,
    theme: 'grid',
    headStyles: { fillColor: brandColorRgb, textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { textColor: [51, 65, 85], fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Totals
  const totalX = 140;
  const valueX = 180;
  
  const subtotalVal = invoice.subtotal || invoice.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  const discountAmt = Math.max(0, subtotalVal - invoice.amount);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Subtotal:', totalX, y);
  doc.text(`${invoice.currency} ${subtotalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valueX, y, { align: 'right' });
  
  if (discountAmt > 0) {
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38); // red
    const pctDesc = invoice.discountType === 'percentage' ? ` (${invoice.discountValue}%)` : '';
    doc.text(`Discount${pctDesc}:`, totalX, y);
    doc.text(`-${invoice.currency} ${discountAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valueX, y, { align: 'right' });
  }

  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalX, y);
  doc.text(`${invoice.currency} ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valueX, y, { align: 'right' });
  
  if (invoice.paidAmount && invoice.paidAmount > 0) {
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text('Amount Paid:', totalX, y);
    doc.text(`${invoice.currency} ${invoice.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valueX, y, { align: 'right' });
    
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE DUE:', totalX, y);
    doc.text(`${invoice.currency} ${(invoice.amount - invoice.paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valueX, y, { align: 'right' });
  }

  // Notes / Terms of Payment
  if (invoice.notes) {
    y += 15;
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, 210 - margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES / TERMS OF PAYMENT', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(cleanForPDF(invoice.notes), 180);
    doc.text(splitNotes, margin, y);
    y += (splitNotes.length * 5) + 5;
  }

  // Payment Information
  y += 15;
  if (y > 230) { doc.addPage(); y = 20; }
  
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, 210 - margin, y);
  y += 10;
  
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT INFORMATION', margin, y);
  y += 8;
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text('Please make payment via any of the following platforms:', margin, y);
  y += 8;
  
  if (workspace.paymentMethods && workspace.paymentMethods.length > 0) {
    workspace.paymentMethods.forEach(method => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${method.type === 'Online' ? 'Online Link' : method.type}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      const branchInfo = method.branch ? ` (${method.branch})` : '';
      doc.text(`${method.provider}${branchInfo} (${method.accountName}) - Account: ${method.accountNumber}`, margin + 35, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
  } else {
    if (workspace.bankName && workspace.accountNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text('Bank Transfer:', margin, y);
      doc.setFont('helvetica', 'normal');
      const branchInfo = workspace.bankBranch ? ` (${workspace.bankBranch})` : '';
      doc.text(`${workspace.bankName}${branchInfo} - Account: ${workspace.accountNumber}`, margin + 35, y);
      y += 6;
    }

    if (workspace.mobileMoneyProvider && workspace.mobileMoneyNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text('Mobile Money:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${workspace.mobileMoneyProvider} - Number: ${workspace.mobileMoneyNumber}`, margin + 35, y);
      y += 6;
    }
  }

  if (workspace.onlinePaymentUrl) {
    y += 4;
    // Draw "Pay Now" Button
    const btnWidth = 40;
    const btnHeight = 10;
    doc.setFillColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
    doc.roundedRect(margin, y, btnWidth, btnHeight, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PAY NOW', margin + (btnWidth / 2), y + (btnHeight / 2) + 1.5, { align: 'center' });
    
    // Add link to the button area
    doc.link(margin, y, btnWidth, btnHeight, { url: workspace.onlinePaymentUrl });
    
    y += btnHeight + 6;
    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.text(`Or use this link: ${workspace.onlinePaymentUrl}`, margin, y);
    y += 6;
  } else {
    doc.text('• Online Payment: Visit our portal at [Your Portal URL]', margin, y);
    y += 6;
  }

  y += 15;
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for your business!', 105, y, { align: 'center' });

  const safeClient = invoice.clientName.replace(/[^a-z0-9]/gi, '_').slice(0, 30);
  doc.save(`Invoice_${invoice.id.slice(-6).toUpperCase()}_${safeClient}.pdf`);
}

export async function generateReceiptPDF(invoice: Invoice, workspace: Workspace) {
  const doc = new jsPDF();
  const margin = 14;
  let y = 20;
  const brandColorRgb = hexToRgb(workspace.brandColor || '#10b981'); // Default Emerald for receipts

  // --- HEADER SECTION ---
  const logoData = workspace.logoUrl ? await loadImage(workspace.logoUrl) : null;
  
  if (logoData) {
    doc.addImage(logoData, 'PNG', 160, y - 10, 25, 25);
  }

  doc.setFontSize(24);
  doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIPT', margin, y);
  
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.setFont('helvetica', 'bold');
  doc.text(cleanForPDF(workspace.name), margin, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  y += 5;
  if (workspace.businessAddress) { doc.text(cleanForPDF(workspace.businessAddress), margin, y); y += 5; }
  if (workspace.businessEmail) { doc.text(cleanForPDF(workspace.businessEmail), margin, y); y += 5; }
  
  y += 10;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.line(margin, y, 210 - margin, y);
  y += 15;

  // --- RECEIPT DETAILS ---
  const detailsY = y;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIVED FROM:', margin, y);
  
  doc.text('RECEIPT DETAILS:', 110, y);
  
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.clientBusinessName || invoice.clientName, margin, y);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  if (invoice.clientBusinessName) {
    y += 5;
    doc.text(`Attn: ${invoice.clientName}`, margin, y);
  }
  
  // Right side details
  let rightY = detailsY + 7;
  doc.text(`Receipt #: REC-${invoice.id.slice(-6).toUpperCase()}-${Math.floor(Math.random() * 1000)}`, 110, rightY);
  rightY += 5;
  const paymentDateStr = (() => {
    try {
      return format(parseISO(invoice.updatedAt), 'MMMM d, yyyy');
    } catch (e) {
      return format(new Date(), 'MMMM d, yyyy');
    }
  })();
  doc.text(`Date: ${paymentDateStr}`, 110, rightY);
  rightY += 5;
  doc.text(`Payment for Invoice: #${invoice.id.slice(-6).toUpperCase()}`, 110, rightY);
  rightY += 5;

  y = Math.max(y, rightY) + 15;

  // --- INTRODUCTION/DESCRIPTION ---
  if (invoice.introduction) {
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const splitIntro = doc.splitTextToSize(invoice.introduction, 180);
    doc.text(splitIntro, margin, y);
    y += (splitIntro.length * 5) + 10;
  }

  // --- ITEMS SUMMARY ---
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT SUMMARY', margin, y);
  y += 6;

  const formattedTableData: any[] = [];
  invoice.items.forEach(item => {
    const itemName = item.name || (item as any).description || 'Item';
    formattedTableData.push([
      itemName,
      item.quantity.toString(),
      `${invoice.currency} ${item.price.toLocaleString()}`,
      `${invoice.currency} ${(item.quantity * item.price).toLocaleString()}`
    ]);
    if (item.name && item.description) {
      formattedTableData.push([
        { content: item.description, colSpan: 1, styles: { fontSize: 8, textColor: [100, 116, 139], fontStyle: 'italic' } },
        '', '', ''
      ]);
    }
  });

  autoTable(doc, {
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: formattedTableData,
    startY: y,
    theme: 'striped',
    headStyles: { fillColor: brandColorRgb, textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { textColor: [51, 65, 85], fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // --- AMOUNT HIGHLIGHT ---
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, 182, 45, 3, 3, 'FD');
  
  y += 12;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text('ORIGINAL INVOICE TOTAL:', margin + 10, y);
  doc.text(`${invoice.currency} ${invoice.amount.toLocaleString()}`, margin + 172, y, { align: 'right' });

  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL AMOUNT PAID', margin + 10, y);
  
  const paidAmount = invoice.paidAmount || 0;
  const balance = Number((invoice.amount - paidAmount).toFixed(2));
  
  doc.setFontSize(22);
  doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`${invoice.currency} ${paidAmount.toLocaleString()}`, 85, y + 2);
  
  if (balance > 0) {
    y += 12;
    doc.setFontSize(10);
    doc.setTextColor(225, 29, 72); // Rose-600
    doc.setFont('helvetica', 'bold');
    doc.text(`BALANCE REMAINING: ${invoice.currency} ${balance.toLocaleString()}`, margin + 10, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setFont('helvetica', 'normal');
    doc.text('Status: PARTIAL PAYMENT', margin + 10, y);
  } else {
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setFont('helvetica', 'normal');
    doc.text('Status: FULLY PAID', margin + 10, y);
  }

  // --- STAMP ---
  if (balance <= 0) {
    doc.setDrawColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
    doc.setLineWidth(1);
    doc.roundedRect(155, y - 15, 30, 12, 2, 2, 'S');
    doc.setFontSize(12);
    doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID', 170, y - 6.5, { align: 'center' });
  } else {
    doc.setDrawColor(225, 29, 72);
    doc.setLineWidth(1);
    doc.roundedRect(155, y - 15, 30, 12, 2, 2, 'S');
    doc.setFontSize(10);
    doc.setTextColor(225, 29, 72);
    doc.setFont('helvetica', 'bold');
    doc.text('PARTIAL', 170, y - 6.5, { align: 'center' });
  }

  // --- FOOTER ---
  y += 40;
  if (y > 270) { doc.addPage(); y = 20; }
  
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for choosing ' + workspace.name, 105, y, { align: 'center' });
  
  y += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('This is an electronically generated receipt and does not require a signature.', 105, y, { align: 'center' });

  doc.save(`receipt_INV-${invoice.id.slice(-6).toUpperCase()}.pdf`);
}

export async function generateStaffReceiptPDF(receipt: StaffReceipt, workspace: Workspace) {
  const doc = new jsPDF();
  const margin = 14;
  let y = 20;
  const brandColorRgb = hexToRgb(workspace.brandColor || '#4f46e5'); // Default Indigo for staff receipts

  // --- HEADER SECTION ---
  const logoData = workspace.logoUrl ? await loadImage(workspace.logoUrl) : null;
  
  if (logoData) {
    doc.addImage(logoData, 'PNG', 160, y - 10, 25, 25);
  }

  doc.setFontSize(22);
  doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', margin, y);
  
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.setFont('helvetica', 'bold');
  doc.text(cleanForPDF(workspace.name), margin, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  y += 5;
  if (workspace.businessAddress) { doc.text(cleanForPDF(workspace.businessAddress), margin, y); y += 5; }
  if (workspace.businessEmail) { doc.text(cleanForPDF(workspace.businessEmail), margin, y); y += 5; }
  
  y += 10;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.line(margin, y, 210 - margin, y);
  y += 15;

  // --- RECIPIENT & DETAILS ---
  const detailsY = y;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID TO / RECIPIENT:', margin, y);
  
  doc.text('PAYMENT DETAILS:', 110, y);
  
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFont('helvetica', 'bold');
  doc.text(receipt.recipientName, margin, y);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  if (receipt.recipientRole) {
    y += 5;
    doc.text(`Role: ${receipt.recipientRole}`, margin, y);
  }
  if (receipt.recipientEmail) {
    y += 5;
    doc.text(`Email: ${receipt.recipientEmail}`, margin, y);
  }
  
  // Right side details
  let rightY = detailsY + 7;
  doc.text(`Receipt #: REC-STF-${receipt.id.slice(-6).toUpperCase()}`, 110, rightY);
  rightY += 5;
  const paymentDateStr = (() => {
    try {
      return format(parseISO(receipt.date), 'MMMM d, yyyy');
    } catch (e) {
      return receipt.date || format(new Date(), 'MMMM d, yyyy');
    }
  })();
  doc.text(`Payment Date: ${paymentDateStr}`, 110, rightY);
  rightY += 5;
  doc.text(`Payment Method: ${receipt.paymentMethod}`, 110, rightY);
  if (receipt.referenceNumber) {
    rightY += 5;
    doc.text(`Reference: ${receipt.referenceNumber}`, 110, rightY);
  }

  y = Math.max(y, rightY) + 15;

  // --- DESCRIPTION / PURPOSE ---
  if (receipt.title) {
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text(`PURPOSE: ${receipt.title}`, margin, y);
    y += 10;
  }

  // --- ITEMS SUMMARY ---
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('DISBURSEMENT BREAKDOWN', margin, y);
  y += 6;

  const tableData = receipt.items.map(item => [
    item.description,
    `${receipt.currency} ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  autoTable(doc, {
    head: [['Description', 'Amount']],
    body: tableData,
    startY: y,
    theme: 'striped',
    headStyles: { fillColor: brandColorRgb, textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { textColor: [51, 65, 85], fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // --- TOTAL DISPLAY ---
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, 182, 30, 3, 3, 'FD');
  
  y += 12;
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL AMOUNT PAID', margin + 10, y);
  
  doc.setFontSize(20);
  doc.setTextColor(brandColorRgb[0], brandColorRgb[1], brandColorRgb[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`${receipt.currency} ${receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 120, y + 2);

  y += 25;

  // --- NOTES ---
  if (receipt.notes) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(receipt.notes, 180);
    doc.text(splitNotes, margin, y);
    y += (splitNotes.length * 5) + 10;
  }

  // --- FOOTER ---
  y += 15;
  if (y > 270) { doc.addPage(); y = 20; }
  
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for your service to ' + workspace.name, 105, y, { align: 'center' });
  
  y += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('This is an electronically issued payment receipt for staff and personnel records.', 105, y, { align: 'center' });

  doc.save(`receipt_STF-${receipt.id.slice(-6).toUpperCase()}.pdf`);
}
