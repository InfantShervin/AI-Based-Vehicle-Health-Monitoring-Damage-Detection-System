resource "aws_iam_role" "lambda_role" {
  name = "vehicle_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "lambda_dynamodb" {
  name        = "LambdaDynamoDBAccess"
  description = "Allow Lambda to write to DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:GetItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.vehicle_telemetry.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb.arn
}

resource "aws_lambda_function" "iot_processor" {
  filename      = "lambda/iot_processor.zip"
  function_name = "VehicleIoTProcessor"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  source_code_hash = filebase64sha256("lambda/iot_processor.zip")

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.vehicle_telemetry.name
      BACKEND_URL    = "http://${aws_instance.prod_server.public_ip}:5000/api/iot-webhook"
      SECRET_TOKEN   = var.secret_token
    }
  }
}

variable "secret_token" {
  description = "Secret token for backend webhook authentication"
  type        = string
  default     = "super-secret-iot-token-2024"
  sensitive   = true
}
