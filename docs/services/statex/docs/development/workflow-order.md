# Workflow Order and Dependencies

This document describes the updated workflow order and dependency structure in the StateX AI Platform's multi-agent system.

## Overview

The multi-agent workflow has been restructured to ensure optimal processing order, with the Prototype Agent now depending on the Summarizer Agent to ensure comprehensive analysis before solution generation.

## Workflow Architecture

### Updated Workflow Order

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ASR Agent     │    │ Document Agent  │    │   NLP Agent     │
│ (if voice file) │    │  (if files)     │    │   (always)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Summarizer Agent        │
                    │ (depends on all above)    │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Prototype Agent         │
                    │ (depends on Summarizer)   │
                    └───────────────────────────┘
```

## Phase Breakdown

### Phase 1: Data Collection and Analysis

**Parallel Execution** - All agents run simultaneously when their input data is available.

#### ASR Agent (Optional)

- **Trigger**: Voice file present in submission
- **Dependencies**: None
- **Input**: `voice_file_url`
- **Output**: Transcript text
- **Service**: `ai-microservice-asr-service:${ASR_SERVICE_PORT:-3382}` (configured in ai-microservice/.env)
- **Timeout**: 45 seconds

#### Document Agent (Optional)

- **Trigger**: Files present in submission
- **Dependencies**: None
- **Input**: `file_urls[]`
- **Output**: Extracted text and analysis
- **Service**: `ai-microservice-document-ai:${DOCUMENT_AI_PORT:-3383}` (configured in ai-microservice/.env)
- **Timeout**: 60 seconds

#### NLP Agent (Always)

- **Trigger**: Always runs
- **Dependencies**: None
- **Input**: `requirements` text
- **Output**: Business analysis, recommendations, technical specs
- **Service**: [`ai-microservice-free-ai-service:${FREE_AI_SERVICE_PORT:-3386}`](ai-providers.md#free-ai-service) (configured in ai-microservice/.env)
- **Timeout**: 45 seconds

### Phase 2: Analysis Synthesis

**Sequential Execution** - Summarizer waits for all analysis agents to complete.

#### Summarizer Agent

- **Trigger**: After ASR + Document + NLP completion
- **Dependencies**:
  - ASR Agent (if voice file present)
  - Document Agent (if files present)
  - NLP Agent (always)
- **Input**: Aggregated data from all analysis agents
- **Output**: Comprehensive summary and insights
- **Service**: [`ai-microservice-free-ai-service:${FREE_AI_SERVICE_PORT:-3386}`](ai-providers.md#free-ai-service) (configured in ai-microservice/.env) (via NLP service)
- **Timeout**: 120 seconds

### Phase 3: Solution Generation

**Sequential Execution** - Prototype Agent waits for Summarizer completion.

#### Prototype Agent

- **Trigger**: After Summarizer Agent completion
- **Dependencies**: Summarizer Agent
- **Input**:
  - Original requirements
  - NLP analysis results
  - Summary from Summarizer Agent
- **Output**: Prototype code, documentation, implementation plan
- **Service**: `ai-microservice-prototype-generator:${PROTOTYPE_GENERATOR_PORT:-3384}` (configured in ai-microservice/.env)
- **Timeout**: 180 seconds

## Dependency Logic

### Task Dependencies

```python
# Summarizer dependencies
summarizer_dependencies = [nlp_task.task_id]
if input_data.get("voice_file_url"):
    summarizer_dependencies.append(asr_task.task_id)
if input_data.get("file_urls"):
    summarizer_dependencies.append(document_task.task_id)

# Prototype dependencies
prototype_dependencies = [summarizer_task.task_id]
```

### Data Flow

```python
# Summarizer input data
summarizer_input = {
    "collected_data": {
        "nlp_analysis": nlp_results,
        "asr_transcript": asr_results.get("transcript", ""),
        "document_analysis": document_results
    }
}

