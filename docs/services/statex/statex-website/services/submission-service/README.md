# Submission Service

## Overview

The Submission Service is responsible for handling user form submissions, file uploads, and data persistence. It acts as the entry point for user requests and publishes events for further processing by AI agents. Built with FastAPI, it provides a high-performance API for handling multi-modal input (text, audio, files).

## Purpose

- **Form Processing**: Handle user form submissions with validation
- **File Upload**: Process and store text, audio, and file attachments
- **Data Persistence**: Store submission data in structured format with user association
- **Session Management**: Handle both registered and unregistered user sessions
- **Data Association**: Link unregistered submissions to users upon registration/login
- **Event Publishing**: Publish events for AI processing pipeline
- **Virus Scanning**: Optional virus scanning for uploaded files
- **Data Validation**: Comprehensive input validation and sanitization

## Architecture

### Technology Stack

- **Framework**: FastAPI with Python 3.13
- **File Storage**: S3-compatible object storage (MinIO/S3)
- **Message Broker**: RabbitMQ or NATS for event publishing
- **Database**: PostgreSQL for metadata storage
- **Validation**: Pydantic for data validation
- **File Processing**: Python libraries for file type detection

### Service Dependencies

- **Object Storage**: File and artifact storage
- **Message Broker**: Event publishing and communication
- **Database**: Metadata and audit trail storage
- **Virus Scanner**: Optional ClamAV integration

## API Endpoints

### Submission Endpoints

```text
POST /api/submissions
  - Accepts multipart form data
  - Handles both registered and unregistered users
  - Creates session for unregistered users
  - Validates input and files
  - Stores files and metadata
  - Publishes events

POST /api/submissions/anonymous
  - Anonymous submission endpoint
  - Creates temporary session
  - Stores data with session association
  - Returns session ID for future reference

GET /api/submissions/{submission_id}
  - Retrieve submission details
  - Include file URLs and metadata
  - Requires authentication or session validation

GET /api/submissions/session/{session_id}
  - Get all submissions for a session
  - Used for unregistered users
  - Returns submission list

PUT /api/submissions/{submission_id}
  - Update submission metadata
  - Add additional files
  - Requires ownership validation

DELETE /api/submissions/{submission_id}
  - Soft delete submission
  - Archive files
  - Requires ownership validation

POST /api/submissions/associate
  - Associate session submissions with user account
  - Called when user registers or logs in
  - Links all session submissions to user
```

### File Management Endpoints

```text
POST /api/files/upload
  - Direct file upload endpoint
  - Returns file ID and URL

GET /api/files/{file_id}
  - Get file metadata
  - Generate presigned URLs

DELETE /api/files/{file_id}
  - Delete file from storage
  - Update metadata
```

### Health Checks

```text
GET /health
  - Service health check
  - Dependencies status

GET /metrics
  - Performance indicators
```

## Data Models

### Submission Model

```python
class Submission(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None  # None for unregistered users
    session_id: Optional[str] = None  # Session ID for unregistered users
    email: Optional[str] = None  # Email for unregistered users
    title: str
    description: Optional[str] = None
    request_type: str
    status: SubmissionStatus
    files: List[FileMetadata]
    metadata: Dict[str, Any]
    is_anonymous: bool = False
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None
    associated_at: Optional[datetime] = None  # When linked to user account
```

### Session Model

```python
class UserSession(BaseModel):
    session_id: str
    email: Optional[str] = None
    ip_address: str
    user_agent: str
    created_at: datetime
    last_activity: datetime
    is_anonymous: bool = True
    user_id: Optional[UUID] = None  # Set when user registers/logs in
    submissions: List[UUID] = []  # List of submission IDs
```

### File Metadata Model

```python
class FileMetadata(BaseModel):
    id: UUID
    submission_id: UUID
    filename: str
    original_filename: str
    content_type: str
    size: int
    s3_key: str
    s3_url: str
    checksum: str
    virus_scan_status: Optional[str] = None
    created_at: datetime
```

### Event Models

```python
class SubmissionCreatedEvent(BaseModel):
    event: str = "submission.created"
    event_id: UUID
    occurred_at: datetime
    trace_id: UUID
    actor: Optional[Dict[str, Any]] = None
    data: SubmissionData

class FileUploadedEvent(BaseModel):
    event: str = "file.uploaded"
    event_id: UUID
    occurred_at: datetime
    trace_id: UUID
    data: FileUploadData
```

