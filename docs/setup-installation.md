# Setup and Installation Guide

This guide provides step-by-step instructions for setting up and running the Bleu POS System locally and in production environments.

## Prerequisites

### System Requirements
- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Memory**: Minimum 8GB RAM, recommended 16GB+
- **Storage**: 10GB free space
- **Network**: Stable internet connection for blockchain integration

### Software Dependencies
- **Python**: 3.8 or higher
- **Node.js**: 16.x or higher
- **SQL Server**: 2019 or higher (or SQL Server Express)
- **Git**: Latest version
- **Docker**: Optional, for containerized deployment

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd bleu-pos
```

### 2. Database Setup

#### Option A: SQL Server (Recommended)

1. **Install SQL Server**
   - Download and install SQL Server Express from Microsoft
   - Or use Docker: `docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong!Passw0rd" -p 1433:1433 --name sqlserver -d mcr.microsoft.com/mssql/server:2019-latest`

2. **Create Database**
   ```sql
   CREATE DATABASE BleuPOS;
   GO
   ```

3. **Configure Connection**
   - Update connection strings in each service's configuration
   - Example: `mssql+pyodbc://sa:YourStrong!Passw0rd@localhost:1433/BleuPOS?driver=ODBC+Driver+17+for+SQL+Server`

#### Option B: Local SQLite (Development Only)

Some services support SQLite for development:
```bash
# Create SQLite databases
touch Backend/SalesServices/sales.db
touch Backend/DiscountServices/discounts.db
```

### 3. Environment Configuration

Create `.env` files for each service:

#### Authentication Service (.env)
```env
DATABASE_URL=mssql+pyodbc://sa:YourStrong!Passw0rd@localhost:1433/AuthDB?driver=ODBC+Driver+17+for+SQL+Server
SECRET_KEY=your-super-secret-jwt-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

#### Sales Services (Backend/SalesServices/.env)
```env
DATABASE_URL=mssql+pyodbc://sa:YourStrong!Passw0rd@localhost:1433/BleuPOS?driver=ODBC+Driver+17+for+SQL+Server
BLOCKCHAIN_LOG_URL=http://localhost:9005/blockchain/log
USER_SERVICE_ME_URL=http://localhost:4000/auth/users/me
INGREDIENTS_DEDUCT_URL=http://127.0.0.1:8002/ingredients/deduct-from-sale
MATERIALS_DEDUCT_URL=http://127.0.0.1:8002/materials/deduct-from-sale
MERCHANDISE_DEDUCT_URL=http://127.0.0.1:8002/merchandise/deduct-from-sale
```

#### Blockchain Services (Backend/BlockchainServices/.env)
```env
DATABASE_URL=mssql+pyodbc://sa:YourStrong!Passw0rd@localhost:1433/BlockchainDB?driver=ODBC+Driver+17+for+SQL+Server
WEB3_PROVIDER_URL=https://rpc.buildbear.io/...
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=your-private-key
```

#### Other Services
Create similar `.env` files for each microservice with appropriate database URLs and service endpoints.

### 4. Backend Services Setup

#### Install Dependencies for Each Service

```bash
# For each backend service
cd Backend/ServiceName
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

#### Database Initialization

Run database migration scripts for each service:

```bash
# Example for Sales Services
cd Backend/SalesServices
python -c "from database import create_tables; create_tables()"
```

#### Start Services

Start each service in separate terminals:

```bash
# Sales Services (Port 9000)
cd Backend/SalesServices
python main.py

# Blockchain Services (Port 9005)
cd Backend/BlockchainServices
python main.py

# Discount Services (Port 7003)
cd Backend/DiscountServices
python main.py

# Notification Services (Port 9004)
cd Backend/NotificationServices
python main.py

# Receipt Services (Port 9003)
cd Backend/ReceiptServices
python main.py

# Session Services (Port 9001)
cd Backend/SessionServices
python main.py

# Waste Services (Port 9002)
cd Backend/WasteServices
python main.py
```

### 5. Frontend Setup

```bash
cd bleu-pos-main

# Install dependencies
npm install

# Start development server
npm start
```

The frontend will be available at `http://localhost:3000`

### 6. Authentication Service Setup

If you have a separate authentication service:

```bash
cd Backend/AuthService
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py  # Typically runs on port 4000
```

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Create docker-compose.yml** at project root:

```yaml
version: '3.8'

services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2019-latest
    environment:
      ACCEPT_EULA: Y
      SA_PASSWORD: YourStrong!Passw0rd
    ports:
      - "1433:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql

  sales-service:
    build: ./Backend/SalesServices
    ports:
      - "9000:9000"
    environment:
      - DATABASE_URL=mssql+pyodbc://sa:YourStrong!Passw0rd@sqlserver:1433/BleuPOS?driver=ODBC+Driver+17+for+SQL+Server
    depends_on:
      - sqlserver

  blockchain-service:
    build: ./Backend/BlockchainServices
    ports:
      - "9005:9005"
    environment:
      - DATABASE_URL=mssql+pyodbc://sa:YourStrong!Passw0rd@sqlserver:1433/BlockchainDB?driver=ODBC+Driver+17+for+SQL+Server
    depends_on:
      - sqlserver

  # Add other services similarly...

  frontend:
    build: ./bleu-pos-main
    ports:
      - "3000:3000"
    depends_on:
      - sales-service

volumes:
  sqlserver_data:
```

