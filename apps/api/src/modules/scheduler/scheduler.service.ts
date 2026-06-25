import { Injectable, Logger } from '@nestjs/common';
import { MondayService } from '../monday/monday.service';

// Boards de controle a processar
const CONTROL_BOARDS = [
  '18405688011', // KNC
  '18405904114', // PP
];

const ADMISSION_DATE_COLUMN = 'date4';
const STATUS_COLUMN = 'status';
const STATUS_TRIGGER_INDEX = 0; // "Enviado para a coord."

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private monday: MondayService) {}

  async runMonthlyEvaluations(): Promise<{ triggered: number; details: any[] }> {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    this.logger.log(`Running monthly evaluations for month ${currentMonth}`);

    const details: any[] = [];
    let triggered = 0;

    for (const boardId of CONTROL_BOARDS) {
      const items = await this.monday.getAllItemsWithColumns(boardId, [
        ADMISSION_DATE_COLUMN,
        'email_mm4ef62',
        'email_mm4e9mg9',
      ]);

      for (const item of items) {
        const admissionColumn = item.column_values.find(
          (c: any) => c.id === ADMISSION_DATE_COLUMN,
        );

        if (!admissionColumn?.text) continue;

        // A data vem no formato YYYY-MM-DD
        const admissionDate = admissionColumn.text;
        const admissionMonth = parseInt(admissionDate.split('-')[1], 10);

        if (admissionMonth === currentMonth) {
          // Muda o status para disparar o webhook
          try {
            await this.monday.updateStatusColumn(
              boardId,
              item.id,
              STATUS_COLUMN,
              STATUS_TRIGGER_INDEX,
            );
            triggered++;
            details.push({
              board: boardId,
              item: item.name,
              admission: admissionDate,
              status: 'triggered',
            });
            this.logger.log(`Triggered evaluation for ${item.name} (admitted ${admissionDate})`);
          } catch (err) {
            this.logger.error(`Failed to trigger ${item.name}`, String(err));
            details.push({
              board: boardId,
              item: item.name,
              status: 'error',
              error: String(err),
            });
          }
        }
      }
    }

    this.logger.log(`Monthly run complete: ${triggered} evaluations triggered`);
    return { triggered, details };
  }
}