## Data Persistence and Session Management

### Data Storage Strategy

#### Disk Storage Structure

```text
/data/submissions/
├── users/                           # Registered user data
│   └── {user_id}/
│       ├── {submission_id}/
│       │   ├── metadata.json       # Submission metadata
│       │   ├── files/              # Uploaded files
│       │   │   ├── {file_id}.{ext}
│       │   │   └── ...
│       │   └── processing/          # AI processing results
│       └── ...
├── sessions/                        # Anonymous user data
│   └── {session_id}/
│       ├── {submission_id}/
│       │   ├── metadata.json
│       │   ├── files/
│       │   └── processing/
│       └── ...
└── temp/                           # Temporary files
    └── {temp_id}/
```

#### Database Storage

- **Submissions Table**: Stores submission metadata and references
- **Sessions Table**: Tracks anonymous user sessions
- **Files Table**: File metadata and storage paths
- **User Associations Table**: Links sessions to users upon registration

### Session Management

#### Anonymous User Flow

1. **Initial Visit**: User visits website without authentication
2. **Session Creation**: System creates unique session ID
3. **Data Storage**: All submissions stored under session ID
4. **Session Tracking**: Session tracked via cookies/localStorage
5. **Data Association**: Upon login/registration, session data linked to user

#### Registered User Flow

1. **Authentication**: User logs in with valid credentials
2. **Session Validation**: Existing session validated or new session created
3. **Data Storage**: Submissions stored under user ID
4. **History Access**: User can access all their submissions

### Data Association Process

#### When User Registers/Logs In

```python
async def associate_session_to_user(session_id: str, user_id: UUID):
    """Associate anonymous session data with user account."""
    
    # 1. Get all submissions for the session
    session_submissions = await get_submissions_by_session(session_id)
    
    # 2. Update each submission with user_id
    for submission in session_submissions:
        await update_submission_user(
            submission.id, 
            user_id=user_id,
            associated_at=datetime.utcnow()
        )
    
    # 3. Move files from session directory to user directory
    await move_session_files_to_user(session_id, user_id)
    
    # 4. Update session record
    await update_session_user(session_id, user_id)
    
    # 5. Publish association event
    await publish_event("submission.associated", {
        "session_id": session_id,
        "user_id": user_id,
        "submission_count": len(session_submissions)
    })
```

### File Storage Implementation

#### File Storage Service

```python
class FileStorageService:
    def __init__(self, base_path: str, s3_client: S3Client):
        self.base_path = base_path
        self.s3_client = s3_client
    
    async def store_submission_files(
        self, 
        submission_id: UUID, 
        files: List[UploadFile],
        user_id: Optional[UUID] = None,
        session_id: Optional[str] = None
    ) -> List[FileMetadata]:
        """Store submission files with proper organization."""
        
        # Determine storage path
        if user_id:
            storage_path = f"users/{user_id}/{submission_id}/files"
        else:
            storage_path = f"sessions/{session_id}/{submission_id}/files"
        
        file_metadata = []
        
        for file in files:
            # Generate unique file ID
            file_id = uuid.uuid4()
            file_extension = file.filename.split('.')[-1]
            stored_filename = f"{file_id}.{file_extension}"
            
            # Store file locally
            local_path = os.path.join(self.base_path, storage_path, stored_filename)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            with open(local_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Upload to S3 for backup
            s3_key = f"{storage_path}/{stored_filename}"
            await self.s3_client.upload_file(local_path, s3_key)
            
            # Create file metadata
            metadata = FileMetadata(
                id=file_id,
                submission_id=submission_id,
                filename=file.filename,
                stored_filename=stored_filename,
                content_type=file.content_type,
                size=len(content),
                local_path=local_path,
                s3_key=s3_key,
                checksum=hashlib.md5(content).hexdigest()
            )
            
            file_metadata.append(metadata)
        
        return file_metadata
    
    async def move_session_files_to_user(
        self, 
        session_id: str, 
        user_id: UUID
    ):
        """Move session files to user directory."""
        
        session_path = os.path.join(self.base_path, "sessions", session_id)
        user_path = os.path.join(self.base_path, "users", str(user_id))
        
        if os.path.exists(session_path):
            # Move all files from session to user directory
            shutil.move(session_path, user_path)
            
            # Update S3 keys
            await self.update_s3_keys_for_user(session_id, user_id)
```

