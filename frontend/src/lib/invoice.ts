import jsPDF from 'jspdf';
import type { Sale, Client, Product } from '@/types';

interface CompanyInfo {
  name: string;
  nit: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
}

const PAPER_W = 80;
const MARGIN = 2;
const CONTENT_W = PAPER_W - MARGIN * 2; // 76 mm area util
const SLOGAN = 'Calidad y buen servicio';

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

function bogotaNowFormatted(): string {
  const fmt = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return fmt.format(new Date());
}

/** Dibuja todo el contenido en `doc` empezando en MARGIN y devuelve la Y final. */
function renderInvoice(
  doc: jsPDF,
  sale: Sale,
  client: Client | undefined,
  productMap: Map<string, Product>,
  company: CompanyInfo | null,
  logoImg: HTMLImageElement | null,
): number {
  let y = MARGIN;

  // --- Logo ---
  if (logoImg) {
    const maxH = 14;
    const ratio = logoImg.width / logoImg.height;
    const w = Math.min(CONTENT_W, maxH * ratio);
    const h = w / ratio;
    doc.addImage(logoImg, 'PNG', (PAPER_W - w) / 2, y, w, h);
    y += h + 1;
  }

  // --- Empresa ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(company?.name || 'La Montana', PAPER_W / 2, y + 3, { align: 'center' });
  y += 7;

  // Slogan
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text(SLOGAN, PAPER_W / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (company?.nit) { doc.text(`NIT: ${company.nit}`, PAPER_W / 2, y, { align: 'center' }); y += 3; }
  if (company?.phone) { doc.text(`Tel: ${company.phone}`, PAPER_W / 2, y, { align: 'center' }); y += 3; }
  if (company?.address) {
    const lines = doc.splitTextToSize(company.address, CONTENT_W) as string[];
    for (const line of lines) { doc.text(line, PAPER_W / 2, y, { align: 'center' }); y += 3; }
  }

  // --- Separador ---
  y += 1;
  doc.setDrawColor(0);
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(MARGIN, y, PAPER_W - MARGIN, y);
  doc.setLineDashPattern([], 0);
  y += 3;

  // --- Titulo + numero ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FACTURA DE VENTA', PAPER_W / 2, y, { align: 'center' });
  y += 3.5;
  const shortId = sale.id.split('-')[0].toUpperCase();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`No. ${shortId}`, PAPER_W / 2, y, { align: 'center' });
  y += 4;

  // --- Venta y cliente ---
  doc.setFontSize(7.5);
  const labelW = 15;
  const writeRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, CONTENT_W - labelW) as string[];
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], MARGIN + labelW, y + i * 3);
    }
    y += Math.max(3, lines.length * 3);
  };

  writeRow('Fecha:', sale.date);
  writeRow('Estado:', sale.status === 'paid' ? 'Pagada' : 'Pendiente');
  writeRow('Cliente:', client?.name || '-');
  if (client?.cedula_nit) writeRow('NIT/CC:', client.cedula_nit);
  if (client?.phone) writeRow('Tel:', client.phone);
  if (client?.address) writeRow('Dir:', client.address);

  // --- Separador ---
  y += 1.5;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(MARGIN, y, PAPER_W - MARGIN, y);
  doc.setLineDashPattern([], 0);
  y += 3;

  // --- Encabezado de items ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PRODUCTO', MARGIN, y);
  doc.text('TOTAL', PAPER_W - MARGIN, y, { align: 'right' });
  y += 1.5;
  doc.setLineDashPattern([0.3, 0.3], 0);
  doc.line(MARGIN, y, PAPER_W - MARGIN, y);
  doc.setLineDashPattern([], 0);
  y += 3;

  // --- Items ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  for (const item of sale.items) {
    const product = productMap.get(item.product_id);
    const name = product?.name || '-';
    const nameLines = doc.splitTextToSize(name, CONTENT_W) as string[];
    for (const ln of nameLines) {
      doc.text(ln, MARGIN, y);
      y += 3;
    }
    doc.setFontSize(7);
    const detail = `${item.quantity} x ${formatMoney(item.unit_price)}`;
    doc.text(detail, MARGIN, y);
    doc.text(formatMoney(item.subtotal), PAPER_W - MARGIN, y, { align: 'right' });
    doc.setFontSize(7.5);
    y += 3.5;
  }

  // --- Separador ---
  y += 0.5;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(MARGIN, y, PAPER_W - MARGIN, y);
  doc.setLineDashPattern([], 0);
  y += 3;

  // --- Totales ---
  const writeTotal = (label: string, value: string, bold = false, big = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(big ? 10 : 8);
    doc.text(label, MARGIN, y);
    doc.text(value, PAPER_W - MARGIN, y, { align: 'right' });
    y += big ? 5 : 3.5;
  };

  writeTotal('Subtotal:', formatMoney(sale.subtotal));
  writeTotal('IVA:', formatMoney(sale.tax));
  y += 0.5;
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAPER_W - MARGIN, y);
  y += 3.5;
  writeTotal('TOTAL:', formatMoney(sale.total), true, true);

  // --- Info de pago ---
  y += 1;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Credito' };
  const methodLabel: Record<string, string> = {
    cash: 'Efectivo', transfer: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata',
  };
  doc.text(`Tipo de pago: ${paymentLabel[sale.payment_type] || sale.payment_type}`, MARGIN, y);
  y += 3;
  if (sale.payment_method) {
    doc.text(`Medio: ${methodLabel[sale.payment_method] || sale.payment_method}`, MARGIN, y);
    y += 3;
  }

  if (sale.notes) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.text('Notas:', MARGIN, y);
    y += 3;
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(sale.notes, CONTENT_W) as string[];
    for (const ln of noteLines) { doc.text(ln, MARGIN, y); y += 3; }
  }

  // --- Pie ---
  y += 3;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(MARGIN, y, PAPER_W - MARGIN, y);
  doc.setLineDashPattern([], 0);
  y += 3;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Gracias por su compra', PAPER_W / 2, y, { align: 'center' });
  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Generada ${bogotaNowFormatted()}`, PAPER_W / 2, y, { align: 'center' });
  y += 4;

  return y;
}

export async function generateInvoicePdf(
  sale: Sale,
  client: Client | undefined,
  productMap: Map<string, Product>,
  company: CompanyInfo | null,
) {
  let logoImg: HTMLImageElement | null = null;
  if (company?.logo_url) {
    try { logoImg = await loadImage(company.logo_url); } catch { /* skip */ }
  }

  const measure = new jsPDF({ unit: 'mm', format: [PAPER_W, 500], orientation: 'portrait' });
  const finalY = renderInvoice(measure, sale, client, productMap, company, logoImg);

  const height = Math.max(60, Math.ceil(finalY) + MARGIN);
  const doc = new jsPDF({ unit: 'mm', format: [PAPER_W, height], orientation: 'portrait' });
  renderInvoice(doc, sale, client, productMap, company, logoImg);

  const shortId = sale.id.split('-')[0].toUpperCase();
  doc.save(`factura-${shortId}-${sale.date}.pdf`);
}

/** Alias compatible con código existente. */
export const generateInvoice = generateInvoicePdf;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c] as string);
}

function buildInvoiceHtml(
  sale: Sale,
  client: Client | undefined,
  productMap: Map<string, Product>,
  company: CompanyInfo | null,
): string {
  const shortId = sale.id.split('-')[0].toUpperCase();
  const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Credito' };
  const methodLabel: Record<string, string> = {
    cash: 'Efectivo', transfer: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata',
  };

  const itemsHtml = sale.items.map(item => {
    const product = productMap.get(item.product_id);
    const name = escapeHtml(product?.name || '-');
    return `
      <div class="item">
        <div class="item-name">${name}</div>
        <div class="item-row">
          <span>${item.quantity} x ${formatMoney(item.unit_price)}</span>
          <span class="right">${formatMoney(item.subtotal)}</span>
        </div>
      </div>`;
  }).join('');

  const clientRowsArr: Array<[string, string]> = [
    ['Fecha', sale.date],
    ['Estado', sale.status === 'paid' ? 'Pagada' : 'Pendiente'],
    ['Cliente', client?.name || '-'],
  ];
  if (client?.cedula_nit) clientRowsArr.push(['NIT/CC', client.cedula_nit]);
  if (client?.phone) clientRowsArr.push(['Tel', client.phone]);
  if (client?.address) clientRowsArr.push(['Dir', client.address]);
  const clientRows = clientRowsArr
    .map(([k, v]) => `<div class="kv"><span class="k">${k}:</span><span class="v">${escapeHtml(v)}</span></div>`)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Factura ${shortId}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 76mm; margin: 0 auto;
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 11px; line-height: 1.3; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .small { font-size: 10px; }
  .hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  .hr-solid { border: 0; border-top: 1px solid #000; margin: 4px 0; }
  .logo { display: block; max-height: 18mm; max-width: 100%; margin: 0 auto 2px; }
  .company-name { font-size: 13px; font-weight: bold; margin-top: 2px; }
  .slogan { font-size: 10px; font-style: italic; margin-top: 2px; margin-bottom: 2px; }
  .title { font-size: 12px; font-weight: bold; margin-top: 2px; }
  .docnum { font-size: 10px; margin-bottom: 2px; }
  .kv { display: flex; gap: 4px; font-size: 11px; }
  .kv .k { font-weight: bold; min-width: 14mm; }
  .kv .v { flex: 1; word-break: break-word; }
  .items-head { display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; }
  .item { margin-bottom: 2px; }
  .item-name { word-break: break-word; }
  .item-row { display: flex; justify-content: space-between; font-size: 10px; }
  .total-row { display: flex; justify-content: space-between; font-size: 11px; }
  .total-final { font-size: 14px; font-weight: bold; margin-top: 2px; }
  .footer { text-align: center; margin-top: 4px; }
  .footer .thanks { font-weight: bold; font-size: 11px; }
  .footer .gen { font-size: 9px; margin-top: 2px; }
  @media print { body { width: auto; } }
</style>
</head>
<body>
  ${company?.logo_url ? `<img class="logo center" src="${escapeHtml(company.logo_url)}" alt="logo" />` : ''}
  <div class="center company-name">${escapeHtml(company?.name || 'La Montana')}</div>
  <div class="center slogan">${SLOGAN}</div>
  ${company?.nit ? `<div class="center small">NIT: ${escapeHtml(company.nit)}</div>` : ''}
  ${company?.phone ? `<div class="center small">Tel: ${escapeHtml(company.phone)}</div>` : ''}
  ${company?.address ? `<div class="center small">${escapeHtml(company.address)}</div>` : ''}
  <hr class="hr" />
  <div class="center title">FACTURA DE VENTA</div>
  <div class="center docnum">No. ${shortId}</div>
  ${clientRows}
  <hr class="hr" />
  <div class="items-head"><span>PRODUCTO</span><span>TOTAL</span></div>
  <hr class="hr" />
  ${itemsHtml}
  <hr class="hr" />
  <div class="total-row"><span>Subtotal:</span><span>${formatMoney(sale.subtotal)}</span></div>
  <div class="total-row"><span>IVA:</span><span>${formatMoney(sale.tax)}</span></div>
  <hr class="hr-solid" />
  <div class="total-row total-final"><span>TOTAL:</span><span>${formatMoney(sale.total)}</span></div>
  <div class="small" style="margin-top:4px">Tipo de pago: ${paymentLabel[sale.payment_type] || sale.payment_type}</div>
  ${sale.payment_method ? `<div class="small">Medio: ${methodLabel[sale.payment_method] || sale.payment_method}</div>` : ''}
  ${sale.notes ? `<div class="small" style="margin-top:4px"><span class="bold">Notas:</span> ${escapeHtml(sale.notes)}</div>` : ''}
  <hr class="hr" />
  <div class="footer">
    <div class="thanks">Gracias por su compra</div>
    <div class="gen">Generada ${bogotaNowFormatted()}</div>
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 300);
    });
  </script>
</body>
</html>`;
}

export async function generateInvoiceHtml(
  sale: Sale,
  client: Client | undefined,
  productMap: Map<string, Product>,
  company: CompanyInfo | null,
) {
  const html = buildInvoiceHtml(sale, client, productMap, company);
  const win = window.open('', '_blank', 'width=420,height=720');
  if (!win) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const shortId = sale.id.split('-')[0].toUpperCase();
    const a = document.createElement('a');
    a.href = url;
    a.download = `factura-${shortId}-${sale.date}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
