import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  TransactionLogService,
  TransactionLogFilter,
  TransactionLogEntry,
  TransactionStats,
} from './transaction-log.service';

@Controller('transactions')
export class TransactionLogController {
  constructor(private readonly transactionLogService: TransactionLogService) {}

  /**
   * Obtiene una lista de transacciones con filtros opcionales
   * GET /api/transactions?status=SUCCESS&limit=50&offset=0
   */
  @Get()
  async getTransactions(
    @Query('status') status?: string,
    @Query('operationType') operationType?: string,
    @Query('phoneNumber') phoneNumber?: string,
    @Query('transactionId') transactionId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    data: TransactionLogEntry[];
    pagination: {
      limit: number;
      offset: number;
      total?: number;
    };
  }> {
    try {
      const filter: TransactionLogFilter = {};

      // Validar y asignar filtros
      if (status) {
        const validStatuses = [
          'PENDING',
          'SUCCESS',
          'FAILED',
          'CANCELLED',
          'REVERSED',
          'TIMEOUT',
        ];
        if (!validStatuses.includes(status)) {
          throw new BadRequestException(
            `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          );
        }
        filter.status = status;
      }

      if (operationType) {
        const validOperations = [
          'SEND_PUSH',
          'CANCEL_PUSH',
          'GET_STATUS',
          'REVERSE',
        ];
        if (!validOperations.includes(operationType)) {
          throw new BadRequestException(
            `Invalid operation type. Must be one of: ${validOperations.join(
              ', ',
            )}`,
          );
        }
        filter.operationType = operationType;
      }

      if (phoneNumber) {
        filter.phoneNumber = phoneNumber;
      }

      if (transactionId) {
        filter.transactionId = transactionId;
      }

      if (dateFrom) {
        const parsedDateFrom = new Date(dateFrom);
        if (isNaN(parsedDateFrom.getTime())) {
          throw new BadRequestException(
            'Invalid dateFrom format. Use ISO 8601 format.',
          );
        }
        filter.dateFrom = parsedDateFrom;
      }

      if (dateTo) {
        const parsedDateTo = new Date(dateTo);
        if (isNaN(parsedDateTo.getTime())) {
          throw new BadRequestException(
            'Invalid dateTo format. Use ISO 8601 format.',
          );
        }
        filter.dateTo = parsedDateTo;
      }

      // Paginación
      const limitNum = limit ? parseInt(limit, 10) : 50;
      const offsetNum = offset ? parseInt(offset, 10) : 0;

      if (limitNum < 1 || limitNum > 1000) {
        throw new BadRequestException('Limit must be between 1 and 1000');
      }

      if (offsetNum < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }

      filter.limit = limitNum;
      filter.offset = offsetNum;

      const data = await this.transactionLogService.getTransactionLogs(filter);

      return {
        data,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving transactions: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene una transacción específica por ID
   * GET /api/transactions/123
   */
  @Get(':id')
  async getTransaction(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TransactionLogEntry> {
    try {
      const transaction = await this.transactionLogService.getTransactionLog(
        id,
      );
      if (!transaction) {
        throw new BadRequestException(`Transaction with ID ${id} not found`);
      }
      return transaction;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving transaction: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene transacciones por estado
   * GET /api/transactions/status/SUCCESS
   */
  @Get('status/:status')
  async getTransactionsByStatus(
    @Param('status') status: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    data: TransactionLogEntry[];
    pagination: {
      limit: number;
      offset: number;
    };
  }> {
    try {
      const validStatuses = [
        'PENDING',
        'SUCCESS',
        'FAILED',
        'CANCELLED',
        'REVERSED',
        'TIMEOUT',
      ];
      if (!validStatuses.includes(status)) {
        throw new BadRequestException(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        );
      }

      const limitNum = limit ? parseInt(limit, 10) : 50;
      const offsetNum = offset ? parseInt(offset, 10) : 0;

      if (limitNum < 1 || limitNum > 1000) {
        throw new BadRequestException('Limit must be between 1 and 1000');
      }

      if (offsetNum < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }

      const filter: TransactionLogFilter = {
        status,
        limit: limitNum,
        offset: offsetNum,
      };

      const data = await this.transactionLogService.getTransactionLogs(filter);

      return {
        data,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving transactions by status: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene transacciones por número de teléfono
   * GET /api/transactions/phone/3001234567
   */
  @Get('phone/:phone')
  async getTransactionsByPhone(
    @Param('phone') phone: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    data: TransactionLogEntry[];
    pagination: {
      limit: number;
      offset: number;
    };
  }> {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;
      const offsetNum = offset ? parseInt(offset, 10) : 0;

      if (limitNum < 1 || limitNum > 1000) {
        throw new BadRequestException('Limit must be between 1 and 1000');
      }

      if (offsetNum < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }

      const filter: TransactionLogFilter = {
        phoneNumber: phone,
        limit: limitNum,
        offset: offsetNum,
      };

      const data = await this.transactionLogService.getTransactionLogs(filter);

      return {
        data,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving transactions by phone: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene estadísticas de transacciones
   * GET /api/transactions/stats?dateFrom=2024-01-01&dateTo=2024-12-31
   */
  @Get('stats/summary')
  async getTransactionStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<TransactionStats> {
    try {
      let parsedDateFrom: Date | undefined;
      let parsedDateTo: Date | undefined;

      if (dateFrom) {
        parsedDateFrom = new Date(dateFrom);
        if (isNaN(parsedDateFrom.getTime())) {
          throw new BadRequestException(
            'Invalid dateFrom format. Use ISO 8601 format.',
          );
        }
      }

      if (dateTo) {
        parsedDateTo = new Date(dateTo);
        if (isNaN(parsedDateTo.getTime())) {
          throw new BadRequestException(
            'Invalid dateTo format. Use ISO 8601 format.',
          );
        }
      }

      return await this.transactionLogService.getTransactionStats(
        parsedDateFrom,
        parsedDateTo,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving transaction stats: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene transacciones por message ID
   * GET /api/transactions/message/ABC123XYZ
   */
  @Get('message/:messageId')
  async getTransactionByMessageId(
    @Param('messageId') messageId: string,
  ): Promise<TransactionLogEntry> {
    try {
      const transaction =
        await this.transactionLogService.getTransactionLogByMessageId(
          messageId,
        );
      if (!transaction) {
        throw new BadRequestException(
          `Transaction with message ID ${messageId} not found`,
        );
      }
      return transaction;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Error retrieving transaction by message ID: ${error.message}`,
      );
    }
  }
}
