import { Request, Response } from "express";
import { InvoiceService } from "../services/invoice.service";
import { InvoiceModel } from "../models/invoice.model";

const invoiceService = new InvoiceService();

export class InvoiceController {

  // GET /invoices/:bookingId
  // Compile + upsert, then show the invoice page
  async generateInvoice(req: Request, res: Response) {
    try {
      const hotelId   = (req as any).hotelId as number;
    // const hotelId = 1;
      const bookingId = parseInt(req.params.bookingId as any);

      const invoice = await invoiceService.generateInvoice(bookingId, hotelId);
      return res.status(200).render("invoices/invoice", { invoice });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  }

  // GET /invoices/:bookingId/download
  // Idempotent regenerate, then render the printable page
  async downloadInvoice(req: Request, res: Response) {
    try {
    const hotelId = parseInt(req.params.hotelId as any);
      const bookingId = parseInt(req.params.bookingId as any);
      const userId = Number((req as any).user?.userId);

      // a guest may only open invoices for their own bookings
      if (!(await InvoiceModel.isGuestBooking(bookingId, hotelId, userId))) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const invoice = await invoiceService.generateInvoice(bookingId, hotelId);
      return res.status(200).render("invoices/invoice", { invoice });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  }

}