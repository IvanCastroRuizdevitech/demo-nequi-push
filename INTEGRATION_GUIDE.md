# Guía de Integración Completa - Sistema de Seguimiento Nequi

Esta guía proporciona instrucciones paso a paso para integrar el sistema completo de seguimiento de transacciones tanto para pagos push como para códigos QR con Nequi.

## Resumen de la Implementación

Se han creado versiones mejoradas de ambos módulos principales:

1. **Payments Module Enhanced**: Para pagos push tradicionales
2. **Payments QR Module Enhanced**: Para códigos QR de pago

Ambos módulos comparten el mismo sistema de logging centralizado pero manejan diferentes tipos de operaciones.

## Estructura de Archivos Implementados

### Archivos Comunes (Sistema de Logging)
```
src/
├── transaction-log/
│   ├── transaction-log.service.ts      # Servicio principal de logging
│   ├── transaction-log.controller.ts   # API REST para consultas
│   └── transaction-log.module.ts       # Módulo de logging
└── database/
    └── transaction_log_schema.sql      # Esquema de base de datos
```

### Archivos del Módulo Payments Enhanced
```
src/payments/
├── payments.service.enhanced.ts        # Servicio mejorado para pagos push
├── payments.controller.enhanced.ts     # Controlador mejorado para pagos push
└── payments.module.enhanced.ts         # Módulo mejorado para pagos push
```

### Archivos del Módulo Payments QR Enhanced
```
src/payments-qr/
├── payments-qr.service.enhanced.ts     # Servicio mejorado para códigos QR
├── payments-qr.controller.enhanced.ts  # Controlador mejorado para códigos QR
└── payments-qr.module.enhanced.ts      # Módulo mejorado para códigos QR
```

### Archivos de Configuración
```
src/
├── app.module.enhanced.ts              # Solo módulo payments mejorado
├── app.module.full-enhanced.ts         # Ambos módulos mejorados
├── README_ENHANCED.md                  # Documentación general
├── README_PAYMENTS_QR_ENHANCED.md      # Documentación específica QR
└── INTEGRATION_GUIDE.md                # Esta guía
```

## Pasos de Integración

### Paso 1: Configuración de Base de Datos

#### 1.1 Ejecutar el Script SQL
```bash
# Conectar a PostgreSQL y ejecutar el esquema
psql -h localhost -U postgres -d your_database -f database/transaction_log_schema.sql
```

#### 1.2 Verificar la Creación de Tablas
```sql
-- Verificar que las tablas se crearon correctamente
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'transaction_tracking';

-- Debería mostrar:
-- transaction_log
-- transaction_stats
```

### Paso 2: Configuración de Variables de Entorno

#### 2.1 Variables de Base de Datos
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=your_database
DB_SSL=false
NODE_ENV=production
```

#### 2.2 Variables de Nequi (en tabla de parámetros)
Asegúrate de que los siguientes parámetros estén configurados en tu tabla `parametrizacion.parametros`:

```sql
-- Parámetros para pagos push
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_UNREGISTERED_PAYMENT_URL');
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_CANCEL_PAYMENT_URL');
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_STATUS_PAYMENT_URL');
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_REVERSE_PAYMENT_URL');

-- Parámetros para códigos QR
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_PAYMENTS_QR_URL');
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_STATUS_PAYMENTS_QR_URL');
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_REVERSE_PAYMENTS_QR_URL');

-- API Key
INSERT INTO parametrizacion.parametros (descripcion) VALUES ('NEQUI_API_KEY');
```

### Paso 3: Selección de Configuración

Tienes tres opciones de configuración:

#### Opción A: Solo Pagos Push Mejorados
Usar `AppModuleEnhanced` (solo módulo payments mejorado)

```typescript
// main.ts
import { AppModuleEnhanced } from './app.module.enhanced';

async function bootstrap() {
  const app = await NestFactory.create(AppModuleEnhanced);
  await app.listen(3000);
}
bootstrap();
```

#### Opción B: Solo Códigos QR Mejorados
Modificar manualmente el app.module.ts para incluir solo PaymentsQrModuleEnhanced

#### Opción C: Ambos Módulos Mejorados (Recomendado)
Usar `AppModuleFullEnhanced` (configuración completa)

```typescript
// main.ts
import { AppModuleFullEnhanced } from './app.module.full-enhanced';

async function bootstrap() {
  const app = await NestFactory.create(AppModuleFullEnhanced);
  await app.listen(3000);
}
bootstrap();
```

### Paso 4: Instalación de Dependencias

```bash
npm install
```

### Paso 5: Pruebas de Funcionamiento

#### 5.1 Iniciar la Aplicación
```bash
npm run start:dev
```

#### 5.2 Probar Endpoints de Pagos Push
```bash
# Enviar notificación push
curl -X POST http://localhost:3000/payments/send-push \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "3001234567",
    "value": 50000
  }'
```

#### 5.3 Probar Endpoints de Códigos QR
```bash
# Crear código QR
curl -X POST http://localhost:3000/payments-qr/crear-qr \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "3001234567",
    "value": 25000
  }'
