import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '有効なメールアドレスを入力してください' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'パスワードは8文字以上である必要があります' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'パスワードは大文字、小文字、数字を含む必要があります',
  })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
