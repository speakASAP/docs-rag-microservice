# Content Service

## Overview

The Content Service manages markdown content for the Statex platform, providing both human-readable and AI-optimized content delivery. It handles content creation, editing, versioning, and static site generation for the public website.

## Purpose

- **Content Management**: Create, edit, and manage markdown content
- **Dual Format Delivery**: Serve content for humans (HTML) and AI (Markdown)
- **Static Site Generation**: Generate static website from markdown content
- **Content Versioning**: Track content changes and maintain history
- **AI Optimization**: Optimize content for AI consumption
- **Search and Discovery**: Provide content search and categorization

## Architecture

### Technology Stack

- **Framework**: FastAPI with Python 3.13
- **Database**: PostgreSQL for content metadata and versioning
- **Object Storage**: S3-compatible storage for markdown files
- **Static Generation**: MkDocs or similar for static site generation
- **Search**: Elasticsearch or PostgreSQL full-text search
- **Cache**: Redis for content caching and performance

### Service Dependencies

- **Database**: Content metadata and versioning
- **Object Storage**: Markdown file storage
- **Message Broker**: Content change events
- **Static Generator**: Static site generation
- **CDN**: Content delivery network for static assets

## API Endpoints

### Content Management Endpoints

```text
GET /api/content
  - List all content items
  - Filter by category, status, author

GET /api/content/{content_id}
  - Get specific content item
  - Include metadata and version history

POST /api/content
  - Create new content item
  - Upload markdown file

PUT /api/content/{content_id}
  - Update content item
  - Modify metadata and content

DELETE /api/content/{content_id}
  - Delete content item
  - Soft delete with archive option
```

### Content Delivery Endpoints

```text
GET /api/content/{content_id}/html
  - Get HTML version for humans
  - Rendered with styling

GET /api/content/{content_id}/markdown
  - Get raw markdown for AI
  - Optimized for AI consumption

GET /api/content/{content_id}/ai-optimized
  - Get AI-optimized version
  - Structured for AI processing
```

### Static Site Endpoints

```text
POST /api/static/generate
  - Generate static site
  - Trigger build process

GET /api/static/status
  - Get build status
  - Show build progress

GET /api/static/download
  - Download static site
  - Get build artifacts
```

### Search Endpoints

```text
GET /api/search
  - Search content
  - Full-text search with filters

GET /api/search/suggestions
  - Get search suggestions
  - Auto-complete functionality
```

## Data Models

### Content Model

```python
class Content(BaseModel):
    id: UUID
    title: str
    slug: str
    content_type: str  # article, page, documentation
    status: ContentStatus  # draft, published, archived
    author_id: UUID
    category: Optional[str] = None
    tags: List[str] = []
    metadata: Dict[str, Any] = {}
    markdown_content: str
    html_content: Optional[str] = None
    ai_optimized_content: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    version: int = 1
```

### Content Version Model

```python
class ContentVersion(BaseModel):
    id: UUID
    content_id: UUID
    version: int
    title: str
    markdown_content: str
    html_content: Optional[str] = None
    ai_optimized_content: Optional[str] = None
    changes: List[str] = []  # List of changes made
    created_at: datetime
    created_by: UUID
```

### Content Category Model

```python
class ContentCategory(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
```

## Content Processing

### Markdown Processing

```python
class MarkdownProcessor:
    def __init__(self):
        self.md = markdown.Markdown(
            extensions=[
                'codehilite',
                'toc',
                'tables',
                'fenced_code',
                'attr_list',
                'def_list',
                'footnotes',
                'md_in_html'
            ]
        )
    
    def process_markdown(self, content: str) -> Dict[str, str]:
        """Process markdown content for different outputs"""
        # HTML for humans
        html_content = self.md.convert(content)
        
        # AI-optimized content
        ai_content = self._optimize_for_ai(content)
        
        return {
            'html': html_content,
            'ai_optimized': ai_content,
            'raw_markdown': content
        }
    
    def _optimize_for_ai(self, content: str) -> str:
        """Optimize markdown content for AI consumption"""
        # Remove unnecessary formatting
        # Add structured metadata
        # Ensure consistent formatting
        # Add AI-specific annotations
        pass
```

