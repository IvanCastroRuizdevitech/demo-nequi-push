import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface TransactionLogEntry {
  id?: number;
  transactionId?: string;
  messageId: string;
  internalReference?: string;
  operationType: 'SEND_PUSH' | 'CANCEL_PUSH' | 'GET_STATUS' | 'REVERSE';
  phoneNumber?: string;
  amount?: string;
  currency?: string;
  status:
    | 'PENDING'
    | 'SUCCESS'
    | 'FAILED'
    | 'CANCELLED'
    | 'REVERSED'
    | 'TIMEOUT';
  nequiStatusCode?: string;
  nequiStatusDescription?: string;
  errorMessage?: string;
  requestPayload?: any;
  responsePayload?: any;
  clientIp?: string;
  userAgent?: string;
  reference1?: string;
  reference2?: string;
  reference3?: string;
  parentTransactionId?: number;
  processingTimeMs?: number;
  retryCount?: number;
  environment?: string;
}

export interface TransactionLogFilter {
  status?: string;
  operationType?: string;
  phoneNumber?: string;
  transactionId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface TransactionStats {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  averageProcessingTime: number;
  totalAmount: number;
}

@Injectable()
export class TransactionLogService {
  private readonly logger = new Logger(TransactionLogService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Crea un nuevo registro de transacción
   */
  async createTransactionLog(entry: TransactionLogEntry): Promise<number> {
    const startTime = Date.now();

    try {
      const query = `
        INSERT INTO transaction_tracking.transaction_log (
          transaction_id, message_id, internal_reference, operation_type,
          phone_number, amount, currency, status, nequi_status_code,
          nequi_status_description, error_message, request_payload,
          response_payload, client_ip, user_agent, reference1, reference2,
          reference3, parent_transaction_id, processing_time_ms, retry_count,
          environment
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22
        ) RETURNING id
      `;

      const values = [
        entry.transactionId || null,
        entry.messageId,
        entry.internalReference || null,
        entry.operationType,
        entry.phoneNumber || null,
        entry.amount || null,
        entry.currency || 'COP',
        entry.status,
        entry.nequiStatusCode || null,
        entry.nequiStatusDescription || null,
        entry.errorMessage || null,
        entry.requestPayload ? JSON.stringify(entry.requestPayload) : null,
        entry.responsePayload ? JSON.stringify(entry.responsePayload) : null,
        entry.clientIp || null,
        entry.userAgent || null,
        entry.reference1 || null,
        entry.reference2 || null,
        entry.reference3 || null,
        entry.parentTransactionId || null,
        entry.processingTimeMs || null,
        entry.retryCount || 0,
        entry.environment || 'production',
      ];

      const result = await this.databaseService.query(query, values);
      const logId = result.rows[0].id;

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `Transaction log created with ID: ${logId} in ${processingTime}ms`,
      );

      return logId;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(
        `Error creating transaction log in ${processingTime}ms:`,
        error.message,
      );
      throw new Error(`Failed to create transaction log: ${error.message}`);
    }
  }