### Data Retrieval

#### Get User Submissions

```python
async def get_user_submissions(
    user_id: UUID,
    include_anonymous: bool = True
) -> List[Submission]:
    """Get all submissions for a user, including associated anonymous ones."""
    
    # Get direct user submissions
    user_submissions = await db.get_submissions_by_user(user_id)
    
    if include_anonymous:
        # Get associated session submissions
        associated_sessions = await db.get_associated_sessions(user_id)
        session_submissions = []
        
        for session in associated_sessions:
            session_subs = await db.get_submissions_by_session(session.session_id)
            session_submissions.extend(session_subs)
        
        # Combine and sort by creation date
        all_submissions = user_submissions + session_submissions
        all_submissions.sort(key=lambda x: x.created_at, reverse=True)
        
        return all_submissions
    
    return user_submissions
```

#### Get Session Submissions

```python
async def get_session_submissions(session_id: str) -> List[Submission]:
    """Get all submissions for a session (anonymous users)."""
    
    # Validate session exists and is active
    session = await db.get_session(session_id)
    if not session or session.is_expired():
        raise SessionNotFoundError("Session not found or expired")
    
    # Get submissions for session
    submissions = await db.get_submissions_by_session(session_id)
    
    return submissions
```

### Data Cleanup and Retention

#### Session Cleanup

```python
async def cleanup_expired_sessions():
    """Clean up expired anonymous sessions and their data."""
    
    # Get expired sessions (older than 30 days)
    expired_sessions = await db.get_expired_sessions(days=30)
    
    for session in expired_sessions:
        # Delete session files
        session_path = os.path.join(self.base_path, "sessions", session.session_id)
        if os.path.exists(session_path):
            shutil.rmtree(session_path)
        
        # Delete from S3
        await self.s3_client.delete_prefix(f"sessions/{session.session_id}/")
        
        # Delete from database
        await db.delete_session(session.session_id)
```

## File Processing

### Supported File Types

- **Text Files**: .txt, .md, .doc, .docx, .pdf
- **Audio Files**: .mp3, .wav, .m4a, .ogg, .flac
- **Image Files**: .jpg, .jpeg, .png, .gif, .webp
- **Archive Files**: .zip, .tar, .gz, .7z
- **Code Files**: .py, .js, .html, .css, .json

### File Validation

- **Size Limits**: Configurable per file type
- **Type Detection**: MIME type validation
- **Content Validation**: File content verification
- **Virus Scanning**: Optional ClamAV integration
- **Checksum Verification**: File integrity checking

### Storage Strategy

- **S3 Buckets**: Organized by submission ID
- **File Naming**: UUID-based naming for uniqueness
- **Metadata Storage**: File metadata in PostgreSQL
- **Presigned URLs**: Secure file access
- **Lifecycle Policies**: Automatic cleanup of old files

## Event Publishing

### Event Types

- **submission.created**: New submission received
- **submission.updated**: Submission metadata updated
- **submission.deleted**: Submission deleted
- **file.uploaded**: New file uploaded
- **file.processed**: File processing completed
- **file.deleted**: File deleted

### Event Schema

```json
{
  "event": "submission.created",
  "event_id": "uuid4",
  "occurred_at": "2026-01-27T12:00:00Z",
  "trace_id": "uuid4",
  "actor": {
    "user_id": "uuid4",
    "ip_address": "192.168.1.1"
  },
  "data": {
    "submission_id": "uuid4",
    "user_id": "uuid4",
    "session_id": "session_123",
    "is_anonymous": false,
    "request_type": "text_analysis",
    "files": [
      {
        "file_id": "uuid4",
        "filename": "document.pdf",
        "content_type": "application/pdf",
        "size": 1024000,
        "s3_key": "users/uuid4/submission_id/files/file_id.pdf"
      }
    ],
    "metadata": {
      "priority": "normal",
      "language": "en",
      "processing_required": true
    }
  }
}
```

### AI Processing Trigger

#### AI Processing Pipeline Initiation