2. **Build and start services**:

```bash
docker-compose up --build -d
```

### Individual Docker Containers

```bash
# Build individual service
cd Backend/SalesServices
docker build -t sales-service .

# Run container
docker run -p 9000:9000 --env-file .env sales-service
```

## Production Deployment

### 1. Server Requirements

- **Web Server**: Nginx or Apache
- **SSL Certificate**: Let's Encrypt or commercial SSL
- **Database**: Dedicated SQL Server instance
- **Reverse Proxy**: Nginx for load balancing

### 2. Environment Configuration

- Use production-grade environment variables
- Configure proper logging
- Set up monitoring and alerting
- Enable HTTPS everywhere

### 3. Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Gateway/Service routing
    location /api/sales/ {
        proxy_pass http://localhost:9000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/blockchain/ {
        proxy_pass http://localhost:9005/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Add other service routes...
}
```

### 4. SSL Configuration

```bash
# Using Certbot for Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### 5. Process Management

Use PM2 or systemd for process management:

```bash
# Install PM2
npm install -g pm2

# Start services
pm2 start Backend/SalesServices/main.py --name sales-service
pm2 start Backend/BlockchainServices/main.py --name blockchain-service

# Save configuration
pm2 save
pm2 startup
```

## Database Schema Setup

### Initial Schema Creation

Run the following SQL scripts in order:

1. **Users and Authentication Tables**
2. **Products and Inventory Tables**
3. **Sales and Transactions Tables**
4. **Discounts and Promotions Tables**
5. **Sessions and Reports Tables**

### Seed Data

Populate initial data:

```sql
-- Insert default admin user
INSERT INTO Users (username, password_hash, role, is_active)
VALUES ('admin', '$2b$12$...', 'admin', 1);

-- Insert sample products
INSERT INTO Products (name, category, price, stock_quantity)
VALUES ('Americano', 'Coffee', 3.50, 100);
```

## Testing the Installation

### Health Checks

1. **Service Health Endpoints**:
   - Sales: `http://localhost:9000/`
   - Blockchain: `http://localhost:9005/health`
   - All services should return status "ok"

2. **API Documentation**:
   - Sales: `http://localhost:9000/docs`
   - Blockchain: `http://localhost:9005/docs`

### Functional Testing

1. **Frontend Access**: `http://localhost:3000`
2. **User Login**: Test authentication flow
3. **Basic Sale**: Create a test sale transaction
4. **Blockchain Logging**: Verify transaction logging

### Performance Testing

```bash
# Load testing with Apache Bench
ab -n 1000 -c 10 http://localhost:9000/

# Memory and CPU monitoring
htop  # or task manager
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check SQL Server is running
   - Verify connection string
   - Ensure ODBC drivers are installed

2. **Service Won't Start**
   - Check Python dependencies
   - Verify environment variables
   - Check port availability

3. **Frontend Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version
   - Verify build configuration

4. **Blockchain Integration Issues**
   - Check BuildBear RPC URL
   - Verify contract address and ABI
   - Confirm wallet has sufficient funds

### Logs and Debugging

```bash
# View service logs
tail -f Backend/SalesServices/logs/app.log

# Docker logs
docker logs sales-service

# Check running processes
ps aux | grep python
```

### Network Connectivity

```bash
# Test service connectivity
curl http://localhost:9000/
curl http://localhost:9005/health

# Check port availability
netstat -tlnp | grep :9000
```

## Security Checklist

- [ ] Change default passwords
- [ ] Enable HTTPS
- [ ] Configure firewall rules
- [ ] Set up log monitoring
- [ ] Enable database encryption
- [ ] Configure backup strategy
- [ ] Set up intrusion detection
- [ ] Regular security updates

## Backup and Recovery

### Database Backup

```bash
# SQL Server backup
sqlcmd -S localhost -U sa -P 'YourPassword' -Q "BACKUP DATABASE BleuPOS TO DISK = '/var/backups/bleupos.bak'"
```

### Configuration Backup

```bash
# Backup environment files
tar -czf config_backup.tar.gz */.env
```

### Recovery Procedure

1. Restore database from backup
2. Restore configuration files
3. Restart all services
4. Verify system functionality

## Support and Resources

- **Documentation**: See other docs in this folder
- **API Docs**: Available at `/docs` endpoint for each service
- **Logs**: Check service logs for error details
- **Community**: GitHub issues and discussions

---

*For development information, see the [Developer Guide](./developer-guide.md).*
*For API documentation, see the [API Reference](./api-reference.md).*
