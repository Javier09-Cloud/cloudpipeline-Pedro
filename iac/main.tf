###############################################
# CloudTopia Mini Infrastructure - Pedro Izquierdo
# Purpose: Simple web VM + network on AWS
###############################################

# ----- 1. Specify the provider (AWS) -----
provider "aws" {
  region = "us-east-1"   # You can change to your sandbox region if needed
}

# ----- 2. Create a VPC -----
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "cloudtopia-vpc"
  }
}

# ----- 3. Create a Subnet -----
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "us-east-1a"
  tags = {
    Name = "cloudtopia-public-subnet"
  }
}

# ----- 4. Internet Gateway -----
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "cloudtopia-igw"
  }
}

# ----- 5. Route Table + Association -----
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = {
    Name = "cloudtopia-public-rt"
  }
}

resource "aws_route_table_association" "a" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public_rt.id
}

# ----- 6. Security Group (allow HTTP) -----
resource "aws_security_group" "web_sg" {
  name        = "allow_http"
  description = "Allow inbound HTTP"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudtopia-web-sg"
  }
}

# ----- 7. EC2 Instance -----
resource "aws_instance" "web" {
  ami           = "ami-08c40ec9ead489470"  # Amazon Linux 2 AMI (us-east-1)
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              sudo yum update -y
              sudo amazon-linux-extras install nginx1 -y
              sudo systemctl enable nginx
              sudo systemctl start nginx
              EOF

  tags = {
    Name = "cloudtopia-web"
  }
}

# ----- 8. Outputs -----
output "web_public_ip" {
  description = "Public IP of the web server"
  value       = aws_instance.web.public_ip
}
