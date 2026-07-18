import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { CommentsGateway } from './comments.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsGateway],
  exports: [CommentsService],
})
export class CommentsModule {}
