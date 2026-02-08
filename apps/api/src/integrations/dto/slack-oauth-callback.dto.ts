import { IsString } from 'class-validator';

export class SlackOAuthCallbackDto {
  @IsString()
  code: string;

  @IsString()
  state: string;
}
