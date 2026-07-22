import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { McpServerFactory } from './mcp-server.factory';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('mcp')
@UseGuards(JwtAuthGuard)
export class McpController {
  constructor(private readonly servers: McpServerFactory) {}

  @Post()
  async handle(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Body() body: unknown,
  ) {
    const server = this.servers.create(request.user.id);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, body);
    } finally {
      await server.close();
    }
  }
}
