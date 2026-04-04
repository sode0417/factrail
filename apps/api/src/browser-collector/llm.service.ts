import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { BrowsingSession } from './session-splitter.service';

export interface SessionSummary {
  title: string;
  summary: string | null;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: string;
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('LLM_PROVIDER') || 'claude-cli';
    this.ollamaUrl = this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    this.ollamaModel = this.configService.get<string>('OLLAMA_MODEL') || 'gemma2:2b';
  }

  /**
   * ブラウジングセッションを要約して title / summary を生成する
   */
  async summarizeSession(session: BrowsingSession): Promise<SessionSummary> {
    const prompt = this.buildPrompt(session);

    try {
      if (this.provider === 'ollama') {
        return await this.callOllama(prompt);
      }
      return await this.callClaudeCli(prompt);
    } catch (error) {
      this.logger.warn(`LLM による要約に失敗しました。フォールバックを使用します: ${error}`);
      return this.buildFallbackSummary(session);
    }
  }

  private buildPrompt(session: BrowsingSession): string {
    const urlList = session.visits
      .slice(0, 30) // 多すぎる場合は先頭30件に制限
      .map((v) => `- ${v.title || '(無題)'} | ${v.url}`)
      .join('\n');

    const searchInfo =
      session.searchQueries.length > 0 ? `検索クエリ: ${session.searchQueries.join(', ')}\n` : '';

    return `以下はブラウザの閲覧セッション（${session.durationMin}分間、${session.visitCount}件の訪問）です。
このセッションを簡潔に要約してください。

${searchInfo}ドメイン: ${session.domains.join(', ')}

訪問ページ:
${urlList}

以下の JSON 形式で出力してください（他のテキストは不要）:
{"title": "30文字以内の日本語タイトル", "summary": "1-2文の日本語サマリー"}`;
  }

  private async callClaudeCli(prompt: string): Promise<SessionSummary> {
    return new Promise((resolve, reject) => {
      const child = spawn('claude', ['-p', '--output-format', 'text'], {
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI エラー (code=${code}): ${stderr}`));
          return;
        }
        try {
          const result = this.parseJsonFromOutput(stdout);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Claude CLI 出力のパースに失敗: ${parseError}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Claude CLI 起動エラー: ${error.message}`));
      });

      // プロンプトを stdin で渡す（引数の長さ制限回避）
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private async callOllama(prompt: string): Promise<SessionSummary> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama API エラー: ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      return this.parseJsonFromOutput(data.response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * LLM 出力から JSON を抽出してパースする
   */
  private parseJsonFromOutput(output: string): SessionSummary {
    // JSON ブロックを抽出（```json ... ``` や生 JSON に対応）
    const jsonMatch =
      output.match(/```json\s*([\s\S]*?)```/) ||
      output.match(/(\{[\s\S]*"title"[\s\S]*"summary"[\s\S]*\})/);

    const jsonStr = jsonMatch ? jsonMatch[1].trim() : output.trim();
    const parsed = JSON.parse(jsonStr) as {
      title?: string;
      summary?: string;
    };

    if (!parsed.title) {
      throw new Error('title フィールドがありません');
    }

    return {
      title: parsed.title,
      summary: parsed.summary || null,
    };
  }

  /**
   * LLM が使えない場合のフォールバック
   */
  private buildFallbackSummary(session: BrowsingSession): SessionSummary {
    // 検索クエリがあればそれを使う
    if (session.searchQueries.length > 0) {
      return {
        title: `${session.searchQueries[0]} を調査`,
        summary: `検索クエリ: ${session.searchQueries.join(', ')}（${session.domains.length}サイト訪問）`,
      };
    }

    // なければ最もタイトルが長い訪問を使う
    const bestVisit = session.visits.reduce((best, v) =>
      v.title.length > best.title.length ? v : best,
    );

    return {
      title: bestVisit.title || session.domains[0] || 'ブラウジングセッション',
      summary: `${session.domains.join(', ')} を閲覧（${session.visitCount}ページ、${session.durationMin}分）`,
    };
  }
}
