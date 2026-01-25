import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * エラーレスポンスの型定義
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * グローバル例外フィルター
 * すべての例外をキャッチして統一されたエラーレスポンスを返す
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: '予期しないエラーが発生しました',
      },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorResponse = {
          error: {
            code: this.getErrorCode(status),
            message: exceptionResponse,
          },
        };
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        errorResponse = {
          error: {
            code: this.getErrorCode(status),
            message: (res.message as string) || 'エラーが発生しました',
            details: res.errors || res.details,
          },
        };
      }
    }

    // デバッグ用のエラーログ
    console.error('エラー:', exception);

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