  /**
   * Actualiza un registro de transacción existente
   */
  async updateTransactionLog(
    id: number,
    updates: Partial<TransactionLogEntry>,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const setClause: any[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Construir dinámicamente la consulta UPDATE
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const columnName = this.camelToSnakeCase(key);
          if (key === 'requestPayload' || key === 'responsePayload') {
            setClause.push(`${columnName} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${columnName} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        this.logger.warn('No fields to update in transaction log');
        return;
      }

      values.push(id);
      const query = `
        UPDATE transaction_tracking.transaction_log 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await this.databaseService.query(query, values);

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Transaction log ${id} updated in ${processingTime}ms`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(
        `Error updating transaction log ${id} in ${processingTime}ms:`,
        error.message,
      );
      throw new Error(`Failed to update transaction log: ${error.message}`);
    }
  }

  /**
   * Obtiene un registro de transacción por ID
   */
  async getTransactionLog(id: number): Promise<TransactionLogEntry | null> {
    try {
      const query = `
        SELECT * FROM transaction_tracking.transaction_log WHERE id = $1
      `;
      const result = await this.databaseService.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTransactionLog(result.rows[0]);
    } catch (error) {
      this.logger.error(`Error getting transaction log ${id}:`, error.message);
      throw new Error(`Failed to get transaction log: ${error.message}`);
    }
  }

  /**
   * Obtiene registros de transacción por message_id
   */
  async getTransactionLogByMessageId(
    messageId: string,
  ): Promise<TransactionLogEntry | null> {
    try {
      const query = `
        SELECT * FROM transaction_tracking.transaction_log 
        WHERE message_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const result = await this.databaseService.query(query, [messageId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTransactionLog(result.rows[0]);
    } catch (error) {
      this.logger.error(
        `Error getting transaction log by message ID ${messageId}:`,
        error.message,
      );
      throw new Error(`Failed to get transaction log: ${error.message}`);
    }
  }

  /**
   * Obtiene registros de transacción con filtros
   */
  async getTransactionLogs(
    filter: TransactionLogFilter = {},
  ): Promise<TransactionLogEntry[]> {
    try {
      let query = `
        SELECT * FROM transaction_tracking.transaction_log
        WHERE 1=1
      `;
      const values: any[] = [];
      let paramIndex = 1;

      // Aplicar filtros
      if (filter.status) {
        query += ` AND status = $${paramIndex}`;
        values.push(filter.status);
        paramIndex++;
      }

      if (filter.operationType) {
        query += ` AND operation_type = $${paramIndex}`;
        values.push(filter.operationType);
        paramIndex++;
      }

      if (filter.phoneNumber) {
        query += ` AND phone_number = $${paramIndex}`;
        values.push(filter.phoneNumber);
        paramIndex++;
      }

      if (filter.transactionId) {
        query += ` AND transaction_id = $${paramIndex}`;
        values.push(filter.transactionId);
        paramIndex++;
      }

      if (filter.dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        values.push(filter.dateFrom);
        paramIndex++;
      }

      if (filter.dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        values.push(filter.dateTo);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC`;

      if (filter.limit) {
        query += ` LIMIT $${paramIndex}`;
        values.push(filter.limit);
        paramIndex++;
      }

      if (filter.offset) {
        query += ` OFFSET $${paramIndex}`;
        values.push(filter.offset);
        paramIndex++;
      }
      const result = await this.databaseService.query(query, values);
      return result.rows.map((row) => this.mapRowToTransactionLog(row));
    } catch (error) {
      this.logger.error('Error getting transaction logs:', error.message);
      throw new Error(`Failed to get transaction logs: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas de transacciones
   */
  async getTransactionStats(
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<TransactionStats> {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successful_transactions,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_transactions,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_transactions,
          AVG(processing_time_ms) as average_processing_time,
          SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END) as total_amount
        FROM transaction_tracking.transaction_log
        WHERE 1=1
      `;
      const values: any[] = [];
      let paramIndex = 1;

      if (dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        values.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        values.push(dateTo);
        paramIndex++;
      }

      const result = await this.databaseService.query(query, values);
      const row = result.rows[0];

      return {
        totalTransactions: parseInt(row.total_transactions) || 0,
        successfulTransactions: parseInt(row.successful_transactions) || 0,
        failedTransactions: parseInt(row.failed_transactions) || 0,
        pendingTransactions: parseInt(row.pending_transactions) || 0,
        averageProcessingTime: parseFloat(row.average_processing_time) || 0,
        totalAmount: parseFloat(row.total_amount) || 0,
      };
    } catch (error) {
      this.logger.error('Error getting transaction stats:', error.message);
      throw new Error(`Failed to get transaction stats: ${error.message}`);
    }
  }

  /**
   * Marca una transacción como timeout
   */
  async markAsTimeout(messageId: string): Promise<void> {
    await this.updateTransactionLogByMessageId(messageId, {
      status: 'TIMEOUT',
      errorMessage: 'Transaction timed out waiting for response',
    });
  }

  /**
   * Actualiza un registro por message_id
   */
  private async updateTransactionLogByMessageId(
    messageId: string,
    updates: Partial<TransactionLogEntry>,
  ): Promise<void> {
    const log = await this.getTransactionLogByMessageId(messageId);
    if (log && log.id) {
      await this.updateTransactionLog(log.id, updates);
    }
  }

  /**
   * Convierte camelCase a snake_case
   */
  private camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Mapea una fila de la base de datos a TransactionLogEntry
   */
  private mapRowToTransactionLog(row: any): TransactionLogEntry {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      messageId: row.message_id,
      internalReference: row.internal_reference,
      operationType: row.operation_type,
      phoneNumber: row.phone_number,
      amount: row.amount ? row.amount : undefined,
      currency: row.currency,
      status: row.status,
      nequiStatusCode: row.nequi_status_code,
      nequiStatusDescription: row.nequi_status_description,
      errorMessage: row.error_message,
      requestPayload: row.request_payload,
      responsePayload: row.response_payload,
      clientIp: row.client_ip,
      userAgent: row.user_agent,
      reference1: row.reference1,
      reference2: row.reference2,
      reference3: row.reference3,
      parentTransactionId: row.parent_transaction_id,
      processingTimeMs: row.processing_time_ms,
      retryCount: row.retry_count,
      environment: row.environment,
    };
  }
}
