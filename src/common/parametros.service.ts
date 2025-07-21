import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ParametrosService {
  constructor(private readonly databaseService: DatabaseService) {}   

  async obtenerValorParametro(descripcion: string, id_empresa?: number): Promise<string | null> {
    let query = `
      SELECT tvp.valor
      FROM parametrizacion.parametros p
      JOIN parametrizacion.tbl_valor_parametros tvp ON p.id_parametro = tvp.id_parametro
      WHERE p.descripcion = $1
    `;
    const params: (string | number | null)[] = [descripcion];

    if (typeof id_empresa === 'number') {
      query += ' AND tvp.id_empresa = $2';
      params.push(id_empresa);
    } else {
      query += ' AND tvp.id_empresa IS NULL';
    }

    query += ' LIMIT 1;';
    const { rows } = await this.databaseService.query(query, params);
    return rows.length ? rows[0].valor : null;
  }
}