### Content Validation

```python
class ContentValidator:
    def __init__(self):
        self.schema_validator = jsonschema.Validator()
    
    def validate_content(self, content: Content) -> List[str]:
        """Validate content structure and format"""
        errors = []
        
        # Validate markdown syntax
        markdown_errors = self._validate_markdown(content.markdown_content)
        errors.extend(markdown_errors)
        
        # Validate metadata
        metadata_errors = self._validate_metadata(content.metadata)
        errors.extend(metadata_errors)
        
        # Validate required fields
        required_errors = self._validate_required_fields(content)
        errors.extend(required_errors)
        
        return errors
    
    def _validate_markdown(self, content: str) -> List[str]:
        """Validate markdown syntax"""
        errors = []
        try:
            markdown.markdown(content)
        except Exception as e:
            errors.append(f"Markdown syntax error: {e}")
        return errors
```

## Static Site Generation

### Site Generator

```python
class StaticSiteGenerator:
    def __init__(self, config: SiteConfig):
        self.config = config
        self.mkdocs = MkDocsGenerator(config)
    
    async def generate_site(self, content_items: List[Content]) -> BuildResult:
        """Generate static site from content"""
        try:
            # Prepare content for MkDocs
            mkdocs_content = self._prepare_mkdocs_content(content_items)
            
            # Generate navigation
            navigation = self._generate_navigation(content_items)
            
            # Build site
            build_result = await self.mkdocs.build(
                content=mkdocs_content,
                navigation=navigation
            )
            
            # Upload to S3/CDN
            upload_result = await self._upload_to_cdn(build_result)
            
            return BuildResult(
                status="success",
                build_id=build_result.build_id,
                url=upload_result.url,
                artifacts=upload_result.artifacts
            )
            
        except Exception as e:
            return BuildResult(
                status="failed",
                error=str(e)
            )
    
    def _prepare_mkdocs_content(self, content_items: List[Content]) -> Dict[str, str]:
        """Prepare content for MkDocs format"""
        mkdocs_content = {}
        for content in content_items:
            if content.status == ContentStatus.PUBLISHED:
                file_path = f"{content.slug}.md"
                mkdocs_content[file_path] = content.markdown_content
        return mkdocs_content
```

### Build Management

```python
class BuildManager:
    def __init__(self, db: Database, cache: Cache):
        self.db = db
        self.cache = cache
        self.generator = StaticSiteGenerator()
    
    async def trigger_build(self, trigger_type: str) -> BuildJob:
        """Trigger static site build"""
        build_job = BuildJob(
            id=uuid.uuid4(),
            trigger_type=trigger_type,
            status=BuildStatus.PENDING,
            created_at=datetime.utcnow()
        )
        
        await self.db.create_build_job(build_job)
        await self._queue_build(build_job)
        
        return build_job
    
    async def _queue_build(self, build_job: BuildJob):
        """Queue build job for processing"""
        # Add to build queue
        await self.cache.lpush("build_queue", build_job.id)
        
        # Process build asynchronously
        asyncio.create_task(self._process_build(build_job))
    
    async def _process_build(self, build_job: BuildJob):
        """Process build job"""
        try:
            build_job.status = BuildStatus.BUILDING
            await self.db.update_build_job(build_job)
            
            # Get all published content
            content_items = await self.db.get_published_content()
            
            # Generate site
            result = await self.generator.generate_site(content_items)
            
            if result.status == "success":
                build_job.status = BuildStatus.COMPLETED
                build_job.build_url = result.url
            else:
                build_job.status = BuildStatus.FAILED
                build_job.error_message = result.error
            
            build_job.completed_at = datetime.utcnow()
            await self.db.update_build_job(build_job)
            
        except Exception as e:
            build_job.status = BuildStatus.FAILED
            build_job.error_message = str(e)
            build_job.completed_at = datetime.utcnow()
            await self.db.update_build_job(build_job)
```

