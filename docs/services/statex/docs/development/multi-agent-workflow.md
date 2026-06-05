# Multi-Agent Workflow System

This document describes the multi-agent workflow system in the StateX AI Platform, including agent types, workflow orchestration, and implementation details.

## Overview

The multi-agent workflow system processes customer requests through specialized AI agents that work together to provide comprehensive analysis and solutions. Each agent has a specific role and the system orchestrates their execution based on dependencies and data availability. For AI provider configuration, see [AI Providers Configuration](ai-providers.md).

## Architecture

### Core Components

1. **AI Orchestrator**: Central coordinator that manages workflow execution
2. **Agent Interface**: Standardized interface for all AI agents
3. **Workflow Engine**: Handles task scheduling and dependency management
4. **Service Integration**: HTTP-based communication between services

### Agent Types

#### 1. ASR Agent (Automatic Speech Recognition)

- **Purpose**: Converts voice files to text
- **Dependencies**: None
- **Input**: Voice files from `files/` subdirectory (`.webm`, `.mp3`, `.wav`, etc.)
- **Output**: Transcript text saved to `voicerecording.md`
- **Service**: `ai-microservice-asr-service:${ASR_SERVICE_PORT:-3382}`
- **File Reading**: Reads audio files from `files/` subdirectory

#### 2. Document Agent

- **Purpose**: Analyzes uploaded documents
- **Dependencies**: None
- **Input**: Document files from `files/` subdirectory (`.pdf`, `.doc`, `.docx`, etc.)
- **Output**: Extracted text and analysis saved to `attachments.md`
- **Service**: `ai-microservice-document-ai:${DOCUMENT_AI_PORT:-3383}`
- **File Reading**: Reads document files from `files/` subdirectory

#### 3. NLP Agent (Natural Language Processing)

