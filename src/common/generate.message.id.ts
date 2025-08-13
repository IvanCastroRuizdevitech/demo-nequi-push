import { Injectable } from '@nestjs/common';

@Injectable()
export class GenerateMessageId {
  // generateMessageId(
  //   length = 10,
  //   stationCode?: string,
  //   equipmentCode?: string,
  // ): string {

  //   const chars =
  //     'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  //   let randomPart = '';
  //   for (let i = 0; i < length; i++) {
  //     const rand = Math.floor(Math.random() * chars.length);
  //     randomPart += chars[rand];
  //   }

  //   const timestamp = Date.now().toString(36);
  //   const station = stationCode ? stationCode : '';
  //   const equipment = equipmentCode ? equipmentCode : '';

  //   return `${station}${equipment}-${timestamp}-${randomPart}`;
  // }

  generateMessageId(
    stationCode?: string,
    equipmentCode?: string,
  ): string {
    const timestamp = Date.now().toString(36); // ej: "l3gd1n"
    const randomPart = Math.random().toString(36).substring(2, 8); // ej: "a9x4c2"
    
    const station = stationCode ? stationCode.substring(0, 2) : '';
    const equipment = equipmentCode ? equipmentCode.substring(0, 2) : '';

    // Unimos todo y luego recortamos a máximo 10 caracteres
    let rawId = `${station}${equipment}${timestamp}${randomPart}`;

    // Si sobra, recortamos; si falta, rellenamos con random
    if (rawId.length > 10) {
      rawId = rawId.substring(0, 10);
    } else if (rawId.length < 10) {
      rawId = rawId.padEnd(10, Math.random().toString(36).substring(2, 10));
    }

    return rawId;
  }
}