## AI Content Optimization

### AI Content Processor

```python
class AIContentProcessor:
    def __init__(self):
        self.llm_client = LLMClient()
    
    async def optimize_for_ai(self, content: Content) -> str:
        """Optimize content for AI consumption"""
        # Extract key information
        key_info = self._extract_key_information(content)
        
        # Structure content for AI
        structured_content = self._structure_for_ai(content, key_info)
        
        # Add AI-specific metadata
        ai_metadata = self._add_ai_metadata(content, key_info)
        
        # Generate AI-optimized version
        ai_content = await self._generate_ai_content(
            content.markdown_content,
            structured_content,
            ai_metadata
        )
        
        return ai_content
    
    def _extract_key_information(self, content: Content) -> Dict[str, Any]:
        """Extract key information from content"""
        return {
            'title': content.title,
            'category': content.category,
            'tags': content.tags,
            'key_concepts': self._extract_concepts(content.markdown_content),
            'summary': self._extract_summary(content.markdown_content),
            'structure': self._analyze_structure(content.markdown_content)
        }
    
    async def _generate_ai_content(self, markdown: str, structured: Dict, metadata: Dict) -> str:
        """Generate AI-optimized content using LLM"""
        prompt = f"""
        Optimize the following markdown content for AI consumption:
        
        Original content:
        {markdown}
        
        Key information:
        {json.dumps(structured, indent=2)}
        
        Metadata:
        {json.dumps(metadata, indent=2)}
        
        Please create an AI-optimized version that:
        1. Maintains all important information
        2. Uses clear, structured formatting
        3. Includes relevant metadata
        4. Is optimized for AI processing
        """
        
        response = await self.llm_client.generate(prompt)
        return response.content
```

## Search and Discovery

### Search Engine

```python
class ContentSearchEngine:
    def __init__(self, db: Database, elasticsearch: Elasticsearch):
        self.db = db
        self.es = elasticsearch
    
    async def search_content(self, query: str, filters: Dict[str, Any] = None) -> SearchResult:
        """Search content with full-text search"""
        search_body = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^2", "content", "tags", "category"]
                            }
                        }
                    ],
                    "filter": self._build_filters(filters)
                }
            },
            "highlight": {
                "fields": {
                    "title": {},
                    "content": {}
                }
            },
            "sort": [
                {"_score": {"order": "desc"}},
                {"published_at": {"order": "desc"}}
            ]
        }
        
        response = await self.es.search(
            index="content",
            body=search_body,
            size=20
        )
        
        return self._format_search_results(response)
    
    def _build_filters(self, filters: Dict[str, Any]) -> List[Dict]:
        """Build Elasticsearch filters"""
        es_filters = []
        
        if filters:
            if 'category' in filters:
                es_filters.append({
                    "term": {"category": filters['category']}
                })
            
            if 'status' in filters:
                es_filters.append({
                    "term": {"status": filters['status']}
                })
            
            if 'tags' in filters:
                es_filters.append({
                    "terms": {"tags": filters['tags']}
                })
        
        return es_filters
```

## Configuration

### Environment Variables

