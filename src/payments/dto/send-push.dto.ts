import { ApiProperty } from '@nestjs/swagger';

export class SendPushNotificationDto {
  @ApiProperty({ example: '3998764643', description: 'Número de teléfono del destinatario' })
  phoneNumber: string;

  @ApiProperty({ example: '1000', description: 'Valor del pago' })
  value: string;
}


export class CancelPushNotificationDto {
  @ApiProperty({ example: '3998764643', description: 'Número de teléfono del destinatario' })
  phoneNumber: string;

  @ApiProperty({ example: '350-12345-36599277-PsFS1s4VAZ', description: 'Identificador de la transacción' })
  transactionId: string;
}


export class ReverseTransactionDto {
  @ApiProperty({ example: '3998764643', description: 'Número de teléfono del destinatario' })
  phoneNumber: string;

  @ApiProperty({ example: 'darUyO4J2V', description: 'Identificador de la transacción interno' })
  messageId: string;

  @ApiProperty({ example: '1000', description: 'Valor del pago' })
  value: string;
}