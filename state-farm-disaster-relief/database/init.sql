-- CrisMin database schema
-- PostgreSQL with PostGIS extension for spatial disaster zone mapping

CREATE EXTENSION IF NOT EXISTS postgis;

-- Claims table: stores raw telemetry, normalized severity, and spatial location
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    claim_id VARCHAR(64) UNIQUE NOT NULL,
    raw_report TEXT NOT NULL,
    severity_score FLOAT NOT NULL DEFAULT 2.0,
    geographic_description VARCHAR(255),
    latitude FLOAT,
    longitude FLOAT,
    location GEOGRAPHY(POINT, 4326),
    resource_demand VARCHAR(255),
    status VARCHAR(32) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Response units: tracks CRUs, vehicle types, locations, and status
CREATE TABLE IF NOT EXISTS response_units (
    id SERIAL PRIMARY KEY,
    unit_id VARCHAR(64) UNIQUE NOT NULL,
    unit_type VARCHAR(64) NOT NULL,
    current_latitude FLOAT,
    current_longitude FLOAT,
    current_location GEOGRAPHY(POINT, 4326),
    status VARCHAR(32) DEFAULT 'idle',
    assigned_claim_id VARCHAR(64),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimization logs: records QUBO configurations and results
CREATE TABLE IF NOT EXISTS optimization_logs (
    id SERIAL PRIMARY KEY,
    run_id VARCHAR(64) UNIQUE NOT NULL,
    total_nodes INTEGER NOT NULL,
    available_units INTEGER NOT NULL,
    best_energy FLOAT NOT NULL,
    deployment_vector JSONB NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for spatial and lookup performance
CREATE INDEX IF NOT EXISTS idx_claims_location ON claims USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_claims_severity ON claims (severity_score);
CREATE INDEX IF NOT EXISTS idx_response_units_location ON response_units USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_executed ON optimization_logs (executed_at);
