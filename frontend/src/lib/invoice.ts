import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sale, Client, Product } from '@/types';

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

export async function generateInvoice(
  sale: Sale,
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
      // skip logo if it fails
    }
  }

  // --- Company info (right aligned) ---
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

  // --- Invoice title ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA DE VENTA', 14, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const shortId = sale.id.split('-')[0].toUpperCase();
  doc.text(`No. ${shortId}`, pageWidth - 14, y, { align: 'right' });
  y += 10;

  // --- Sale & Client info ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.date, 40, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', pageWidth / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.status === 'paid' ? 'Pagada' : 'Pendiente', pageWidth / 2 + 22, y);
  y += 7;

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
  const tableData = sale.items.map((item, idx) => {
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
  doc.text(formatMoney(sale.subtotal), totalsX, y, { align: 'right' });
  y += 6;

  doc.text('IVA:', totalsX - 45, y);
  doc.text(formatMoney(sale.tax), totalsX, y, { align: 'right' });
  y += 7;

  doc.setDrawColor(41, 65, 122);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 65, y - 2, totalsX, y - 2);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalsX - 45, y + 3);
  doc.text(formatMoney(sale.total), totalsX, y + 3, { align: 'right' });
  y += 14;

  // --- Payment info ---
  const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Credito' };
  const methodLabel: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
  };

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tipo de pago: ${paymentLabel[sale.payment_type] || sale.payment_type}`, 14, y);
  if (sale.payment_method) {
    doc.text(`Medio de pago: ${methodLabel[sale.payment_method] || sale.payment_method}`, 14, y + 5);
    y += 5;
  }
  y += 5;

  if (sale.notes) {
    doc.text(`Notas: ${sale.notes}`, 14, y);
    y += 5;
  }

  // --- Footer ---
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text('Gracias por su compra', pageWidth / 2, y, { align: 'center' });
  doc.text(
    `Generada el ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}`,
    pageWidth / 2,
    y + 4,
    { align: 'center' },
  );

  // --- Download ---
  doc.save(`factura-${shortId}-${sale.date}.pdf`);
}
