import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MondayService {
  private readonly logger = new Logger(MondayService.name);
  private readonly apiUrl: string;

  constructor(private config: ConfigService) {
    this.apiUrl = this.config.get<string>('monday.apiUrl')!;
  }

  private async query<T = unknown>(
    query: string,
    variables: Record<string, unknown> = {},
    token?: string,
  ): Promise<T> {
    const serviceToken = token ?? this.config.get<string>('monday.serviceToken')!;

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: serviceToken,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`Monday API HTTP error: ${res.status}`);
    }

    const json = (await res.json()) as { data?: T; errors?: unknown[] };

    if (json.errors?.length) {
      this.logger.error('Monday API errors', json.errors);
      throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`);
    }

    return json.data as T;
  }

  async getItem(boardId: string, itemId: string) {
    const data = await this.query<{
      items: {
        id: string;
        name: string;
        column_values: { id: string; text: string; value: string }[];
      }[];
    }>(
      `query ($itemId: [ID!]!) {
        items(ids: $itemId) {
          id
          name
          column_values {
            id
            text
            value
          }
        }
      }`,
      { itemId },
    );
    return data.items?.[0] ?? null;
  }

  async updateItemColumns(
    boardId: string,
    itemId: string,
    columnValues: Record<string, unknown>,
  ) {
    return this.query(
      `mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId,
          item_id: $itemId,
          column_values: $columnValues
        ) {
          id
        }
      }`,
      { boardId, itemId, columnValues: JSON.stringify(columnValues) },
    );
  }

  async uploadSignatureFile(
    itemId: string,
    columnId: string,
    pngBase64: string,
    fileName: string,
  ): Promise<string> {
    const query = `mutation ($file: File!) {
      add_file_to_column(
        item_id: ${itemId},
        column_id: "${columnId}",
        file: $file
      ) {
        id
      }
    }`;

    const boundary = '----VeepieFormsBoundary';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="query"`,
      '',
      query,
      `--${boundary}`,
      `Content-Disposition: form-data; name="variables[file]"; filename="${fileName}"`,
      'Content-Type: image/png',
      '',
      pngBuffer.toString('binary'),
      `--${boundary}--`,
    ].join('\r\n');

    const serviceToken = this.config.get<string>('monday.serviceToken')!;

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: serviceToken,
        'API-Version': '2024-01',
      },
      body,
    });

    const json = (await res.json()) as {
      data?: { add_file_to_column?: { id: string } };
    };
    return json.data?.add_file_to_column?.id ?? '';
  }

  async createNotification(userId: string, itemId: string, text: string) {
    return this.query(
      `mutation ($userId: ID!, $itemId: ID!, $text: String!) {
        create_notification(
          user_id: $userId,
          target_id: $itemId,
          text: $text,
          target_type: Project
        ) {
          text
        }
      }`,
      { userId, itemId, text },
    );
  }
}