```python
async def trigger_ai_processing(submission: Submission):
    """Trigger AI processing pipeline for submission."""
    
    # Create AI processing job
    ai_job = {
        "job_id": str(uuid.uuid4()),
        "submission_id": str(submission.id),
        "user_id": str(submission.user_id) if submission.user_id else None,
        "session_id": submission.session_id,
        "request_type": submission.request_type,
        "files": [
            {
                "file_id": str(f.id),
                "filename": f.filename,
                "content_type": f.content_type,
                "s3_key": f.s3_key,
                "local_path": f.local_path
            } for f in submission.files
        ],
        "priority": "normal",
        "created_at": datetime.utcnow().isoformat(),
        "status": "pending"
    }
    
    # Publish job to AI orchestrator
    await publish_event("ai.job.created", {
        "job_id": ai_job["job_id"],
        "submission_id": str(submission.id),
        "workflow_type": determine_workflow_type(submission.request_type),
        "files": ai_job["files"],
        "priority": ai_job["priority"],
        "user_context": {
            "user_id": ai_job["user_id"],
            "session_id": ai_job["session_id"],
            "is_anonymous": submission.is_anonymous
        }
    })
    
    # Update submission status
    await update_submission_status(submission.id, "processing")
    
    # Log processing initiation
    logger.info(f"AI processing initiated for submission {submission.id}")

def determine_workflow_type(request_type: str) -> str:
    """Determine appropriate AI workflow based on request type."""
    workflow_mapping = {
        "text_analysis": "text_processing_workflow",
        "document_analysis": "document_processing_workflow",
        "audio_analysis": "audio_processing_workflow",
        "image_analysis": "image_processing_workflow",
        "multi_modal": "multi_modal_processing_workflow",
        "general_inquiry": "general_analysis_workflow"
    }
    return workflow_mapping.get(request_type, "general_analysis_workflow")
```

### Message Broker Configuration

- **Topic**: `submissions` (configurable)
- **Partitioning**: By user_id for ordering
- **Retention**: 7 days (configurable)
- **Compression**: GZIP compression
- **Acknowledgment**: At-least-once delivery

## Security Features

### Input Validation

- **File Type Validation**: Whitelist of allowed file types
- **Size Validation**: Maximum file size limits
- **Content Validation**: File content verification
- **Path Traversal Protection**: Prevent directory traversal attacks

### Authentication & Authorization

- **JWT Validation**: Validate JWT tokens from User Portal
- **User Context**: Extract user information from tokens
- **Rate Limiting**: Per-user rate limiting
- **IP Whitelisting**: Optional IP-based access control

### Data Protection

- **Encryption at Rest**: S3 server-side encryption
- **Encryption in Transit**: TLS for all communications
- **PII Handling**: Special handling for personal data
- **Audit Logging**: Comprehensive audit trails

## API Implementation

### Anonymous User Submission

#### POST /api/submissions/anonymous

```python
@app.post("/api/submissions/anonymous")
async def create_anonymous_submission(
    request: AnonymousSubmissionRequest,
    session_id: str = Cookie(None),
    response: Response = None
):
    """Create submission for anonymous user."""
    
    # Create or get existing session
    if not session_id:
        session_id = str(uuid.uuid4())
        response.set_cookie("session_id", session_id, max_age=30*24*3600)  # 30 days
    
    # Validate session
    session = await get_or_create_session(session_id, request.email)
    
    # Create submission
    submission = Submission(
        id=uuid.uuid4(),
        session_id=session_id,
        email=request.email,
        title=request.title,
        description=request.description,
        request_type=request.request_type,
        status=SubmissionStatus.PENDING,
        is_anonymous=True,
        created_at=datetime.utcnow()
    )
    
    # Store files
    if request.files:
        file_metadata = await file_storage.store_submission_files(
            submission.id,
            request.files,
            session_id=session_id
        )
        submission.files = file_metadata
    
    # Save to database
    await db.create_submission(submission)
    
    # Update session
    await db.add_submission_to_session(session_id, submission.id)
    
    # Publish event for AI processing
    await publish_event("submission.created", {
        "submission_id": str(submission.id),
        "session_id": session_id,
        "is_anonymous": True,
        "request_type": submission.request_type,
        "files": [{"id": str(f.id), "filename": f.filename, "content_type": f.content_type} for f in submission.files],
        "priority": "normal",
        "processing_required": True
    })
    
    # Trigger AI processing pipeline
    await trigger_ai_processing(submission)
    
    return SubmissionResponse(
        success=True,
        data=submission,
        session_id=session_id
    )
```

