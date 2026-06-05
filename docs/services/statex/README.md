# StateX - AI-Powered Business Automation Platform

## 🎯 **Overview**

StateX is a comprehensive **AI-powered business automation platform** that provides rapid prototype generation, intelligent analysis, and comprehensive business solutions for the EU and UAE markets. Built on a modern microservices architecture, StateX transforms business ideas into digital solutions through AI agents and automated workflows.

## 🏗️ **Architecture Overview**

StateX follows a **distributed microservices architecture** with clear separation of concerns, enabling scalability, maintainability, and independent deployment of services.

```text
┌─────────────────────────────────────────────────────────────────┐
│                        StateX Ecosystem                         │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Layer                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Website       │  │   Admin Panel   │  │   Mobile App    │  │
│  │   (Next.js)     │  │   (React)       │  │   (React Native)│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway & Infrastructure                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Load Balancer │  │    SSL/TLS      │  │   Service       │  │
│  │   (External)    │  │   (External)    │  │   Discovery     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Platform Services (Orchestration Layer)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   StateX        │  │   Infrastructure│  │
│  │   Platform      │  │   Service       │  │   Management    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Business Services (Core Functionality)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   AI Services   │  │   Notification  │  │   Website       │  │
│  │   (ai-microservice)│  │   Service       │  │   (statex-      │  │
│  │                 │  │                 │  │    website)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure Services (Data & Communication)                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   PostgreSQL    │  │   Redis         │  │   RabbitMQ      │  │
│  │   (Database)    │  │   (Cache)       │  │   (Message      │  │
│  │                 │  │                 │  │    Queue)       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 **Microservices Architecture**

## 🔌 Port Configuration

**Port Range**: 36xx (statex application)

Services use Kubernetes service DNS in the 36xx range, mapping to standard container ports:

### Core Platform Services

| Service | Host Port | Container Port | Description |
| ------ | ------- | ------------ | ---------- |
| **Platform Management** | `${PLATFORM_MANAGEMENT_PORT:-3600}` | `${PLATFORM_MANAGEMENT_INTERNAL_PORT:-8000}` | Central orchestration |
| **API Gateway** | `${API_GATEWAY_EXTERNAL_PORT:-3601}` | `${API_GATEWAY_INTERNAL_PORT:-80}` | Unified API access point |
| **Frontend** | `${FRONTEND_PORT:-3602}` | `${FRONTEND_INTERNAL_PORT:-3000}` | Next.js frontend application |

### Website Services (statex-website)

| Service | Host Port | Container Port | Description |
| ------ | ------- | ------------ | ---------- |
| **Submission Service** | `${SUBMISSION_SERVICE_PORT:-3603}` | `${SUBMISSION_SERVICE_INTERNAL_PORT:-8000}` | Form submission and file handling |
| **User Portal** | `${USER_PORTAL_PORT:-3606}` | `${USER_PORTAL_INTERNAL_PORT:-8000}` | User management and authentication |
| **Content Service** | `${CONTENT_SERVICE_EXTERNAL_PORT:-3609}` | `${CONTENT_SERVICE_INTERNAL_PORT:-8000}` | Content management |

### AI Services (ai-microservice)

**Note**: AI services are now managed as a separate microservice at `ai-microservice/`. All services support blue/green deployments and are accessible via `https://ai.alfares.cz`.

