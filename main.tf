provider "aws" {
  region = "us-east-1"
}

# Web Security Group
resource "aws_security_group" "web_sg" {
  name        = "vehicle-ai-sg"
  description = "Open ports for AI platform"

  ingress {
    from_port   = 22 # SSH
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80 # Frontend
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 5000 # Backend
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 8000 # ML-API
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 8888 # MQTT over WebSockets
    to_port     = 8888
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 1883 # Native MQTT
    to_port     = 1883
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 8080 # Jenkins Server
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# IAM Role for EC2 to access DynamoDB
resource "aws_iam_role" "ec2_dynamo_role" {
  name = "vehicle_ec2_dynamo_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_dynamo_attach" {
  role       = aws_iam_role.ec2_dynamo_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBReadOnlyAccess"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "vehicle_ec2_profile"
  role = aws_iam_role.ec2_dynamo_role.name
}

# Production EC2 Instance
resource "aws_instance" "prod_server" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS us-east-1
  instance_type = "t3.medium"
  vpc_security_group_ids = [aws_security_group.web_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name      = "devops-key"

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name = "Vehicle-Health-Production-Node"
  }
}

# Jenkins CI/CD Master Server
resource "aws_instance" "jenkins_master" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS us-east-1
  instance_type = "t3.medium"
  vpc_security_group_ids = [aws_security_group.web_sg.id]
  key_name      = "devops-key"

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name = "Jenkins-Master-Node"
  }
}

output "production_ip" {
  description = "Public IP of the Production Server"
  value       = aws_instance.prod_server.public_ip
}

output "jenkins_ip" {
  description = "Public IP of the Jenkins Master"
  value       = aws_instance.jenkins_master.public_ip
}
