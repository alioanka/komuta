import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller.js';

@Module({ controllers: [AccountingController] })
export class AccountingModule {}
