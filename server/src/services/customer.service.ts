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
    return this.customerRepo.getCustomerTimeline(id);
  }

  createCustomer(name: string, email: string): Customer {
    return this.customerRepo.createCustomer(name, email);
  }
}
