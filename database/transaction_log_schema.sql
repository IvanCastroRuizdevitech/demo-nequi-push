-- Schema para el seguimiento de transacciones con Nequi
-- Este script debe ejecutarse en la base de datos PostgreSQL

-- Crear esquema si no existe
CREATE SCHEMA IF NOT EXISTS transaction_tracking;

-- Crear tabla principal para el log de transacciones
CREATE TABLE IF NOT EXISTS transaction_tracking.transaction_log (
    id BIGSERIAL PRIMARY KEY,
    transaction_id VARCHAR(255), -- ID proporcionado por Nequi
    message_id VARCHAR(255) NOT NULL, -- ID de mensaje interno
    internal_reference VARCHAR(255), -- Referencia interna del sistema
    
    -- Información de la transacción
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('SEND_PUSH', 'CANCEL_PUSH', 'GET_STATUS', 'REVERSE')),
    phone_number VARCHAR(255), -- Encriptado por seguridad
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'COP',
    
    -- Estado y control
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REVERSED', 'TIMEOUT')),
    nequi_status_code VARCHAR(10),
    nequi_status_description TEXT,
    error_message TEXT,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    request_payload JSONB,
    response_payload JSONB,
    client_ip INET,
    user_agent TEXT,
    
    -- Referencias
    reference1 VARCHAR(255),
    reference2 VARCHAR(255),
    reference3 VARCHAR(255),
    parent_transaction_id BIGINT REFERENCES transaction_tracking.transaction_log(id),
    
    -- Metadatos adicionales
    processing_time_ms INTEGER, -- Tiempo de procesamiento en milisegundos
    retry_count INTEGER DEFAULT 0,
    environment VARCHAR(50) DEFAULT 'production' -- development, staging, production
);

-- Crear índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_transaction_log_transaction_id ON transaction_tracking.transaction_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_log_message_id ON transaction_tracking.transaction_log(message_id);
CREATE INDEX IF NOT EXISTS idx_transaction_log_status ON transaction_tracking.transaction_log(status);
CREATE INDEX IF NOT EXISTS idx_transaction_log_operation_type ON transaction_tracking.transaction_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_transaction_log_created_at ON transaction_tracking.transaction_log(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_log_phone_number ON transaction_tracking.transaction_log(phone_number);
CREATE INDEX IF NOT EXISTS idx_transaction_log_parent_id ON transaction_tracking.transaction_log(parent_transaction_id);

-- Crear índice compuesto para consultas por rango de fechas y estado
CREATE INDEX IF NOT EXISTS idx_transaction_log_date_status ON transaction_tracking.transaction_log(created_at, status);

-- Función para actualizar el timestamp de updated_at automáticamente
CREATE OR REPLACE FUNCTION transaction_tracking.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_transaction_log_updated_at ON transaction_tracking.transaction_log;
CREATE TRIGGER update_transaction_log_updated_at
    BEFORE UPDATE ON transaction_tracking.transaction_log
    FOR EACH ROW
    EXECUTE FUNCTION transaction_tracking.update_updated_at_column();

-- Tabla para estadísticas agregadas (opcional, para mejorar rendimiento de consultas)
CREATE TABLE IF NOT EXISTS transaction_tracking.transaction_stats (
    id SERIAL PRIMARY KEY,
    date_period DATE NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    count_transactions INTEGER DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    avg_processing_time_ms DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(date_period, operation_type, status)
);

-- Índices para la tabla de estadísticas
CREATE INDEX IF NOT EXISTS idx_transaction_stats_date_period ON transaction_tracking.transaction_stats(date_period);
CREATE INDEX IF NOT EXISTS idx_transaction_stats_operation_status ON transaction_tracking.transaction_stats(operation_type, status);

-- Vista para consultas frecuentes de transacciones activas
CREATE OR REPLACE VIEW transaction_tracking.active_transactions AS
SELECT 
    id,
    transaction_id,
    message_id,
    operation_type,
    phone_number,
    amount,
    status,
    created_at,
    updated_at,
    processing_time_ms,
    error_message
FROM transaction_tracking.transaction_log
WHERE status IN ('PENDING', 'SUCCESS')
    AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Vista para estadísticas diarias
CREATE OR REPLACE VIEW transaction_tracking.daily_stats AS
SELECT 
    DATE(created_at) as transaction_date,
    operation_type,
    status,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(processing_time_ms) as avg_processing_time,
    MIN(created_at) as first_transaction,
    MAX(created_at) as last_transaction
FROM transaction_tracking.transaction_log
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at), operation_type, status
ORDER BY transaction_date DESC, operation_type, status;

-- Función para limpiar registros antiguos (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION transaction_tracking.cleanup_old_transactions(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM transaction_tracking.transaction_log
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep
        AND status NOT IN ('PENDING'); -- No eliminar transacciones pendientes
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentarios en las tablas y columnas principales
COMMENT ON TABLE transaction_tracking.transaction_log IS 'Registro completo de todas las transacciones realizadas con la integración de Nequi';
COMMENT ON COLUMN transaction_tracking.transaction_log.transaction_id IS 'ID de transacción proporcionado por Nequi';
COMMENT ON COLUMN transaction_tracking.transaction_log.message_id IS 'ID de mensaje generado internamente para cada solicitud';
COMMENT ON COLUMN transaction_tracking.transaction_log.operation_type IS 'Tipo de operación: SEND_PUSH, CANCEL_PUSH, GET_STATUS, REVERSE';
COMMENT ON COLUMN transaction_tracking.transaction_log.status IS 'Estado actual: PENDING, SUCCESS, FAILED, CANCELLED, REVERSED, TIMEOUT';
COMMENT ON COLUMN transaction_tracking.transaction_log.phone_number IS 'Número de teléfono (almacenado encriptado)';
COMMENT ON COLUMN transaction_tracking.transaction_log.request_payload IS 'Payload JSON enviado a Nequi';
COMMENT ON COLUMN transaction_tracking.transaction_log.response_payload IS 'Respuesta JSON recibida de Nequi';
COMMENT ON COLUMN transaction_tracking.transaction_log.parent_transaction_id IS 'ID de transacción padre para cancelaciones y reversiones';

