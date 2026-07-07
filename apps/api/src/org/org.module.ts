import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller.js';
import { OutletsController } from './outlets.controller.js';
import { EmployeesController } from './employees.controller.js';

@Module({ controllers: [CompaniesController, OutletsController, EmployeesController] })
export class OrgModule {}