# Prototype input data
prototype_input = {
    "requirements": original_requirements,
    "analysis": nlp_results,
    "summary": summarizer_results.get("summary_text", "")
}
```

### File structure expected

```text
data/uploads/{user_id}/sess_{timestamp}_{random}/
├── form_data.md                  # ← NLP Agent reads this
├── nlp.md                        # ← NLP Agent saves this ← Summarizer Agent reads this
├── voicerecording.md             # ← ASR Agent saves this ← Summarizer Agent reads this
├── attachments.md                # ← Document Agent saves this ← Summarizer Agent reads this
├── prototype.md                  # ← Prototype Agent saves this ← Summarizer Agent reads this
├── summary.md                    # ← Summarizer Agent saves final summary here
└── files/                        # ← Subdirectory for actual files
    ├── {file_id}.webm            # ← ASR Agent processes this (voice files)
    ├── {file_id}.wav             # ← ASR Agent processes this (voice files)
    ├── {file_id}.pdf             # ← Document Agent processes this (attachments)
    ├── {file_id}.docx            # ← Document Agent processes this (attachments)
    └── {file_id}.txt             # ← Document Agent processes this (attachments)
```

### Agent File Reading Logic

#### **NLP Agent**

- **Reads from**: `form_data.md` (session root directory)
- **Purpose**: Analyzes the form description and requirements
- **Input**: Text content from form submission
- **Saves to**: `nlp.md`

#### **ASR Agent**

- **Reads from**: `files/` subdirectory
- **File types**: `.webm`, `.mp3`, `.wav`, `.m4a`, `.ogg`
- **Purpose**: Transcribes voice recordings to text
- **Input**: Audio files from voice recording
- **Saves to**: `voicerecording.md`

#### **Document Agent**

- **Reads from**: `files/` subdirectory  
- **File types**: `.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`, `.odt`
- **Purpose**: Extracts and analyzes document content
- **Input**: Attachment files from form submission
- **Saves to**: `attachments.md`

#### **Summarizer Agent**

- **Reads from**: Session root directory
- **Files**: `nlp.md`, `voicerecording.md`, `attachments.md`
- **Purpose**: Aggregates all agent results into comprehensive summary
- **Input**: Results from all other agents
- **Saves to**: `summary.md`

#### **Prototype Agent**

- **Reads from**: Summarizer results `form_data.md` (session root directory) and analysis data
- **Purpose**: Generates prototype based on analysis
- **Input**: Summary and analysis data
- **Saves to**: `prototype.md`

## Benefits of New Order

### 1. Comprehensive Analysis First

- All data sources are analyzed before summarization
- No information is lost in the summarization process
- Better context for prototype generation

### 2. Informed Prototype Generation

- Prototype Agent has access to complete summary
- Better understanding of requirements and constraints
- More accurate and relevant solutions

### 3. Improved Quality

- Summarizer provides comprehensive overview
- Prototype Agent makes better decisions
- Higher quality final deliverables

### 4. Better Error Handling

- Issues in analysis phase don't affect prototype generation
- Clear separation of concerns
- Easier debugging and troubleshooting

## Implementation Details

### Workflow Engine Changes

```python
async def _business_analysis_workflow(self, input_data: Dict[str, Any]) -> List[AgentTask]:
    tasks = []
    
    # Phase 1: Analysis tasks (parallel)
    if input_data.get("voice_file_url"):
        asr_task = self._create_asr_task(input_data)
        tasks.append(asr_task)
    
    if input_data.get("file_urls"):
        document_task = self._create_document_task(input_data)
        tasks.append(document_task)
    
    nlp_task = self._create_nlp_task(input_data)
    tasks.append(nlp_task)
    
    # Phase 2: Summarizer (depends on analysis)
    summarizer_task = self._create_summarizer_task(input_data, tasks)
    tasks.append(summarizer_task)
    
    # Phase 3: Prototype (depends on summarizer)
    prototype_task = self._create_prototype_task(input_data, summarizer_task)
    tasks.append(prototype_task)
    
    return tasks
```

### Agent Task Creation

```python
def _create_summarizer_task(self, input_data: Dict, analysis_tasks: List[AgentTask]) -> AgentTask:
    dependencies = [task.task_id for task in analysis_tasks]
    
    return AgentTask(
        agent_type="summarizer",
        agent_name="Summarizer Agent",
        input_data={"collected_data": {}},
        priority=1,
        timeout=120,
        dependencies=dependencies
    )

def _create_prototype_task(self, input_data: Dict, summarizer_task: AgentTask) -> AgentTask:
    return AgentTask(
        agent_type="prototype",
        agent_name="Prototype Generator Agent",
        input_data={
            "requirements": input_data.get("requirements", ""),
            "analysis": {},
            "summary": {}
        },
        priority=1,
        timeout=180,
        dependencies=[summarizer_task.task_id]
    )