| Service | Host Port | Container Port | Description |
| ------ | ------- | ------------ | ---------- |
| **AI Orchestrator** | `${AI_ORCHESTRATOR_PORT:-3380}` | `${AI_ORCHESTRATOR_PORT:-3380}` | Central AI coordination |
| **NLP Service** | `${NLP_SERVICE_PORT:-3381}` | `${NLP_SERVICE_PORT:-3381}` | Natural language processing |
| **ASR Service** | `${ASR_SERVICE_PORT:-3382}` | `${ASR_SERVICE_PORT:-3382}` | Speech-to-text conversion |
| **Document AI** | `${DOCUMENT_AI_PORT:-3383}` | `${DOCUMENT_AI_PORT:-3383}` | Document analysis and OCR |
| **Prototype Generator** | `${PROTOTYPE_GENERATOR_PORT:-3384}` | `${PROTOTYPE_GENERATOR_PORT:-3384}` | Prototype generation |
| **Template Repository** | `${TEMPLATE_REPOSITORY_PORT:-3385}` | `${TEMPLATE_REPOSITORY_PORT:-3385}` | Template management |
| **Free AI Service** | `${FREE_AI_SERVICE_PORT:-3386}` | `${FREE_AI_SERVICE_PORT:-3386}` | Free AI processing |
| **AI Workers** | `${AI_WORKERS_PORT:-3387}` | `${AI_WORKERS_PORT:-3387}` | AI processing workers |
| **Gemini AI Service** | `${GEMINI_AI_SERVICE_PORT:-3388}` | `${GEMINI_AI_SERVICE_PORT:-3388}` | Google Gemini AI integration |
| **Data Viz Service** | `${DATA_VIZ_SERVICE_PORT:-3389}` | `${DATA_VIZ_SERVICE_PORT:-3389}` | Data visualization service |

**Access**:

- **Production**: `https://ai.alfares.cz`
- **Docker Network**: `http://ai-microservice:${AI_ORCHESTRATOR_PORT:-3380}` (port configured in `ai-microservice/.env`)

### Infrastructure Services (statex-infrastructure)

| Service | Host Port | Container Port | Description |
| ------ | ------- | ------------ | ---------- |
| **RabbitMQ** | `${RABBITMQ_PORT:-5672}` | `${RABBITMQ_PORT:-5672}` | Message queue (AMQP) |
| **RabbitMQ Management** | `${RABBITMQ_MANAGEMENT_PORT:-15672}` | `${RABBITMQ_MANAGEMENT_PORT:-15672}` | RabbitMQ web UI |
| **MinIO** | `${MINIO_EXTERNAL_PORT:-3620}` | `${MINIO_INTERNAL_PORT:-9000}` | Object storage API |
| **MinIO Console** | `${MINIO_CONSOLE_PORT:-3621}` | `${MINIO_CONSOLE_INTERNAL_PORT:-9001}` | MinIO web console |
| **Elasticsearch** | `${ELASTICSEARCH_PORT:-9200}` | `${ELASTICSEARCH_PORT:-9200}` | Search engine |

### Additional Services

| Service | Host Port | Container Port | Description |
| ------ | ------- | ------------ | ---------- |
| **Dashboard** | `${DASHBOARD_PORT:-3626}` | `${DASHBOARD_INTERNAL_PORT:-8020}` | Service management dashboard |
| **DNS Service** (HTTP API) | `${DNS_SERVICE_EXTERNAL_PORT:-8053}` | `${DNS_SERVICE_INTERNAL_PORT:-8053}` | DNS service HTTP API |
| **DNS Service** (DNS Server) | `${DNS_SERVER_PORT:-5353}` | `${DNS_SERVER_PORT:-5353}` | DNS server (UDP/TCP) |

**Note**:

- PostgreSQL and Redis are provided by shared **database-server** via Kubernetes service DNS: `db-server-postgres:5432` and `db-server-redis:6379`
- All ports are exposed on `127.0.0.1` only (localhost) for security
- External access is provided via nginx-microservice reverse proxy

### **1. StateX Platform** (`statex-platform`)

**Purpose**: Central orchestration and management hub
**Repository**: `git@github.com:speakASAP/statex-platform.git`
**Ports**: ${PLATFORM_MANAGEMENT_PORT:-3600} (Platform Management), ${API_GATEWAY_EXTERNAL_PORT:-3601} (API Gateway)

**Responsibilities**:

- Central orchestration and coordination of all microservices
- API Gateway for unified service access
- Integration with external services
- Management of AI services and notification service

**Key Services**:

- **Platform Management** (${PLATFORM_MANAGEMENT_PORT:-3600}): Central orchestration and coordination
- **API Gateway** (${API_GATEWAY_EXTERNAL_PORT:-3601}): Unified API access point for all services

**Technology Stack**:

- FastAPI (Python)
- PostgreSQL (Database)
- Redis (Cache)
- RabbitMQ (Message Queue)
- Docker & Kubernetes

---

### **2. AI Microservice** (`ai-microservice`)

**Purpose**: AI processing and intelligent analysis (now separate microservice)
**Location**: `~/Documents/Github/ai-microservice` (root level, separate from statex)
**Ports**: ${AI_ORCHESTRATOR_PORT:-3380}-${DATA_VIZ_SERVICE_PORT:-3389} (host and container ports match)
**Access**: `https://ai.alfares.cz` (production), `http://ai-microservice:3380` (Docker network)
**Management**: Independent microservice, called by statex-platform via HTTP

**Responsibilities**:

- AI workflow orchestration
- Natural language processing
- Speech-to-text conversion
- Document analysis and OCR
- Prototype generation
- Template management
- AI worker management

**AI Services**:

- **AI Orchestrator** (${AI_ORCHESTRATOR_PORT:-3380}): Central coordination
- **NLP Service** (${NLP_SERVICE_PORT:-3381}): Text analysis and generation
- **ASR Service** (${ASR_SERVICE_PORT:-3382}): Speech-to-text conversion
- **Document AI** (${DOCUMENT_AI_PORT:-3383}): File processing and OCR
- **Prototype Generator** (${PROTOTYPE_GENERATOR_PORT:-3384}): Website/app creation
- **Template Repository** (${TEMPLATE_REPOSITORY_PORT:-3385}): Template management
- **Free AI Service** (${FREE_AI_SERVICE_PORT:-3386}): Ollama, Hugging Face models
- **AI Workers** (${AI_WORKERS_PORT:-3387}): AI processing agents
- **Gemini AI Service** (${GEMINI_AI_SERVICE_PORT:-3388}): Google Gemini AI integration
- **Data Viz Service** (${DATA_VIZ_SERVICE_PORT:-3389}): Data visualization service

**Technology Stack**:

- FastAPI (Python)
- OpenAI GPT-4, Anthropic Claude
- Ollama (Local LLM)
- Hugging Face API
- Tesseract OCR, Unstructured
- Next.js (Admin Panel)

---

- Email notifications (SMTP)
- WhatsApp Business API integration
- Telegram Bot API integration
- Notification templates and formatting
- Delivery tracking and analytics

**Supported Channels**:

- 📧 **Email**: StateX mailserver (<contact@alfares.cz>)
- 📱 **WhatsApp**: WhatsApp Business API
- ✈️ **Telegram**: Telegram Bot API

**Technology Stack**:

- FastAPI (Python)
- SMTP (Email)
- WhatsApp Business API
- Telegram Bot API
- Docker & Kubernetes

---

### **4. StateX Website** (`statex-website`)

**Purpose**: Frontend website and core business services
**Repository**: `git@github.com:speakASAP/statex-website.git`
**Ports**: ${FRONTEND_PORT:-3602} (Frontend), ${SUBMISSION_SERVICE_PORT:-3603} (Submission Service), ${USER_PORTAL_PORT:-3606} (User Portal), ${CONTENT_SERVICE_EXTERNAL_PORT:-3609} (Content Service)
**Management**: Self-managed with orchestration support from statex-platform

**Responsibilities**:

- Main website (alfares.cz)
- Contact forms and user interaction
- Content management and blog
- User portal and authentication (via auth-microservice)
- Form submission processing
- SEO optimization
- Static site generation

**Authentication**:

- Uses centralized `auth-microservice` for user registration and authentication
- Supports contact-based registration (email/phone without password)
- JWT tokens generated and validated by auth-microservice

**Components**:

- **Frontend** (${FRONTEND_PORT:-3602}): Next.js with TypeScript
- **Submission Service** (${SUBMISSION_SERVICE_PORT:-3603}): Form submission and file handling
- **User Portal** (${USER_PORTAL_PORT:-3606}): User management and authentication
- **Content Service** (${CONTENT_SERVICE_EXTERNAL_PORT:-3609}): Content management and blog
- **Content**: Blog posts, pages, documentation
- **Design System**: Component library

**Technology Stack**:

- Next.js (React/TypeScript)
- Node.js/Fastify (Backend)
- Prisma (Database ORM)
- Tailwind CSS (Styling)

---

### **5. StateX Infrastructure** (`statex-infrastructure`)

**Purpose**: Core messaging, storage, and search infrastructure services
**Repository**: `git@github.com:speakASAP/statex-infrastructure.git`

**Responsibilities**:

- Message queue (RabbitMQ)
- Object storage (MinIO)
- Search engine (Elasticsearch)
- Integration with shared `database-server` for PostgreSQL and Redis

**NOTE**: Nginx webserver and SSL certificate management are now handled by the separate nginx-microservice.

**Technology Stack**:

- RabbitMQ (Message Queue)
- MinIO (Object Storage)
- Elasticsearch (Search)
- Docker & Kubernetes

---

## 🔄 **Data Flow Architecture**

### **User Submission Workflow**

```text
1. User visits alfares.cz (Website)
2. Fills contact form with text, voice, files
3. Form submission → StateX Platform (API Gateway)
4. Platform routes to AI Services (ai-microservice)
5. AI agents process submission:
   - ASR Service: Voice → Text
   - Document AI: File analysis
   - NLP Service: Text analysis
   - Free AI Service: Business analysis
6. AI Orchestrator combines results
7. Notification Service sends updates via Telegram/Email/WhatsApp
8. Admin Panel for human review (optional)
9. Final results delivered to user
```

### **AI Processing Pipeline**

```text
User Input → AI Orchestrator → Parallel AI Processing:
├── Free AI Service (Ollama/Hugging Face)
├── NLP Service (OpenAI/Anthropic)
├── ASR Service (Whisper)
├── Document AI (OCR/Unstructured)
└── Template Repository (Matching)

→ Results Aggregation → Notification Service → User
```

## 🚀 **Quick Start**

### **Prerequisites**

- Docker and Kubernetes
- Node.js 23.11.0 (for frontend development)
- Python 3.11 (for backend development)
- Git
- Domain name (for production)
- API keys (OpenAI, WhatsApp, Telegram)

### **⚡ Optimized Development Setup (2-3 minutes)**

StateX now uses a **hybrid Docker + Local development approach** for maximum speed:

```bash
# Clone all repositories
git clone git@github.com:speakASAP/statex-platform.git
git clone git@github.com:speakASAP/ai-microservice.git
git clone git@github.com:speakASAP/statex-website.git
git clone git@github.com:speakASAP/statex-infrastructure.git

# Quick start with optimized development environment
cd statex-platform
cp ../env.development.template .env.development
# Edit .env.development with your API keys

# Start all services (infrastructure in Docker + apps with volume mounts)
./dev-manage.sh start

# Access your services:
# - Website: http://localhost:${FRONTEND_PORT:-3602}
# - API Gateway: http://localhost:${API_GATEWAY_EXTERNAL_PORT:-3601}
# - AI Orchestrator: http://localhost:${AI_ORCHESTRATOR_PORT:-3380} (or https://ai.alfares.cz)
```

### **🔧 Development Management**

**New optimized development workflow:**

- **Start all services**: `./dev-manage.sh start` (2-3 minutes vs 1+ hour)
- **Start individual service**: `./dev-manage.sh dev [service-name]`
- **Stop all services**: `./dev-manage.sh stop`
- **Check status**: `./dev-manage.sh status`
- **View logs**: `./dev-manage.sh logs [service]`
- **Health check**: `./dev-manage.sh health`

### **🚀 Development Optimization Benefits**

The new hybrid development approach provides significant improvements:

| Metric | Before | After | Improvement |
| ----- | ---- | --- | ---------- |
| **Startup Time** | 60+ minutes | 2-3 minutes | **20x faster** |
| **Code Changes** | 20+ minutes | Instant | **∞ faster** |
| **Resource Usage** | ~4GB RAM | ~1GB RAM | **75% reduction** |
| **File System** | Docker overlay | Native | **5-10x faster** |

**Architecture:**

- **Infrastructure Services**: Kubernetes service DNS for Postgres, Redis, RabbitMQ, and MinIO
- **Application Services**: Volume mounts with hot reload (Frontend, AI, Backend)
- **Webserver**: Handled by separate nginx-microservice
- **Best of Both Worlds**: Containerization benefits + development speed

### **Production Deployment**

```bash
# Deploy infrastructure
cd statex-infrastructure
make prod

# Deploy all services
cd statex-platform
make deploy-prod
```

## 📊 **Logging & Observability**

### **Key Metrics**

- **System Performance**: CPU, memory, disk usage
- **Application Metrics**: Request rates, response times, error rates
- **Business Metrics**: User submissions, AI processing time, notification delivery
- **AI Agent Performance**: Processing time, success rates, model accuracy

### **Logging**

- **Centralized Logging**: All services log to centralized logging system
- **Service Health**: Health check endpoints for all services
- **Business Metrics**: User engagement and conversion
- **Infrastructure**: Resource usage and capacity

### **Alerting**

- **Critical**: Service down, high error rates
- **Warning**: High response times, resource usage
- **Info**: Deployments, capacity planning

## 🔒 **Security**

### **Authentication & Authorization**

- **Centralized Authentication**: Uses shared `auth-microservice` (`https://auth.alfares.cz`) for all authentication operations
- **JWT tokens**: Generated and validated by auth-microservice
- **Contact-Based Registration**: Supports both email/password and contact-based (email/phone) registration systems
- **Password Management**: Password reset/change handled by auth-microservice with email notifications
- **OAuth 2.0**: For third-party integration
- **Role-based access control (RBAC)**: User roles managed by auth-microservice
- **Multi-factor authentication (MFA)**: Planned for future implementation

### **Data Protection**

- Encryption at rest and in transit
- GDPR compliance for EU users
- PII handling and anonymization
- Comprehensive audit logging

### **Network Security**

- TLS/SSL for all communications
- mTLS for service-to-service communication
- Network segmentation
- DDoS protection

## 🌍 **Deployment Environments**

### **Development**

- Local Kubernetes
- Self-signed SSL certificates
- Mock external services
- Debug logging enabled

### **Staging**

- Kubernetes with production-like configuration
- Let's Encrypt certificates
- Production-like configuration
- Performance testing

### **Production**

- Kubernetes with high availability setup
- High availability setup
- Production SSL certificates

## 📈 **Scaling Strategy**

### **Horizontal Scaling**

- Microservices can scale independently
- Load balancing across multiple instances
- Database read replicas
- CDN for static content

### **Vertical Scaling**

- Resource optimization per service
- Memory and CPU tuning
- Database query optimization
- Caching strategies

## 🤝 **Contributing**

### **Development Workflow**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and documentation
5. Submit a pull request

### **Code Standards**

- Python: PEP 8, type hints, docstrings
- TypeScript: ESLint, Prettier
- Docker: Multi-stage builds, security scanning
- Documentation: Markdown, API documentation

## 📚 **Documentation**

### **Service Documentation**

- [StateX Architecture diagram](./ARCHITECTURE_DIAGRAM.md)
- [StateX Platform](./statex-platform/README.md)
- [StateX AI](../ai-microservice/README.md) - External AI microservice
- [StateX Website](./statex-website/README.md)
- [StateX Infrastructure](./statex-infrastructure/README.md)

### **Centralized Logging**

Statex uses the **shared logging-microservice** for centralized logging:

- **Production URL**: `https://logging.alfares.cz`
- **Docker/Development URL**: `http://logging-microservice:${LOGGING_SERVICE_PORT:-3367}`
- **Logger Utilities**: `utils/logger.py` (Python), `utils/centralized-logger.js` (Node.js), `utils/logger.ts` (TypeScript)
- **Configuration**: `.env` (`LOG_LEVEL`, `LOG_TIMESTAMP_FORMAT`, `LOG_TO_FILE`, `LOG_TO_CONSOLE`, `LOGGING_SERVICE_URL`)
- **All Services**: Automatically send logs to the shared logging-microservice via HTTP POST to `/api/logs`
- **Local Fallback**: Logs are also written to local `logs/` directory for redundancy
- **Documentation**: See `docs/CENTRALIZED_LOGGING_STRATEGY.md` for detailed information

### **Architecture Documentation**

- [Complete Architecture Diagram](./ARCHITECTURE_DIAGRAM.md) - Visual representation of all services and their relationships

### **Legal & Compliance**

- [E-commerce Compliance (Povinný standard pro e-commerce)](./docs/ecommerce-compliance.md) - Czech e-commerce rules checklist for alfares.cz (contact info, OP, GDPR, e-shop URL)

### **AI & Workflow Documentation**

- [AI Providers Configuration](./docs/development/ai-providers.md) - Complete guide to AI providers, model selection, and configuration
- [Multi-Agent Workflow System](./docs/development/multi-agent-workflow.md) - Detailed documentation of the multi-agent workflow system
- [Workflow Order and Dependencies](./docs/development/workflow-order.md) - Workflow execution order and dependency management
- [Contact Types and User Identification](./docs/development/contact-types.md) - Support for email, LinkedIn, WhatsApp, and Telegram contacts
- [OpenRouter Setup Guide](./docs/OPENROUTER_SETUP_GUIDE.md) - Step-by-step OpenRouter integration guide
- [Quick Reference Guide](./docs/development/quick-reference.md) - Quick access to common tasks and configurations

### **API Documentation**

- **API Gateway**: <http://localhost:${API_GATEWAY_EXTERNAL_PORT:-3601}> (unified access to all services)
- **Platform Management**: <http://localhost:${PLATFORM_MANAGEMENT_PORT:-3600}/docs>
- **AI Orchestrator**: <https://ai.alfares.cz/docs> (or <http://localhost:${AI_ORCHESTRATOR_PORT:-3380}/docs>)
- **Submission Service**: <http://localhost:${SUBMISSION_SERVICE_PORT:-3603}/docs> (managed by statex-website)
- **User Portal**: <http://localhost:${USER_PORTAL_PORT:-3606}/docs> (managed by statex-website)
- **Content Service**: <http://localhost:${CONTENT_SERVICE_EXTERNAL_PORT:-3609}/docs> (managed by statex-website)

### **Service Access URLs**

- **Website**: <http://localhost:${FRONTEND_PORT:-3602}>
- **API Gateway**: <http://localhost:${API_GATEWAY_EXTERNAL_PORT:-3601}>
- **Dashboard**: <http://localhost:${DASHBOARD_PORT:-3626}>

## 🆘 **Support**

### **Getting Help**

- **Documentation**: [docs.alfares.cz](https://docs.alfares.cz)
- **Issues**: GitHub Issues in respective repositories
- **Email**: <support@alfares.cz>
- **Slack**: #statex-support

### **Emergency Support**

- **Critical Issues**: PagerDuty alerts
- **Service Outages**: Status page at status.alfares.cz
- **Security Issues**: <security@alfares.cz>

## 🗺️ **Roadmap**

### **Stage 1**

- [ ] Complete AI agent performance optimization
- [ ] Multi-language support
- [ ] Mobile application

### **Stage 2**

- [ ] Multi-region deployment
- [ ] Advanced analytics and reporting
- [ ] AI model fine-tuning
- [ ] Enterprise features

### **Stage 3**

- [ ] Marketplace for AI agents
- [ ] Advanced workflow automation
- [ ] Integration with external platforms
- [ ] White-label solutions

---

**StateX** - Transforming business ideas into digital solutions through AI-powered automation 🚀
