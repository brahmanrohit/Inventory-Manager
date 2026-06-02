"""PDF invoice generation using reportlab."""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.models import Order

PRIMARY = colors.HexColor("#3b5bfd")
MUTED = colors.HexColor("#6b7488")


def build_invoice_pdf(order: Order) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    left = 20 * mm
    right = width - 20 * mm
    y = height - 25 * mm

    # Header
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(left, y, "INVOICE")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 10)
    c.drawRightString(right, y, "Inventory & Order Management")
    c.drawRightString(right, y - 5 * mm, f"Invoice #{order.id}")
    y -= 16 * mm

    # Meta
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, y, "Bill To:")
    c.setFont("Helvetica", 11)
    customer = order.customer.full_name if order.customer else f"Customer {order.customer_id}"
    c.drawString(left, y - 6 * mm, customer)
    if order.customer and order.customer.email:
        c.drawString(left, y - 11 * mm, order.customer.email)

    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    c.drawRightString(right, y, f"Date: {order.created_at:%Y-%m-%d %H:%M}")
    c.drawRightString(right, y - 6 * mm, f"Status: {order.status.capitalize()}")
    y -= 22 * mm

    # Table header
    c.setFillColor(PRIMARY)
    c.rect(left, y, right - left, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left + 2 * mm, y + 2.3 * mm, "Product")
    c.drawRightString(right - 60 * mm, y + 2.3 * mm, "Qty")
    c.drawRightString(right - 30 * mm, y + 2.3 * mm, "Unit Price")
    c.drawRightString(right - 2 * mm, y + 2.3 * mm, "Subtotal")
    y -= 10 * mm

    # Rows
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    for it in order.items:
        name = it.product.name if it.product else f"Product {it.product_id}"
        subtotal = float(it.unit_price) * it.quantity
        c.drawString(left + 2 * mm, y, name[:48])
        c.drawRightString(right - 60 * mm, y, str(it.quantity))
        c.drawRightString(right - 30 * mm, y, f"${float(it.unit_price):.2f}")
        c.drawRightString(right - 2 * mm, y, f"${subtotal:.2f}")
        y -= 7 * mm
        if y < 30 * mm:  # simple page break
            c.showPage()
            y = height - 25 * mm

    # Total
    y -= 4 * mm
    c.setStrokeColor(MUTED)
    c.line(right - 70 * mm, y, right, y)
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(PRIMARY)
    c.drawRightString(right - 30 * mm, y, "TOTAL")
    c.drawRightString(right - 2 * mm, y, f"${float(order.total_amount):.2f}")

    # Footer
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawCentredString(width / 2, 18 * mm, "Thank you for your business!")

    c.showPage()
    c.save()
    return buf.getvalue()
