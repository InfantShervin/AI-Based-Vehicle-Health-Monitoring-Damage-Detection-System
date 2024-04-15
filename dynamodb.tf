resource "aws_dynamodb_table" "vehicle_telemetry" {
  name           = "VehicleTelemetry"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "vin"
  range_key      = "timestamp"

  attribute {
    name = "vin"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  tags = {
    Name        = "VehicleTelemetryTable"
    Environment = "Production"
  }
}