```

## Monitoring and Observability

### Workflow Metrics

- **Phase 1 Duration**: Analysis phase completion time
- **Phase 2 Duration**: Summarization phase completion time
- **Phase 3 Duration**: Prototype generation phase completion time
- **Total Duration**: End-to-end workflow time

### Agent Metrics

- **ASR Agent**: Processing time, success rate
- **Document Agent**: Processing time, success rate
- **NLP Agent**: Processing time, success rate
- **Summarizer Agent**: Processing time, success rate
- **Prototype Agent**: Processing time, success rate

### Dependency Tracking

- **Dependency Resolution Time**: Time to resolve all dependencies
- **Task Queue Length**: Number of pending tasks
- **Failed Dependencies**: Count of failed dependency resolutions

## Error Handling

### Phase-Level Error Handling

1. **Phase 1 Errors**: Individual agent failures don't stop other agents
2. **Phase 2 Errors**: Summarizer failure prevents prototype generation
3. **Phase 3 Errors**: Prototype failure doesn't affect previous phases

### Recovery Strategies

1. **Agent Retry**: Failed agents are retried with exponential backoff
2. **Workflow Recovery**: Failed workflows can be resumed from last checkpoint
3. **Fallback Mechanisms**: Alternative approaches for critical failures

### Error Reporting

```python
# Example error structure
{
    "phase": "analysis|summarization|prototype",
    "agent": "asr|document|nlp|summarizer|prototype",
    "error_type": "timeout|service_unavailable|processing_error",
    "error_message": "Detailed error description",
    "retry_count": 2,
    "can_retry": true
}
```

## Testing Strategy

### Unit Tests

- Individual agent functionality
- Dependency resolution logic
- Task creation and scheduling
- Error handling scenarios

### Integration Tests

- End-to-end workflow execution
- Cross-phase data flow
- Dependency resolution
- Error propagation

### Performance Tests

- Workflow execution time
- Resource utilization
- Concurrent workflow handling
- Scalability limits

## Best Practices

### Development

1. **Clear Dependencies**: Define explicit dependencies between tasks
2. **Error Boundaries**: Implement proper error handling at each phase
3. **Data Validation**: Validate data flow between phases
4. **Monitoring**: Add comprehensive monitoring and logging

### Operations

1. **Resource Planning**: Plan resources based on phase requirements
2. **Scaling Strategy**: Scale agents based on phase bottlenecks
3. **Alerting**: Set up alerts for phase failures and delays
4. **Recovery Procedures**: Document recovery procedures for each phase

### Performance

1. **Optimization**: Optimize slowest phases first
2. **Caching**: Implement caching for repeated operations
3. **Load Balancing**: Distribute load across agent instances
4. **Monitoring**: Monitor performance metrics continuously

## Troubleshooting

### Common Issues

1. **Summarizer Not Triggered**
   - Check if all analysis agents completed successfully
   - Verify dependency resolution
   - Review workflow logs

2. **Prototype Not Generated**
   - Check if Summarizer Agent completed
   - Verify summary data is available
   - Review prototype agent logs

3. **Workflow Stuck**
   - Check agent health status
   - Review dependency resolution
   - Use recovery endpoints

### Debug Commands

```bash
# Check workflow status
curl http://localhost:${AI_ORCHESTRATOR_PORT:-3380}/api/multi-agent/workflow/{workflow_id}

# Check agent health
curl http://localhost:${AI_ORCHESTRATOR_PORT:-3380}/api/multi-agent/agents/health

# View workflow logs
docker compose logs ai-orchestrator | grep "workflow_id"

# Check task dependencies
curl http://localhost:${AI_ORCHESTRATOR_PORT:-3380}/api/multi-agent/workflow/{workflow_id}/dependencies
```

## Related Documentation

### Multi-Agent System

- [Multi-Agent Workflow System](multi-agent-workflow.md) - Complete multi-agent architecture and implementation details
- [AI Providers Configuration](ai-providers.md) - AI provider configuration and model selection

### Setup and Configuration

- [OpenRouter Setup Guide](../OPENROUTER_SETUP_GUIDE.md) - OpenRouter integration for workflow agents
- [Quick Reference Guide](quick-reference.md) - Quick commands for workflow management

### Development Environment

- [Development Optimization Guide](DEVELOPMENT_OPTIMIZATION.md) - Development environment and tools
- [StateX AI Platform](../../../ai-microservice/README.md) - External AI microservice overview

### API Documentation

- [API Documentation](../API_DOCUMENTATION.md) - API endpoints for workflow operations
