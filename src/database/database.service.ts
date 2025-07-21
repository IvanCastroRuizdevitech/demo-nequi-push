import { Injectable } from '@nestjs/common';
import * as process from 'process';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USERNAME || 'postgres', // Default to 'postgres' if not set
      host: process.env.DB_HOST || 'localhost', // Default to localhost if not set
      database: process.env.DB_DATABASE,
      password: process.env.DB_PASSWORD, // Change this to match your setup
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432, // Default PostgreSQL port
      ssl: process.env.DB_SSL === 'true'
                  ? { rejectUnauthorized: false }
                  : false,
                  });
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } catch (error){
      console.error('Error executing query:', error.message);
      throw error; // Rethrow the error to propagate it up the chain
    } finally {
      client.release();
    }
  }

  async getClient() {
    return await this.pool.connect();
  }
}

