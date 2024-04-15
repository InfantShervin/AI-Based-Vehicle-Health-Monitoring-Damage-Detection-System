# IoT Topic Rule to trigger Lambda
resource "aws_iot_topic_rule" "telemetry_rule" {
  name        = "VehicleTelemetryRule"
  description = "Route vehicle telemetry to Lambda"
  enabled     = true
  sql         = "SELECT * FROM 'vehicle/telemetry'"
  sql_version = "2016-03-23"

  lambda {
    function_arn = aws_lambda_function.iot_processor.arn
  }
}

# Lambda Permission for IoT Core
resource "aws_lambda_permission" "allow_iot" {
  statement_id  = "AllowExecutionFromIoT"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.iot_processor.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.telemetry_rule.arn
}

# IAM Role for IoT (Optional if just triggering Lambda, but good for logging)
resource "aws_iam_role" "iot_role" {
  name = "vehicle_iot_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "iot.amazonaws.com"
        }
      }
    ]
  })
}