- **Purpose**: Analyzes text content for business insights
- **Dependencies**: None
- **Input**: Text content from `form_data.md`
- **Output**: Business analysis, recommendations, technical specs saved to `nlp.md`
- **Service**: [`ai-microservice-free-ai-service:${FREE_AI_SERVICE_PORT:-3386}`](ai-providers.md#free-ai-service) (via `/api/analyze-text`)
- **File Reading**: Reads `form_data.md` from session root directory

#### 4. Summarizer Agent

- **Purpose**: Aggregates all analysis results into comprehensive summary
- **Dependencies**: ASR + Document + NLP
- **Input**: Collected data from all previous agents (reads `nlp.md`, `voicerecording.md`, `attachments.md`)
- **Output**: Summary text and insights saved to `summary.md`
- **Service**: `ai-microservice-free-ai-service:${FREE_AI_SERVICE_PORT:-3386}` (via NLP service)
- **File Reading**: Reads all agent result files from session root directory

#### 5. Prototype Agent

- **Purpose**: Generates prototype based on analysis
- **Dependencies**: Summarizer Agent
- **Input**: Summary and analysis data
- **Output**: Prototype information saved to `prototype.md`
- **Service**: `ai-microservice-prototype-generator:${PROTOTYPE_GENERATOR_PORT:-3384}` (configured in ai-microservice/.env)
- **File Reading**: Uses analysis data from other agents

## File Structure and Data Flow

### Session Directory Structure

```text
data/uploads/{user_id}/sess_{timestamp}_{random}/
├── form_data.md                    # ← NLP Agent reads this
├── nlp.md                         # ← NLP Agent saves this ← Summarizer Agent reads this
├── voicerecording.md              # ← ASR Agent saves this ← Summarizer Agent reads this
├── attachments.md                 # ← Document Agent saves this ← Summarizer Agent reads this
├── prototype.md                   # ← Prototype Agent saves this
├── summary.md                     # ← Summarizer Agent saves final summary here
└── files/                         # ← Subdirectory for actual files
    ├── {file_id}.webm            # ← ASR Agent processes this (voice files)
    ├── {file_id}.pdf             # ← Document Agent processes this (attachments)
    ├── {file_id}.docx            # ← Document Agent processes this (attachments)
    └── {file_id}.txt             # ← Document Agent processes this (attachments)
```

### Data Flow Process

1. **Form Submission** → Files saved to `files/` subdirectory
2. **NLP Agent** → Reads `form_data.md` → Saves results to `nlp.md`
3. **ASR Agent** → Reads audio files from `files/` → Saves results to `voicerecording.md`
4. **Document Agent** → Reads document files from `files/` → Saves results to `attachments.md`
5. **Summarizer Agent** → Reads all result files → Saves summary to `summary.md`
6. **Prototype Agent** → Uses summary data → Saves results to `prototype.md`
7. **Telegram Notifications** → Sent for each agent with comprehensive data

### Key Implementation Details

- **Disk Reading**: All agents now read from actual disk files instead of API data
- **File Discovery**: Agents automatically discover files in the `files/` subdirectory
- **Session Management**: Each submission gets a unique session directory
- **Error Handling**: Comprehensive error handling and logging throughout
- **Notifications**: Enhanced Telegram notifications with detailed agent data (uses centralized NotificationServiceClient)

## Workflow Execution

### Business Analysis Workflow

The primary workflow for processing customer requests follows this sequence:

```text
1. ASR Agent (if voice file) ──┐
2. Document Agent (if files) ──┼
3. NLP Agent (always) ─────────┘
4. Summarizer Agent
5. Prototype Agent
```

### Workflow Phases

#### Phase 1: Data Collection

- ASR Agent processes voice files
- Document Agent extracts text from documents
- NLP Agent analyzes text requirements

#### Phase 2: Analysis Synthesis

- Summarizer Agent aggregates all findings
- Creates comprehensive summary of requirements and insights
- Identifies key technical and business recommendations

#### Phase 3: Solution Generation

- Prototype Agent uses summary to generate solution
- Creates code, documentation, and implementation plan
- Provides actionable next steps

## Configuration

### Environment Variables

```bash
# Multi-Agent Workflow
USE_MULTI_AGENT_WORKFLOW=true

# Service URLs (Internal Docker Network)
AI_SERVICE_URL=http://ai-microservice-orchestrator:${AI_ORCHESTRATOR_PORT:-3380}
SUBMISSION_SERVICE_URL=http://submission-service:${SUBMISSION_SERVICE_INTERNAL_PORT:-8000}
NLP_SERVICE_URL=http://ai-microservice-nlp-service:${NLP_SERVICE_PORT:-3381}
ASR_SERVICE_URL=http://ai-microservice-asr-service:${ASR_SERVICE_PORT:-3382}
DOCUMENT_SERVICE_URL=http://ai-microservice-document-ai:${DOCUMENT_AI_PORT:-3383}
PROTOTYPE_SERVICE_URL=http://prototype-generator:${PROTOTYPE_GENERATOR_INTERNAL_PORT:-8000}
```

### Service Dependencies

```yaml
# docker-compose.dev.yml
services:
  ai-orchestrator:
    depends_on:
      - free-ai-service
      - asr-service
      - document-ai
      - prototype-generator
      - submission-service
```

## API Endpoints

### Multi-Agent Workflow

#### Start Workflow

```http
POST /api/multi-agent/process
Content-Type: application/json

{
  "submission_id": "string",
  "user_id": "string",
  "requirements": "string",
  "analysis_type": "business_analysis",
  "voice_file_url": "string (optional)",
  "file_urls": ["string"] (optional)
}
```

**Response:**

```json
{
  "submission_id": "string",
  "status": "processing",
  "message": "Multi-agent workflow started",
  "workflow_type": "business_analysis",
  "estimated_completion_time": "2-5 minutes"
}
```

#### Check Workflow Status

```http
GET /api/multi-agent/workflow/{workflow_id}
```

**Response:**

```json
{
  "workflow_id": "string",
  "status": "completed|processing|failed",
  "progress": 85,
  "current_task": "Summarizer Agent",
  "completed_tasks": ["ASR Agent", "Document Agent", "NLP Agent"],
  "results": {
    "summary": "string",
    "prototype": "string",
    "recommendations": ["string"]
  }
}
```

### Agent Health Check

```http
GET /api/multi-agent/agents/health
```

**Response:**

```json
{
  "total_agents": 5,
  "healthy_agents": 5,
  "degraded_agents": 0,
  "offline_agents": 0,
  "overall_health": "healthy",
  "agents": {
    "asr": "healthy",
    "document": "healthy",
    "nlp": "healthy",
    "summarizer": "healthy",
    "prototype": "healthy"
  }
}
```

## Data Flow

### Input Processing

1. Customer submits form with requirements
2. Files are uploaded and stored
3. Submission service triggers AI orchestrator
4. Orchestrator creates workflow tasks

### Agent Execution

1. Tasks are queued based on dependencies
2. Agents process their assigned tasks
3. Results are collected and stored
4. Dependencies are resolved automatically

### Output Generation

1. Summarizer creates comprehensive summary
2. Summary is persisted to `summary.md`
3. Prototype Agent generates solution
4. Final results are returned to user

## Error Handling

### Agent Failures

- Individual agent failures don't stop the workflow
- Failed agents are retried with exponential backoff
- Fallback mechanisms ensure workflow completion
- Error details are logged and reported

### Workflow Recovery

- Workflow state is checkpointed regularly
- Failed workflows can be resumed from last checkpoint
- Manual recovery endpoints available
- Automatic cleanup of stale workflows

### Monitoring

- Real-time workflow status tracking
- Agent health monitoring
- Performance metrics collection
- Error rate tracking and alerting

## Implementation Details

### Agent Interface

```python
class AgentInterface:
    def __init__(self, agent_name: str, agent_type: str):
        self.agent_name = agent_name
        self.agent_type = agent_type
    
    async def execute_task(self, task: AgentTask) -> AgentResult:
        """Execute the agent's specific task"""
        pass
    
    async def health_check(self) -> bool:
        """Check if the agent service is healthy"""
        pass
```

### Task Dependencies

```python
# Example task with dependencies
task = AgentTask(
    agent_type="summarizer",
    agent_name="Summarizer Agent",
    input_data={"collected_data": {}},
    priority=1,
    timeout=120,
    dependencies=["nlp_task_id", "asr_task_id", "document_task_id"]
)
```

### Result Persistence

```python
# Summary persistence
await orchestrator.persist_summary(
    submission_id="submission_123",
    summary_text="Comprehensive analysis summary..."
)
```

## Testing

### Unit Tests

- Individual agent functionality
- Workflow orchestration logic
- Error handling scenarios
- Data validation

### Integration Tests

- End-to-end workflow execution
- Service communication
- Data persistence
- Performance benchmarks

### Load Testing

- Concurrent workflow execution
- Resource utilization
- Scalability limits
- Failure recovery

## Monitoring and Observability

### Metrics

- Workflow completion rate
- Agent response times
- Error rates by agent
- Resource utilization

### Logging

- Structured logging with correlation IDs
- Agent execution traces
- Error details and stack traces
- Performance timing data

### Alerting

- Agent health degradation
- Workflow failures
- Performance thresholds
- Resource exhaustion

## Best Practices

### Development

1. **Agent Design**: Keep agents focused and single-purpose
2. **Error Handling**: Implement comprehensive error handling
3. **Testing**: Write tests for all agent functionality
4. **Documentation**: Document agent interfaces and behaviors

### Operations

1. **Monitoring**: Set up comprehensive monitoring
2. **Scaling**: Plan for horizontal scaling of agents
3. **Recovery**: Implement robust recovery mechanisms
4. **Security**: Secure agent communications and data

## Related Documentation

### AI Providers and Configuration

- [AI Providers Configuration](ai-providers.md) - How to configure OpenRouter, Ollama, and other AI providers
- [OpenRouter Setup Guide](../OPENROUTER_SETUP_GUIDE.md) - Detailed OpenRouter integration setup

### Workflow Details

- [Workflow Order and Dependencies](workflow-order.md) - Complete workflow order, phases, and dependency logic

### Quick Reference

- [Quick Reference Guide](quick-reference.md) - Common commands and troubleshooting

### Development Environment

- [Development Optimization Guide](DEVELOPMENT_OPTIMIZATION.md) - Development environment setup
- [StateX AI Platform](../../../ai-microservice/README.md) - External AI microservice architecture and services

### API Documentation

- [API Documentation](../API_DOCUMENTATION.md) - Complete API reference for all AI services

### Performance

1. **Optimization**: Optimize agent response times
2. **Caching**: Implement appropriate caching strategies
3. **Resource Management**: Monitor and manage resource usage
4. **Load Balancing**: Distribute load across agent instances

## Troubleshooting

### Common Issues

1. **Agent Timeout**
   - Check agent service health
   - Verify input data format
   - Increase timeout if needed

2. **Dependency Resolution**
   - Verify dependency task IDs
   - Check task completion status
   - Review dependency logic

3. **Workflow Stuck**
   - Check agent health status
   - Review workflow logs
   - Use recovery endpoints

### Debug Commands

```bash
# Check orchestrator health
curl http://localhost:${AI_ORCHESTRATOR_PORT:-3380}/health

# Check agent health
curl http://localhost:${AI_ORCHESTRATOR_PORT:-3380}/api/multi-agent/agents/health

# View workflow status
curl http://localhost:${AI_ORCHESTRATOR_PORT:-3380}/api/multi-agent/workflow/{workflow_id}

# Check service logs
docker compose logs ai-orchestrator
```
