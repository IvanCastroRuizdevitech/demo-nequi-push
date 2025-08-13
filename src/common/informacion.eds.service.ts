import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ObtenerInformacionEstacionService {
  constructor(private readonly databaseService: DatabaseService) {}

  async obtenerInformacionEstacion(
    stationCode: number,
    equipmentCode: number,
  ): Promise<string | null> {
    let query = `
                  SELECT id
                  FROM public.ct_equipos e
                  WHERE e.id = $2 
                  AND e.empresas_id = $1 
                  AND e.estado = 'A'
                  LIMIT 1;
    `;
    const params: any[] = [stationCode, equipmentCode];
    const { rows } = await this.databaseService.query(query, params);
    return rows.length ? rows[0].id : null;
  }
}