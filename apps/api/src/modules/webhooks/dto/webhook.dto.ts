import { IsString, IsOptional, IsArray, IsNumber, IsEnum } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  spreadsheetId: string;

  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsNumber()
  maxRetries?: number;

  @IsOptional()
  @IsString()
  retryBackoff?: 'linear' | 'exponential';
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsNumber()
  maxRetries?: number;

  @IsOptional()
  @IsString()
  retryBackoff?: string;

  @IsOptional()
  active?: boolean;
}