```

#### 5.4 Verificar Logging
```bash
# Consultar transacciones registradas
curl -X GET http://localhost:3000/api/transactions?limit=10
```

### Paso 6: Configuración de Monitoreo

#### 6.1 Consultas de Verificación
```sql
-- Verificar que se están creando logs
SELECT COUNT(*) FROM transaction_tracking.transaction_log;

-- Ver últimas transacciones
SELECT * FROM transaction_tracking.transaction_log 
ORDER BY created_at DESC LIMIT 5;

-- Estadísticas por tipo de operación
SELECT operation_type, status, COUNT(*) 
FROM transaction_tracking.transaction_log 
GROUP BY operation_type, status;
```

## Endpoints Disponibles

### API de Pagos Push Mejorados
```
POST   /payments/send-push          # Enviar notificación push
POST   /payments/cancel-push        # Cancelar notificación
GET    /payments/status/:id         # Consultar estado
POST   /payments/reverse            # Revertir transacción
```

### API de Códigos QR Mejorados
```
POST   /payments-qr/crear-qr        # Crear código QR
GET    /payments-qr/estado-qr/:id   # Consultar estado QR
POST   /payments-qr/cancelar-qr/:id # Cancelar código QR
```

### API de Consulta de Logs
```
GET    /api/transactions                    # Listar transacciones
GET    /api/transactions/:id               # Transacción específica
GET    /api/transactions/status/:status    # Por estado
GET    /api/transactions/phone/:phone      # Por teléfono
GET    /api/transactions/message/:messageId # Por message ID
GET    /api/transactions/stats/summary     # Estadísticas
```

## Diferencias entre Módulos

### Pagos Push vs Códigos QR

| Característica | Pagos Push | Códigos QR |
|----------------|------------|------------|
| Operación Principal | `sendPushNotification` | `crearQr` |
| Identificador | `transactionId` de Nequi | Código QR generado |
| Canal | `PNP04-C001` | `PQR03-C001` |
| Referencia Interna | Sin prefijo | Prefijo `QR_` |
| Requiere Teléfono | Sí | Sí |
| Genera Código | No | Sí (código QR) |

### Estados Comunes
Ambos módulos manejan los mismos estados:
- `PENDING`: Operación iniciada
- `SUCCESS`: Operación exitosa
- `FAILED`: Operación fallida
- `CANCELLED`: Operación cancelada

## Consultas Útiles

### Separar Transacciones por Tipo

```sql
-- Solo pagos push
SELECT * FROM transaction_tracking.transaction_log 
WHERE internal_reference NOT LIKE 'QR_%' OR internal_reference IS NULL;

-- Solo códigos QR
SELECT * FROM transaction_tracking.transaction_log 
WHERE internal_reference LIKE 'QR_%';
```

### Estadísticas Comparativas

```sql
-- Comparar éxito entre pagos push y QR
SELECT 
  CASE 
    WHEN internal_reference LIKE 'QR_%' THEN 'Códigos QR'
    ELSE 'Pagos Push'
  END as tipo_transaccion,
  status,
  COUNT(*) as cantidad,
  AVG(processing_time_ms) as tiempo_promedio
FROM transaction_tracking.transaction_log
WHERE operation_type = 'SEND_PUSH'
GROUP BY 
  CASE 
    WHEN internal_reference LIKE 'QR_%' THEN 'Códigos QR'
    ELSE 'Pagos Push'
  END,
  status
ORDER BY tipo_transaccion, status;
```

## Troubleshooting

### Problemas Comunes

#### 1. Error de Conexión a Base de Datos
```
Error: No se pudo conectar a la base de datos
```
**Solución**: Verificar variables de entorno y conexión a PostgreSQL

#### 2. Tabla transaction_log no existe
```
Error: relation "transaction_tracking.transaction_log" does not exist
```
**Solución**: Ejecutar el script SQL de creación de esquema

#### 3. Parámetros de Nequi no encontrados
```
Error: NEQUI_API_KEY no encontrado
```
**Solución**: Verificar que los parámetros estén en la tabla de parametrización

#### 4. Logs no se crean
**Verificar**:
- Conexión a base de datos
- Permisos de escritura
- Configuración del TransactionLogModule

### Logs de Depuración

Activar logs detallados:
```typescript
// En main.ts
app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
```

## Mantenimiento

### Limpieza Periódica
```sql
-- Ejecutar mensualmente para limpiar registros antiguos
SELECT transaction_tracking.cleanup_old_transactions(365);
```

### Monitoreo de Rendimiento
```sql
-- Verificar rendimiento de consultas
EXPLAIN ANALYZE SELECT * FROM transaction_tracking.transaction_log 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Backup de Logs
```bash
# Backup de logs de transacciones
pg_dump -h localhost -U postgres -d your_database \
  --table=transaction_tracking.transaction_log \
  --data-only > transaction_logs_backup.sql
```

## Próximos Pasos

1. **Configurar Alertas**: Implementar alertas para transacciones fallidas
2. **Dashboard**: Crear dashboard de monitoreo en tiempo real
3. **Métricas**: Implementar métricas de negocio específicas
4. **Archivado**: Configurar archivado automático de logs antiguos
5. **Encriptación**: Implementar encriptación de datos sensibles

Esta guía proporciona todo lo necesario para implementar el sistema completo de seguimiento de transacciones Nequi. Para soporte adicional, consultar la documentación específica de cada módulo.

