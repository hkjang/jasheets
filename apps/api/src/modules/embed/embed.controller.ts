import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Headers,
    UseGuards,
    Request,
} from '@nestjs/common';
import { EmbedService } from './embed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('embed')
export class EmbedController {
    constructor(private readonly embedService: EmbedService) { }

    /**
     * 공개 임베딩 엔드포인트 - 인증 불필요
     * GET /api/embed/:token
     */
    @Get(':token')
    getEmbeddedSheet(
        @Param('token') token: string,
        @Headers('referer') referer?: string,
    ) {
        return this.embedService.getEmbeddedSheet(token, referer);
    }
}

/**
 * 임베딩 설정 관리 컨트롤러 - 인증 필요
 */
@Controller('sheets')
@UseGuards(JwtAuthGuard)
export class EmbedConfigController {
    constructor(private readonly embedService: EmbedService) { }

    /**
     * 임베딩 설정 조회
     * GET /api/sheets/:id/embed
     */
    @Get(':id/embed')
    getEmbedConfig(@Request() req: any, @Param('id') id: string) {
        return this.embedService.getEmbedConfig(req.user.id, id);
    }

    /**
     * 임베딩 설정 생성/업데이트
     * POST /api/sheets/:id/embed
     */
    @Post(':id/embed')
    createOrUpdateEmbedConfig(
        @Request() req: any,
        @Param('id') id: string,
        @Body() body: {
            enabled?: boolean;
            showToolbar?: boolean;
            showTabs?: boolean;
            showGridlines?: boolean;
            allowedDomains?: string[];
        },
    ) {
        return this.embedService.createOrUpdateEmbedConfig(req.user.id, id, body);
    }

    /**
     * 임베딩 비활성화
     * DELETE /api/sheets/:id/embed
     */
    @Delete(':id/embed')
    deleteEmbedConfig(@Request() req: any, @Param('id') id: string) {
        return this.embedService.deleteEmbedConfig(req.user.id, id);
    }

    /**
     * 토큰 재생성
     * POST /api/sheets/:id/embed/regenerate
     */
    @Post(':id/embed/regenerate')
    regenerateToken(@Request() req: any, @Param('id') id: string) {
        return this.embedService.regenerateToken(req.user.id, id);
    }
}

