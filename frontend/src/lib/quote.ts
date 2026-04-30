import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quote, Client, Product } from '@/types';

interface CompanyInfo {
  name: string;
  nit: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
}

function formatMoney(val: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(val));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Expirada',
};

export async function generateQuote(
  quote: Quote,
  client: Client | undefined,
  productMap: Map<string, Product>,
  company: CompanyInfo | null,
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- Logo ---
  if (company?.logo_url) {
    try {
      const img = await loadImage(company.logo_url);
      const maxH = 22;
      const ratio = img.width / img.height;
      const w = maxH * ratio;
      doc.addImage(img, 'PNG', 14, y, w, maxH);
    } catch {
      // skip logo
    }
  }

  // --- Company info (right) ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const companyName = company?.name || 'La Montana';
  doc.text(companyName, pageWidth - 14, y + 6, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let infoY = y + 13;
  if (company?.nit) {
    doc.text(`NIT: ${company.nit}`, pageWidth - 14, infoY, { align: 'right' });
    infoY += 5;
  }
  if (company?.phone) {
    doc.text(`Tel: ${company.phone}`, pageWidth - 14, infoY, { align: 'right' });
    infoY += 5;
  }
  if (company?.address) {
    doc.text(company.address, pageWidth - 14, infoY, { align: 'right' });
    infoY += 5;
  }

  y = Math.max(y + 28, infoY + 4);

  // --- Separator ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // --- Title ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACION', 14, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const shortId = quote.id.split('-')[0].toUpperCase();
  doc.text(`No. ${shortId}`, pageWidth - 14, y, { align: 'right' });
  y += 10;

  // --- Quote info ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.date, 40, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Valida hasta:', pageWidth / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.valid_until, pageWidth / 2 + 30, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(statusLabel[quote.status] ?? quote.status, 40, y);
  y += 7;

  // --- Client info ---
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.name || '-', 40, y);
  y += 6;

  if (client?.cedula_nit) {
    doc.setFont('helvetica', 'bold');
    doc.text('NIT/CC:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(client.cedula_nit, 40, y);
    y += 6;
  }

  if (client?.phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tel:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(client.phone, 40, y);
    y += 6;
  }

  if (client?.address) {
    doc.setFont('helvetica', 'bold');
    doc.text('Dir:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(client.address, 40, y);
    y += 6;
  }

  y += 4;

  // --- Items table ---
  const tableData = quote.items.map((item, idx) => {
    const product = productMap.get(item.product_id);
    return [
      (idx + 1).toString(),
      product?.name || '-',
      item.quantity.toString(),
      formatMoney(item.unit_price),
      formatMoney(item.subtotal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 65, 122],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // --- Totals ---
  const totalsX = pageWidth - 14;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX - 45, y);
  doc.text(formatMoney(quote.subtotal), totalsX, y, { align: 'right' });
  y += 6;

  doc.text('IVA:', totalsX - 45, y);
  doc.text(formatMoney(quote.tax), totalsX, y, { align: 'right' });
  y += 7;

  doc.setDrawColor(41, 65, 122);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 65, y - 2, totalsX, y - 2);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalsX - 45, y + 3);
  doc.text(formatMoney(quote.total), totalsX, y + 3, { align: 'right' });
  y += 14;

  // --- Notes ---
  if (quote.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Notas: ${quote.notes}`, 14, y);
    y += 5;
  }

  // --- Disclaimer ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text(
    'Esta cotizacion no constituye una factura ni genera obligacion de pago.',
    14,
    y + 4,
  );
  doc.setTextColor(0);

  // --- Footer ---
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text('Gracias por su interes', pageWidth / 2, y, { align: 'center' });
  doc.text(
    `Generada el ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}`,
    pageWidth / 2,
    y + 4,
    { align: 'center' },
  );

  doc.save(`cotizacion-${shortId}-${quote.date}.pdf`);
}
