import { Module } from '@nestjs/common';
import { RevenueController } from './revenue.controller.js';

@Module({ controllers: [RevenueController] })
export class RevenueModule {}
