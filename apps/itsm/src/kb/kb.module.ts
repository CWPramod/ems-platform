import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KbController } from './kb.controller';
import { KbService } from './kb.service';
import { KbArticle } from './entities/kb-article.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KbArticle])],
  controllers: [KbController],
  providers: [KbService],
  exports: [KbService],
})
export class KbModule {}
