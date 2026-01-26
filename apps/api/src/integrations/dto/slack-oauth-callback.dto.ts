import { IsString, IsOptional } from 'class-validator';

export class SlackOAuthCallbackDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}
