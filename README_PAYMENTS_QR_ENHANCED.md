# Payments QR - Versión Mejorada con Sistema de Seguimiento

Esta documentación describe la implementación del sistema de seguimiento de transacciones específicamente para el módulo **payments-qr**, que maneja la generación, consulta y cancelación de códigos QR para pagos con Nequi.

## Descripción General

El módulo `payments-qr` se ha mejorado para incluir un sistema completo de seguimiento y auditoría de todas las operaciones relacionadas con códigos QR de pago. Esto permite mantener un historial detallado de cada código QR generado, su estado y todas las operaciones realizadas sobre él.

## Nuevas Características del Módulo QR

### Sistema de Seguimiento Específico para QR

El sistema de seguimiento para códigos QR incluye las siguientes funcionalidades específicas:

#### 1. Generación de Códigos QR con Logging
- Registro automático de cada solicitud de generación de código QR
- Almacenamiento del payload completo enviado a Nequi
- Captura de la respuesta con el código QR generado
- Registro de tiempos de procesamiento
- Identificación única mediante `internal_reference` con prefijo `QR_`

#### 2. Consulta de Estado con Auditoría
- Registro de cada consulta de estado de código QR
- Almacenamiento de parámetros de consulta
- Captura de respuestas de estado de Nequi
- Seguimiento de IP del cliente y User Agent

#### 3. Cancelación de QR con Relaciones
- Registro de operaciones de cancelación
- Establecimiento de relaciones padre-hijo entre QR original y cancelación
- Actualización automática del estado del QR original
- Auditoría completa del proceso de cancelación

## Archivos Implementados

### 1. Servicio Mejorado: `payments-qr.service.enhanced.ts`

Este archivo contiene la lógica principal del servicio mejorado con las siguientes características:

#### Método `crearQr()`
```typescript
async crearQr(dto: SendPushNotificationDto, clientIp?: string, userAgent?: string): Promise<any>
```

**Funcionalidades:**
- Genera un `messageId` único para cada solicitud
- Crea un registro inicial en `transaction_log` con estado `PENDING`
- Almacena el payload completo de la solicitud
- Realiza la llamada a la API de Nequi
- Actualiza el registro con la respuesta y el código QR generado
- Maneja errores y actualiza el estado correspondiente
- Registra tiempos de procesamiento precisos

**Campos específicos para QR:**
- `internalReference`: Prefijo `QR_` + messageId
- `transactionId`: Código QR generado por Nequi
- `operationType`: `SEND_PUSH` (reutilizado para QR)

#### Método `consultarEstadoQr()`
```typescript
async consultarEstadoQr(qrId: string, clientIp?: string, userAgent?: string): Promise<any>
```

**Funcionalidades:**
- Crea registro de auditoría para cada consulta de estado
- Almacena parámetros de la consulta (qrId, URL, método)
- Registra la respuesta completa de Nequi
- Maneja errores y excepciones con logging apropiado

#### Método `cancelarQr()`
```typescript
async cancelarQr(qrId: string, clientIp?: string, userAgent?: string): Promise<any>
```

**Funcionalidades:**
- Busca la transacción QR original para establecer relación padre-hijo
- Crea registro de cancelación con referencia al QR original
- Actualiza el estado del QR original a `CANCELLED`
- Registra toda la operación de cancelación

### 2. Controlador Mejorado: `payments-qr.controller.enhanced.ts`

El controlador mejorado incluye:

#### Captura de Información del Cliente
- Extracción de IP real del cliente (considerando proxies)
- Captura de User Agent para auditoría
- Logging detallado de cada operación

#### Endpoints Mejorados

**POST /payments-qr/crear-qr**
- Captura automática de IP y User Agent
- Logging de solicitudes de creación de QR
- Manejo mejorado de errores

**GET /payments-qr/estado-qr/:qrId**
- Parámetro qrId ahora en la URL (mejorado del original)
- Auditoría completa de consultas de estado
- Información del cliente registrada

**POST /payments-qr/cancelar-qr/:qrId**
- Cancelación con auditoría completa
- Registro de IP y User Agent
- Logging detallado de operaciones

### 3. Módulo Mejorado: `payments-qr.module.enhanced.ts`

El módulo incluye:
- Importación del `TransactionLogModule`
- Configuración de dependencias mejoradas
- Exportación del servicio mejorado para uso en otros módulos

### 4. Módulo Principal Completo: `app.module.full-enhanced.ts`

Módulo principal que incluye tanto `PaymentsModuleEnhanced` como `PaymentsQrModuleEnhanced` para una implementación completa del sistema de seguimiento.

## Estructura de Datos Específica para QR

### Campos Específicos en transaction_log

Para transacciones de códigos QR, se utilizan los siguientes campos con valores específicos:

| Campo | Valor para QR | Descripción |
|-------|---------------|-------------|
| `operation_type` | `SEND_PUSH` | Generación de código QR |
| `operation_type` | `GET_STATUS` | Consulta de estado de QR |
| `operation_type` | `CANCEL_PUSH` | Cancelación de código QR |
| `internal_reference` | `QR_{messageId}` | Identificador único para QR |
| `transaction_id` | Código QR generado | El código QR devuelto por Nequi |
| `phone_number` | Número asociado | Teléfono para el cual se genera el QR |

### Estados de Códigos QR

Los códigos QR pueden tener los siguientes estados:

1. **PENDING**: QR solicitado pero no generado aún
2. **SUCCESS**: QR generado exitosamente
3. **FAILED**: Error en la generación del QR
4. **CANCELLED**: QR cancelado explícitamente

## Consultas Específicas para QR

### Obtener todos los códigos QR generados
```http
GET /api/transactions?operationType=SEND_PUSH&internalReference=QR_
```

### Obtener códigos QR por número de teléfono
```http
GET /api/transactions/phone/3001234567?operationType=SEND_PUSH
```

### Obtener estadísticas de códigos QR
```http
GET /api/transactions/stats/summary?operationType=SEND_PUSH
```

### Obtener códigos QR cancelados
```http
GET /api/transactions?status=CANCELLED&operationType=CANCEL_PUSH
```

## Configuración y Uso

### 1. Configuración de Base de Datos

El sistema utiliza la misma estructura de base de datos del sistema general de seguimiento. No se requieren tablas adicionales.

### 2. Variables de Entorno

Asegúrate de que las siguientes variables estén configuradas:

```env
# URLs específicas para QR (deben estar en la tabla de parámetros)
NEQUI_PAYMENTS_QR_URL=https://api.nequi.com/qr/generate
NEQUI_STATUS_PAYMENTS_QR_URL=https://api.nequi.com/qr/status
NEQUI_REVERSE_PAYMENTS_QR_URL=https://api.nequi.com/qr/cancel
```

### 3. Uso del Módulo Mejorado

Para usar el módulo QR mejorado, actualiza tu `main.ts`:

```typescript
import { AppModuleFullEnhanced } from './app.module.full-enhanced';

async function bootstrap() {
  const app = await NestFactory.create(AppModuleFullEnhanced);
  // ... resto de la configuración
}
```

## Ejemplos de Uso

### Generar un Código QR con Seguimiento

```bash
curl -X POST http://localhost:3000/payments-qr/crear-qr \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "3001234567",
    "value": 50000
  }'
```

### Consultar Estado de un QR

```bash
curl -X GET http://localhost:3000/payments-qr/estado-qr/QR123456789
```

### Cancelar un Código QR

```bash
curl -X POST http://localhost:3000/payments-qr/cancelar-qr/QR123456789
```

### Consultar Historial de QR Generados

```bash
curl -X GET "http://localhost:3000/api/transactions?operationType=SEND_PUSH&limit=50"
```

## Monitoreo y Análisis

### Métricas Específicas para QR

El sistema permite obtener métricas específicas para códigos QR:

1. **Tasa de Éxito de Generación**: Porcentaje de QR generados exitosamente
2. **Tiempo Promedio de Generación**: Tiempo promedio para generar un QR
3. **Códigos QR Activos**: QR generados y no cancelados
4. **Tasa de Cancelación**: Porcentaje de QR cancelados

### Consultas de Análisis

```sql
-- QR generados por día
SELECT DATE(created_at) as fecha, COUNT(*) as qr_generados
FROM transaction_tracking.transaction_log
WHERE operation_type = 'SEND_PUSH' 
  AND internal_reference LIKE 'QR_%'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- Tiempo promedio de generación de QR
SELECT AVG(processing_time_ms) as tiempo_promedio_ms
FROM transaction_tracking.transaction_log
WHERE operation_type = 'SEND_PUSH' 
  AND internal_reference LIKE 'QR_%'
  AND status = 'SUCCESS';

-- QR por estado
SELECT status, COUNT(*) as cantidad
FROM transaction_tracking.transaction_log
WHERE operation_type = 'SEND_PUSH' 
  AND internal_reference LIKE 'QR_%'
GROUP BY status;
```

## Consideraciones de Seguridad

### Información Sensible
- Los códigos QR se almacenan en el campo `transaction_id`
- Los números de teléfono pueden encriptarse antes del almacenamiento
- Las IPs de clientes se registran para auditoría

### Acceso a Datos
- Solo usuarios autorizados pueden acceder a los logs de QR
- Se recomienda implementar roles específicos para consulta de QR
- Los códigos QR activos deben protegerse especialmente

## Troubleshooting

### Problemas Comunes

1. **QR no se genera**: Verificar configuración de URLs en parámetros
2. **Logs no se crean**: Verificar conexión a base de datos
3. **Relaciones padre-hijo no funcionan**: Verificar que el QR original existe

### Logs de Depuración

El sistema incluye logging detallado en varios niveles:
- `VERBOSE`: Operaciones detalladas
- `DEBUG`: Respuestas de Nequi
- `LOG`: Operaciones principales
- `ERROR`: Errores y excepciones

## Migración desde la Versión Original

1. Ejecutar el script de base de datos (si no se ha hecho)
2. Actualizar las importaciones en `main.ts`
3. Verificar configuración de parámetros de URLs
4. Probar endpoints con el nuevo sistema

Los endpoints existentes seguirán funcionando, pero ahora con capacidades de logging automático.

## Próximos Pasos

1. **Implementar Alertas**: Configurar alertas para QR fallidos
2. **Dashboard de Monitoreo**: Crear dashboard para métricas de QR
3. **Archivado Automático**: Implementar archivado de QR antiguos
4. **Encriptación**: Implementar encriptación de códigos QR sensibles

Este sistema proporciona una base sólida para el seguimiento completo de códigos QR de pago con Nequi, manteniendo la compatibilidad con el sistema existente mientras añade capacidades avanzadas de auditoría y monitoreo.

