# Demo Nequi Push - Versión Mejorada con Sistema de Seguimiento

Esta es una versión mejorada del proyecto original que incluye un sistema completo de seguimiento y control de transacciones con Nequi.

## Nuevas Características

### Sistema de Seguimiento de Transacciones

- **Registro Completo**: Todas las transacciones se registran automáticamente en la base de datos
- **Estados de Transacción**: Seguimiento del estado completo (PENDING, SUCCESS, FAILED, CANCELLED, REVERSED, TIMEOUT)
- **Trazabilidad**: Historial completo de cada transacción desde inicio hasta finalización
- **Auditoría**: Información detallada para auditorías y resolución de problemas
- **Relaciones**: Vinculación entre transacciones originales y sus cancelaciones/reversiones

### Nuevos Endpoints de Consulta

#### Listar Transacciones
```
GET /api/transactions
```
Parámetros de consulta opcionales:
- `status`: Filtrar por estado (PENDING, SUCCESS, FAILED, etc.)
- `operationType`: Filtrar por tipo de operación (SEND_PUSH, CANCEL_PUSH, etc.)
- `phoneNumber`: Filtrar por número de teléfono
- `transactionId`: Filtrar por ID de transacción de Nequi
- `dateFrom`: Fecha de inicio (formato ISO 8601)
- `dateTo`: Fecha de fin (formato ISO 8601)
- `limit`: Número máximo de resultados (1-1000, default: 50)
- `offset`: Número de resultados a omitir (default: 0)

#### Obtener Transacción Específica
```
GET /api/transactions/:id
```

#### Transacciones por Estado
```
GET /api/transactions/status/:status
```

#### Transacciones por Teléfono
```
GET /api/transactions/phone/:phoneNumber
```

#### Transacción por Message ID
```
GET /api/transactions/message/:messageId
```

#### Estadísticas de Transacciones
```
GET /api/transactions/stats/summary
```
Parámetros opcionales:
- `dateFrom`: Fecha de inicio para las estadísticas
- `dateTo`: Fecha de fin para las estadísticas

### Estructura de la Base de Datos

#### Tabla Principal: `transaction_tracking.transaction_log`

Campos principales:
- `id`: Identificador único autoincremental
- `transaction_id`: ID proporcionado por Nequi
- `message_id`: ID de mensaje interno generado
- `operation_type`: Tipo de operación (SEND_PUSH, CANCEL_PUSH, GET_STATUS, REVERSE)
- `phone_number`: Número de teléfono
- `amount`: Monto de la transacción
- `status`: Estado actual de la transacción
- `request_payload`: Payload JSON enviado a Nequi
- `response_payload`: Respuesta JSON de Nequi
- `processing_time_ms`: Tiempo de procesamiento en milisegundos
- `parent_transaction_id`: Referencia a transacción padre (para cancelaciones/reversiones)
- `created_at`, `updated_at`: Timestamps de auditoría

## Instalación y Configuración

### 1. Ejecutar el Script de Base de Datos

Ejecutar el script SQL para crear las tablas necesarias:

```bash
psql -h localhost -U postgres -d your_database -f database/transaction_log_schema.sql
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Asegúrate de que las siguientes variables estén configuradas:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=your_database
DB_SSL=false
NODE_ENV=production
```

### 4. Usar la Versión Mejorada

Para usar la versión mejorada, reemplaza las importaciones en `main.ts`:

```typescript
// Cambiar de:
import { AppModule } from './app.module';

// A:
import { AppModuleEnhanced } from './app.module.enhanced';

// Y usar AppModuleEnhanced en lugar de AppModule
```

## Uso del Sistema de Seguimiento

### Endpoints de Pagos Mejorados

Los endpoints de pagos ahora capturan automáticamente:
- IP del cliente
- User Agent
- Timestamps precisos
- Payloads completos de solicitud y respuesta
- Tiempos de procesamiento

#### Enviar Notificación Push
```
POST /payments/send-push
```

#### Cancelar Notificación Push
```
POST /payments/cancel-push
```

#### Consultar Estado de Pago
```
GET /payments/status/:transactionId
```

#### Revertir Transacción
```
POST /payments/reverse
```

### Ejemplos de Consultas

#### Obtener todas las transacciones exitosas del último mes
```
GET /api/transactions?status=SUCCESS&dateFrom=2024-06-01T00:00:00Z&limit=100
```

#### Obtener transacciones fallidas de un número específico
```
GET /api/transactions/phone/3001234567?status=FAILED
```

#### Obtener estadísticas del último trimestre
```
GET /api/transactions/stats/summary?dateFrom=2024-04-01T00:00:00Z&dateTo=2024-06-30T23:59:59Z
```

## Características de Seguridad

- **Encriptación**: Los números de teléfono se pueden encriptar antes del almacenamiento
- **Auditoría**: Registro completo de todas las operaciones
- **Trazabilidad**: Seguimiento completo de la cadena de transacciones
- **Validación**: Validación estricta de parámetros de entrada

## Monitoreo y Mantenimiento

### Vistas Predefinidas

- `transaction_tracking.active_transactions`: Transacciones activas de los últimos 30 días
- `transaction_tracking.daily_stats`: Estadísticas diarias de los últimos 90 días

### Función de Limpieza

```sql
SELECT transaction_tracking.cleanup_old_transactions(365); -- Eliminar registros de más de 1 año
```

### Índices Optimizados

El sistema incluye índices optimizados para:
- Consultas por estado
- Consultas por fecha
- Consultas por número de teléfono
- Consultas por ID de transacción
- Consultas por tipo de operación

## Migración desde la Versión Original

1. Ejecutar el script de base de datos
2. Instalar las nuevas dependencias
3. Actualizar las importaciones en `main.ts`
4. Reiniciar la aplicación

Los endpoints existentes seguirán funcionando, pero ahora con capacidades de logging automático.

## Desarrollo y Testing

### Ejecutar en Modo Desarrollo
```bash
npm run start:dev
```

### Ejecutar Tests
```bash
npm run test
```

### Verificar el Sistema de Logging

Después de realizar algunas transacciones, puedes verificar que el logging funciona consultando:

```
GET /api/transactions
```

## Soporte y Contribuciones

Para reportar problemas o contribuir al proyecto, por favor crea un issue en el repositorio de GitHub.

## Licencia

Este proyecto mantiene la misma licencia que el proyecto original.