### Registered User Submission

#### POST /api/submissions

```python
@app.post("/api/submissions")
async def create_submission(
    request: SubmissionRequest,
    current_user: User = Depends(get_current_user)
):
    """Create submission for authenticated user."""
    
    # Create submission
    submission = Submission(
        id=uuid.uuid4(),
        user_id=current_user.id,
        title=request.title,
        description=request.description,
        request_type=request.request_type,
        status=SubmissionStatus.PENDING,
        is_anonymous=False,
        created_at=datetime.utcnow()
    )
    
    # Store files
    if request.files:
        file_metadata = await file_storage.store_submission_files(
            submission.id,
            request.files,
            user_id=current_user.id
        )
        submission.files = file_metadata
    
    # Save to database
    await db.create_submission(submission)
    
    # Publish event for AI processing
    await publish_event("submission.created", {
        "submission_id": str(submission.id),
        "user_id": str(current_user.id),
        "is_anonymous": False,
        "request_type": submission.request_type,
        "files": [{"id": str(f.id), "filename": f.filename, "content_type": f.content_type} for f in submission.files],
        "priority": "normal",
        "processing_required": True
    })
    
    # Trigger AI processing pipeline
    await trigger_ai_processing(submission)
    
    return SubmissionResponse(
        success=True,
        data=submission
    )
```

### Session Association

#### POST /api/submissions/associate

```python
@app.post("/api/submissions/associate")
async def associate_session_submissions(
    request: SessionAssociationRequest,
    current_user: User = Depends(get_current_user)
):
    """Associate session submissions with user account."""
    
    # Validate session exists
    session = await db.get_session(request.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    # Check if session is already associated
    if session.user_id:
        raise HTTPException(400, "Session already associated with user")
    
    # Associate session to user
    await associate_session_to_user(request.session_id, current_user.id)
    
    # Get all associated submissions
    submissions = await get_user_submissions(current_user.id, include_anonymous=True)
    
    return AssociationResponse(
        success=True,
        message=f"Successfully associated {len(submissions)} submissions",
        submission_count=len(submissions)
    )
```

### Data Retrieval

#### GET /api/submissions/session/{session_id}

```python
@app.get("/api/submissions/session/{session_id}")
async def get_session_submissions(session_id: str):
    """Get all submissions for a session (anonymous users)."""
    
    # Validate session
    session = await db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    # Get submissions
    submissions = await get_session_submissions(session_id)
    
    return SessionSubmissionsResponse(
        success=True,
        data=submissions,
        session_id=session_id
    )
```

#### GET /api/submissions/user

```python
@app.get("/api/submissions/user")
async def get_user_submissions_endpoint(
    current_user: User = Depends(get_current_user),
    include_anonymous: bool = Query(True)
):
    """Get all submissions for authenticated user."""
    
    # Get user submissions
    submissions = await get_user_submissions(
        current_user.id, 
        include_anonymous=include_anonymous
    )
    
    return UserSubmissionsResponse(
        success=True,
        data=submissions,
        user_id=str(current_user.id)
    )
```

### Request Models

```python
class AnonymousSubmissionRequest(BaseModel):
    email: Optional[EmailStr] = None
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    request_type: str
    files: List[UploadFile] = Field(max_items=10)

class SessionAssociationRequest(BaseModel):
    session_id: str

class SubmissionResponse(BaseModel):
    success: bool
    data: Submission
    session_id: Optional[str] = None

class SessionSubmissionsResponse(BaseModel):
    success: bool
    data: List[Submission]
    session_id: str

class UserSubmissionsResponse(BaseModel):
    success: bool
    data: List[Submission]
    user_id: str

class AssociationResponse(BaseModel):
    success: bool
    message: str
    submission_count: int
```

## Configuration

### Environment Variables

