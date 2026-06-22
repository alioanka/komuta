import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller.js';
import { OutletsController } from './outlets.controller.js';

@Module({ controllers: [CompaniesController, OutletsController] })
export class OrgModule {}
