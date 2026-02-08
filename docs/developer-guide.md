# Developer Guide

This guide provides comprehensive information for developers working on the Bleu POS System.

## System Architecture

### Microservices Overview

The Bleu POS System follows a microservices architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Authentication │    │   SQL Database  │
│     (Port 3000) │◄──►│   Service       │◄──►│                 │
│                 │    │   (Port 4000)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Sales Services │    │Blockchain Logger│    │Discount Services│
│   (Port 9000)   │    │  (Port 9005)    │    │  (Port 7003)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Notification Svc │    │ Receipt Service│    │Session Services │
│  (Port 9004)    │    │  (Port 9003)    │    │  (Port 9001)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Waste Services  │
│  (Port 9002)    │
└─────────────────┘
```

### Technology Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React.js
- **Database**: SQL Server
- **Authentication**: JWT tokens
- **Blockchain**: BuildBear (for activity logging)
- **Communication**: REST APIs, WebSockets
- **Deployment**: Docker (optional)

## Development Environment Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- SQL Server (local or Docker)
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bleu-pos
   ```

2. **Set up Python virtual environments**
   ```bash
   # For each backend service
   cd Backend/ServiceName
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   venv\Scripts\activate     # Windows
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   Create `.env` files in each service directory with appropriate values.

4. **Set up the database**
   - Create a SQL Server database
   - Run schema creation scripts
   - Populate with seed data if available

5. **Start services in development mode**
   ```bash
   # Each service
   python main.py
   ```

## Code Organization

### Backend Services Structure

Each microservice follows this structure:

```
ServiceName/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── Dockerfile             # Container configuration
├── routers/               # API route handlers
│   ├── router_name.py
│   └── __init__.py
├── database.py            # Database connection utilities
├── cert.pem               # SSL certificate (if needed)
├── key.pem                # SSL private key (if needed)
└── uploads/               # File upload directory
```

### Frontend Structure

```
bleu-pos-main/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── home/          # Admin/manager components
│   │   ├── cashier/       # Cashier interface components
│   │   └── shared/        # Common components
│   ├── App.js             # Main application component
│   ├── index.js           # Application entry point
│   └── setupTests.js      # Test configuration
├── package.json           # Node.js dependencies
└── Dockerfile             # Frontend container
```

## API Design Patterns

### RESTful Endpoints

All APIs follow REST conventions:

- `GET /resource` - List resources
- `GET /resource/{id}` - Get specific resource
- `POST /resource` - Create new resource
- `PUT /resource/{id}` - Update resource
- `DELETE /resource/{id}` - Delete resource

### Authentication & Authorization

```python
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token-url")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # Validate JWT token
    # Return user information
    pass

async def require_role(required_role: str):
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("userRole") != required_role:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker
```

### Error Handling

Standard error response format:

```python
from fastapi import HTTPException

# Bad Request
raise HTTPException(status_code=400, detail="Invalid input data")

# Unauthorized
raise HTTPException(status_code=401, detail="Authentication required")

# Forbidden
raise HTTPException(status_code=403, detail="Access denied")

# Not Found
raise HTTPException(status_code=404, detail="Resource not found")

# Internal Server Error
raise HTTPException(status_code=500, detail="Internal server error")
```

### Database Operations

Using async SQL operations:

```python
import aiosql

async def get_db_connection():
    # Return database connection
    pass

async def create_sale(sale_data: dict):
    conn = await get_db_connection()
    try:
        async with conn.cursor() as cursor:
            # Execute SQL operations
            await cursor.execute("INSERT INTO Sales ...", parameters)
            await conn.commit()
    except Exception as e:
        await conn.rollback()
        raise
    finally:
        await conn.close()
```

## Blockchain Integration

### Activity Logging

All critical operations are logged to blockchain:

```python
async def log_to_blockchain(
    service_identifier: str,
    action: str,  # CREATE, UPDATE, DELETE
    entity_type: str,
    entity_id: int,
    actor_username: str,
    change_description: str,
    data: dict
):
    # Send to blockchain service
    pass
