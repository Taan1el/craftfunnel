import { CustomerRepository } from '../repositories/customer.repository.js';
import { Customer } from '../../../shared/types.js';

export class CustomerService {
  constructor(private customerRepo: CustomerRepository) {}

  listCustomers(): Customer[] {
    return this.customerRepo.listCustomers();
  }

  getCustomer(id: string): Customer | null {
    return this.customerRepo.getCustomerById(id);
  }

  getTimeline(id: string) {
    const customer = this.customerRepo.getCustomerById(id);
    if (!customer) return null;
    return this.customerRepo.getCustomerTimeline(id);
  }
}
