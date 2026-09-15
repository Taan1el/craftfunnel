import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service.js';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  list = (_req: Request, res: Response, next: NextFunction) => {
    try {
      const customers = this.customerService.listCustomers();
      res.json({ success: true, data: customers });
    } catch (err) {
      next(err);
    }
  };

  getById = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const customer = this.customerService.getCustomer(id);
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }
      res.json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  };

  getTimeline = (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const timeline = this.customerService.getTimeline(id);
      if (!timeline) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }
      res.json({ success: true, data: timeline });
    } catch (err) {
      next(err);
    }
  };
}