```bash
# Service Configuration
SERVICE_NAME=content-service
SERVICE_PORT=8000
LOG_LEVEL=INFO
ENVIRONMENT=production

# Database
DATABASE_URL=DATABASE_URL=postgresql+psycopg://dbadmin:your_password@db-server-postgres:5432/statex_content
REDIS_URL=redis://db-server-redis:6379/0

# Cache
REDIS_POOL_SIZE=10

# Message Broker
RABBITMQ_URL=amqp://user:password@localhost:5672
BROKER_TOPIC=content
BROKER_RETRY_ATTEMPTS=3
BROKER_RETRY_DELAY=1000

# Static Site Generation
MKDOCS_CONFIG_PATH=/app/mkdocs.yml
STATIC_SITE_BUCKET=statex-static
CDN_URL=https://cdn.alfares.cz
BUILD_TIMEOUT=300

# Search
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_INDEX=content
SEARCH_RESULTS_PER_PAGE=20

# AI Optimization
LLM_API_URL=http://ai-orchestrator:8000
LLM_API_KEY=your-llm-api-key
AI_OPTIMIZATION_ENABLED=true

# Content Validation
MAX_CONTENT_SIZE=10485760  # 10MB
CONTENT_VALIDATION_ENABLED=true

```

## Deployment

### Docker Configuration

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install MkDocs
RUN pip install mkdocs mkdocs-material

# Copy application code
COPY . .

# Copy MkDocs configuration
COPY mkdocs.yml /app/

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
- **Dependency Checks**: Database, Redis, S3, Elasticsearch connectivity

### Metrics

- **Content Metrics**: Content count, creation rate, update rate
- **Build Metrics**: Build count, duration, success rate
- **Search Metrics**: Search count, response time, result count
- **Cache Metrics**: Cache hit rate, miss rate, eviction rate

### Logging

- **Structured Logging**: JSON-formatted logs
- **Content Logging**: Log all content operations
- **Build Logging**: Log build process and results
- **Search Logging**: Log search queries and results

### Tracing

- **Distributed Tracing**: OpenTelemetry integration
- **Content Tracing**: Trace content processing
- **Build Tracing**: Trace build process
- **Search Tracing**: Trace search operations

## Performance Optimization

### Caching Strategies

- **Content Caching**: Cache frequently accessed content
- **Search Caching**: Cache search results
- **Build Caching**: Cache build artifacts
- **CDN Integration**: Use CDN for static content delivery

### Database Optimization

- **Connection Pooling**: Database connection pooling
- **Query Optimization**: Optimized database queries
- **Indexing**: Proper database indexing
- **Partitioning**: Table partitioning for large datasets

### Search Optimization

- **Index Optimization**: Optimize Elasticsearch indices
- **Query Optimization**: Optimize search queries
- **Result Caching**: Cache search results
- **Faceted Search**: Implement faceted search

## Testing

### Test Categories

- **Unit Tests**: Test individual components
- **Integration Tests**: Test service interactions
- **Content Tests**: Test content processing
- **Build Tests**: Test static site generation

### Test Coverage

- **Code Coverage**: Minimum 80% code coverage
- **Content Coverage**: Test all content types
- **Build Coverage**: Test build process
- **Search Coverage**: Test search functionality

### Test Data

- **Mock Content**: Test content data
- **Mock Builds**: Test build scenarios
- **Mock Search**: Test search scenarios
- **Test Files**: Test markdown files

## Troubleshooting

### Common Issues

- **Build Failures**: Check MkDocs configuration and content
- **Search Issues**: Check Elasticsearch connectivity and indices
- **Content Processing**: Check markdown syntax and validation
- **Storage Issues**: Check S3 connectivity and permissions

### Debug Mode

- **Verbose Logging**: Enable detailed logging
- **Content Debug**: Debug content processing
- **Build Debug**: Debug build process
- **Search Debug**: Debug search operations

## Future Enhancements

### Planned Features

- **Content Collaboration**: Multi-user content editing
- **Content Templates**: Predefined content templates
- **Advanced Search**: Faceted search and filtering
- **Content Analytics**: Content performance analytics

### Technical Improvements

- **Real-time Updates**: Real-time content updates
- **Advanced Caching**: Multi-level caching strategies
- **Performance Monitoring**: Advanced performance monitoring
- **Auto-scaling**: Automatic scaling based on load