```

### Smart Contract Events

The system integrates with BuildBear blockchain for:
- Sale transaction logging
- User activity tracking
- Audit trail maintenance

## Testing

### Unit Tests

```python
import pytest
from fastapi.testclient import TestClient

def test_create_sale():
    client = TestClient(app)
    response = client.post("/sales/", json=sale_data)
    assert response.status_code == 201
    assert "saleId" in response.json()
```

### Integration Tests

```python
def test_full_sale_workflow():
    # Test complete sale process
    # Create sale -> Process payment -> Generate receipt
    pass
```

### Running Tests

```bash
# Backend tests
pytest

# Frontend tests
npm test
```

## Deployment

### Docker Deployment

Each service includes a Dockerfile:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 9000

CMD ["python", "main.py"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  sales-service:
    build: ./Backend/SalesServices
    ports:
      - "9000:9000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - database
```

### Production Considerations

1. **Environment Variables**: Never commit secrets
2. **Health Checks**: Implement proper health endpoints
3. **Logging**: Configure structured logging
4. **Monitoring**: Set up metrics collection
5. **Security**: Enable HTTPS, input validation, rate limiting

## Contributing Guidelines

### Branching Strategy

- `master`: Production-ready code
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Critical production fixes

### Code Standards

#### Python
- Follow PEP 8 style guide
- Use type hints
- Write docstrings for functions
- Maximum line length: 88 characters

#### JavaScript/React
- Use ESLint configuration
- Follow React best practices
- Use functional components with hooks
- Implement proper error boundaries

### Commit Messages

Format: `type(scope): description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

### Pull Request Process

1. Create feature branch from `master`
2. Implement changes with tests
3. Update documentation if needed
4. Submit pull request with description
5. Code review and approval
6. Merge to `master`

## Performance Optimization

### Database Optimization

1. **Indexes**: Create appropriate indexes
2. **Connection Pooling**: Use connection pools
3. **Query Optimization**: Avoid N+1 queries
4. **Caching**: Implement Redis for frequently accessed data

### API Optimization

1. **Pagination**: Implement pagination for large datasets
2. **Compression**: Enable gzip compression
3. **Rate Limiting**: Prevent abuse
4. **Async Operations**: Use async/await for I/O operations

### Frontend Optimization

1. **Code Splitting**: Lazy load components
2. **Bundle Analysis**: Optimize bundle size
3. **Caching**: Implement service worker caching
4. **Image Optimization**: Compress and lazy load images

## Security Best Practices

### Authentication
- Use strong JWT secrets
- Implement token expiration
- Validate tokens on each request

### Authorization
- Role-based access control
- Principle of least privilege
- Input validation and sanitization

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS in production
- Implement proper CORS policies

### API Security
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection

## Monitoring and Logging

### Application Logs

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
logger.info("Operation completed successfully")
```

### Health Checks

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }
```

### Metrics

Consider implementing:
- Response times
- Error rates
- Database connection pool status
- Memory usage
- Active connections

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check connection string
   - Verify database server is running
   - Check network connectivity

2. **Service Communication**
   - Verify service URLs in environment variables
   - Check service health endpoints
   - Review network configuration

3. **Authentication Problems**
   - Validate JWT token format
   - Check token expiration
   - Verify user roles and permissions

### Debugging Tools

1. **API Testing**: Postman, Insomnia
2. **Database**: SQL Server Management Studio
3. **Logs**: Centralized logging system
4. **Monitoring**: Application Performance Monitoring (APM) tools

## Future Enhancements

### Planned Features
- Mobile application
- Advanced analytics dashboard
- Multi-location support
- Integration with third-party services
- Enhanced reporting capabilities

### Technology Upgrades
- GraphQL API implementation
- Kubernetes orchestration
- CI/CD pipeline improvements
- Advanced caching strategies

---

*For API documentation, see the [API Reference](./api-reference.md).*
*For setup instructions, see the [Setup and Installation](./setup-installation.md).*
