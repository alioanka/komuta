import { Module } from '@nestjs/common';
import { MappingsController } from './mappings.controller.js';

@Module({ controllers: [MappingsController] })
export class MappingsModule {}