```bash
# Service Configuration
SERVICE_NAME=submission-service
SERVICE_PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql://user:password@db-server-postgres.statex-apps.svc.cluster.local:5432/statex_submissions

# Message Broker
# Port configured in statex/.env: RABBITMQ_PORT (default: 5672)
RABBITMQ_URL=amqp://user:password@localhost:${RABBITMQ_PORT:-5672}
BROKER_TOPIC=submissions
BROKER_RETRY_ATTEMPTS=3
BROKER_RETRY_DELAY=1000

# File Processing
MAX_FILE_SIZE=104857600  # 100MB
VIRUS_SCAN_ENABLED=true
VIRUS_SCAN_SERVICE_URL=http://clamav:3310

# Security
JWT_SECRET=your-jwt-secret
JWT_ALGORITHM=HS256
RATE_LIMIT_PER_MINUTE=60
# Port configured in statex/.env: FRONTEND_PORT (default: 3602), but container port is 3000
CORS_ORIGINS=http://localhost:${FRONTEND_PORT:-3602},https://alfares.cz

# Monitoring
HEALTH_CHECK_INTERVAL=30
```

## Deployment

### Docker Configuration

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Start application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Observability

### Health Checks

- **Liveness Probe**: `/health` - Basic service health
- **Readiness Probe**: `/health/ready` - Service ready to accept traffic
- **Dependency Checks**: Database, S3, message broker connectivity

### Metrics

- **Request Metrics**: Request count, duration, status codes
- **File Metrics**: File upload count, size, processing time
- **Storage Metrics**: S3 operations, storage usage
- **Error Metrics**: Error rates, exception counts

### Logging

- **Structured Logging**: JSON-formatted logs
- **Request Logging**: Log all HTTP requests with correlation IDs
- **File Logging**: Log file upload and processing events
- **Error Logging**: Log all errors and exceptions

### Tracing

- **Distributed Tracing**: OpenTelemetry integration
- **Request Tracing**: Trace requests across services
- **File Processing Tracing**: Trace file processing pipeline
- **Event Publishing Tracing**: Trace event publishing

## Testing

### Test Categories

- **Unit Tests**: Test individual components
- **Integration Tests**: Test service interactions
- **API Tests**: Test API endpoints
- **File Upload Tests**: Test file upload functionality
- **Event Publishing Tests**: Test event publishing

### Test Coverage

- **Code Coverage**: Minimum 80% code coverage
- **API Coverage**: Test all API endpoints
- **File Type Coverage**: Test all supported file types
- **Error Handling**: Test error scenarios

### Test Data

- **Mock Files**: Test files for different types
- **Mock Events**: Mock event data for testing
- **Test Database**: Isolated test database
- **Mock Storage**: Mock S3 for testing

## Performance Optimization

### File Upload Optimization

- **Chunked Upload**: Large file chunked upload
- **Parallel Processing**: Parallel file processing
- **Compression**: File compression before storage
- **Caching**: Metadata caching

### Database Optimization

- **Connection Pooling**: Database connection pooling
- **Query Optimization**: Optimized database queries
- **Indexing**: Proper database indexing
- **Partitioning**: Table partitioning for large datasets

### Storage Optimization

- **CDN Integration**: CDN for file delivery
- **Lifecycle Policies**: Automatic file cleanup
- **Compression**: Storage compression
- **Deduplication**: File deduplication

## Troubleshooting

### Common Issues

- **File Upload Failures**: Check file size limits and types
- **Storage Issues**: Check S3 connectivity and permissions
- **Event Publishing**: Check message broker connectivity
- **Database Issues**: Check database connectivity and queries

### Debug Mode

- **Verbose Logging**: Enable detailed logging
- **Request Tracing**: Enable request tracing
- **File Processing Debug**: Debug file processing pipeline
- **Event Debug**: Debug event publishing

## Frontend Integration

### User Experience Flow

#### Anonymous User Journey

1. **Visit Website**: User visits alfares.cz without authentication
2. **Form Submission**: User fills out form and submits data
3. **Session Creation**: System creates session and stores data
4. **Session Tracking**: Session ID stored in cookie/localStorage
5. **Registration/Login**: User decides to create account or login
6. **Data Association**: All previous submissions linked to new account
7. **History Access**: User can now see all their submissions

#### Registered User Journey

1. **Login**: User logs in with credentials
2. **Form Submission**: User submits form (data stored under user ID)
3. **History Access**: User can access all their submissions
4. **Session Management**: Existing anonymous sessions can be associated

### Frontend Implementation

#### Session Management

