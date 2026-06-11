CREATE TABLE telemetry (
  id SERIAL PRIMARY KEY,
  temperature NUMERIC,
  humidity NUMERIC,
  extractor BOOLEAN,
  aire BOOLEAN,
  puerta INT,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO clusters(name, location)
VALUES
('Tandil','Argentina'),
('China','Beijing');