```javascript
// Frontend session management
class SessionManager {
    constructor() {
        this.sessionId = this.getOrCreateSession();
    }
    
    getOrCreateSession() {
        let sessionId = localStorage.getItem('statex_session_id');
        if (!sessionId) {
            sessionId = this.generateSessionId();
            localStorage.setItem('statex_session_id', sessionId);
        }
        return sessionId;
    }
    
    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + 
               '_' + Date.now().toString(36);
    }
    
    async submitForm(formData) {
        const response = await fetch('/api/submissions/anonymous', {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data',
                'X-Session-ID': this.sessionId
            },
            body: formData
        });
        
        return response.json();
    }
    
    async associateWithUser(userId) {
        const response = await fetch('/api/submissions/associate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getAuthToken()}`
            },
            body: JSON.stringify({
                session_id: this.sessionId
            })
        });
        
        return response.json();
    }
}
```

#### Form Submission Component

```javascript
// React component for form submission
const SubmissionForm = ({ isAuthenticated, user }) => {
    const [sessionId, setSessionId] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    
    useEffect(() => {
        if (isAuthenticated) {
            // Load user submissions including associated anonymous ones
            loadUserSubmissions();
        } else {
            // Load session submissions
            loadSessionSubmissions();
        }
    }, [isAuthenticated]);
    
    const handleSubmit = async (formData) => {
        try {
            let response;
            if (isAuthenticated) {
                response = await submitAsUser(formData);
            } else {
                response = await submitAsAnonymous(formData);
            }
            
            // Update submissions list
            setSubmissions(prev => [response.data, ...prev]);
            
            // Show success message
            showSuccessMessage('Submission created successfully');
        } catch (error) {
            showErrorMessage('Failed to submit form');
        }
    };
    
    return (
        <div>
            <form onSubmit={handleSubmit}>
                {/* Form fields */}
            </form>
            
            <div className="submissions-history">
                <h3>Your Submissions</h3>
                {submissions.map(submission => (
                    <SubmissionCard key={submission.id} submission={submission} />
                ))}
            </div>
        </div>
    );
};
```

### Data Persistence Guarantees

#### Disk Storage Requirements

- **All form data MUST be saved to disk** regardless of user authentication status
- **File uploads MUST be stored locally** with proper organization
- **Metadata MUST be persisted** in database for querying and retrieval
- **Session data MUST be maintained** for anonymous users

#### Storage Locations

```text
/data/submissions/
├── users/{user_id}/           # Registered user data
│   └── {submission_id}/
│       ├── metadata.json     # Submission metadata
│       ├── files/            # Uploaded files
│       └── processing/        # AI processing results
├── sessions/{session_id}/     # Anonymous user data
│   └── {submission_id}/
│       ├── metadata.json
│       ├── files/
│       └── processing/
└── temp/                      # Temporary processing files
```

#### Data Association Process

1. **Anonymous Submission**: Data stored under session ID
2. **User Registration**: Session data linked to user account
3. **File Migration**: Files moved from session to user directory
4. **Database Update**: Submission records updated with user ID
5. **History Unification**: User sees all submissions in one place

### Security Considerations

#### Anonymous User Security

- **Session Validation**: Validate session IDs to prevent unauthorized access
- **Rate Limiting**: Limit submissions per session to prevent abuse
- **Data Encryption**: Encrypt sensitive data at rest
- **Session Expiration**: Clean up expired sessions and data

#### Data Privacy

- **PII Handling**: Special handling for personal information
- **Data Retention**: Configurable retention policies
- **User Consent**: Clear consent for data processing
- **Right to Deletion**: Allow users to delete their data

## Future Enhancements

### Planned Features

- **Async File Processing**: Background file processing
- **File Conversion**: Automatic file format conversion
- **Advanced Virus Scanning**: Enhanced security scanning
- **File Preview**: File preview functionality
- **Bulk Upload**: Multiple file upload support
- **Progress Tracking**: Real-time upload progress

### Technical Improvements

- **Streaming Upload**: Streaming file upload for large files
- **Batch Processing**: Batch file processing
- **Advanced Caching**: Multi-level caching strategies
- **Performance Monitoring**: Advanced performance monitoring
- **Data Compression**: Automatic file compression
- **CDN Integration**: Content delivery network for file serving
