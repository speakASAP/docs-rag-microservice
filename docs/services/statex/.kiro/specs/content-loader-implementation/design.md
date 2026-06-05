# Design Document

## Overview

The ContentLoader implementation needs to bridge the gap between the existing lowercase `contentLoader.ts` and the expected uppercase `ContentLoader` import in API routes. The solution involves creating a proper export structure that allows both the existing functionality to continue working while providing the expected interface for AI-optimized API routes.

## Architecture

### Current State Analysis

- Existing file: `statex-website/frontend/src/lib/content/contentLoader.ts` (lowercase)
- Expected import: `@/lib/content/ContentLoader` (uppercase)
- The existing ContentLoader class has comprehensive functionality for loading various content types
- API routes expect to instantiate `new ContentLoader()` and call `loadContent()` method

### Proposed Solution

Create a new file `ContentLoader.ts` (uppercase) that exports the existing ContentLoader class and provides a clean interface for the API routes. This approach maintains backward compatibility while fixing the import issues.

## Components and Interfaces

### 1. ContentLoader Export Module

**File**: `statex-website/frontend/src/lib/content/ContentLoader.ts`

**Purpose**: Provide a clean export of the ContentLoader class with the expected capitalization

**Interface**:

```typescript
export { ContentLoader } from './contentLoader';
export type { ContentType } from './types';
```

### 2. Enhanced ContentLoader Class

**Location**: Existing `contentLoader.ts` file

**Enhancements Needed**:

- Ensure the `loadContent()` method signature matches API route expectations
- Verify return types are compatible with AI consumption
- Add any missing content type support

### 3. API Route Integration

**Files**: Multiple API route files in `statex-website/frontend/src/app/ai/`

**Expected Interface**:

```typescript
const contentLoader = new ContentLoader();
const content = await contentLoader.loadContent(contentType, slug, language);
```

## Data Models

### Content Response Structure

Based on the API route analysis, the expected response structure is:

```typescript
interface AIContentResponse {
  slug: string;
  language: string;
  title: string;
  description: string;
  content: string; // Raw markdown content
  metadata: any;
  author?: string;
  date?: string;
  category?: string;
  tags?: string[];
  lastModified?: string;
}
```

### ContentLoader Method Signature

```typescript
loadContent(
  contentType: 'blog' | 'pages' | 'services' | 'solutions' | 'legal',
  slug: string,
  language: string
): Promise<ProcessedContent | null>
```

## Error Handling

### Import Resolution

- **Issue**: Module not found errors for `@/lib/content/ContentLoader`
- **Solution**: Create proper export file with correct capitalization
- **Fallback**: Ensure graceful degradation if content not found

### Content Loading Errors

- **Existing**: The current ContentLoader already has comprehensive error handling
- **Enhancement**: Ensure all error cases return null instead of throwing
- **Logging**: Maintain existing error logging for debugging

### API Route Error Responses

- **404 Response**: When content not found
- **500 Response**: When internal errors occur
- **Caching Headers**: Proper cache control for performance

## Testing Strategy

### Unit Tests

1. **Import Resolution Test**
   - Verify `import { ContentLoader } from '@/lib/content/ContentLoader'` works
   - Test instantiation: `new ContentLoader()`

2. **Content Loading Tests**
   - Test each content type (blog, pages, services, solutions, legal)
   - Test multi-language support
   - Test error scenarios (missing files, invalid content)

3. **API Integration Tests**
   - Test each API route can import and use ContentLoader
   - Verify response format matches expected structure
   - Test caching behavior

### Integration Tests

1. **End-to-End API Tests**
   - Test full request/response cycle for each API route
   - Verify content is properly formatted for AI consumption
   - Test language parameter handling

2. **Performance Tests**
   - Verify caching is working effectively
   - Test response times for content loading
   - Monitor memory usage with large content sets

### Build Tests

1. **Compilation Tests**
   - Ensure Next.js build completes without module resolution errors
   - Verify TypeScript compilation passes
   - Test both development and production builds

## Implementation Approach

### Phase 1: Fix Import Issues

1. Create `ContentLoader.ts` export file
2. Verify all API routes can import successfully
3. Test basic functionality

### Phase 2: Validate Content Structure

1. Ensure `loadContent()` method returns expected format
2. Verify AI-optimized content structure
3. Test multi-language content loading

### Phase 3: Optimize Performance

1. Verify caching is working correctly
2. Add performance monitoring
3. Optimize content loading for AI consumption

### Phase 4: Testing and Validation

1. Run comprehensive test suite
2. Perform build validation
3. Test API endpoints manually
4. Validate AI content consumption

## Dependencies

### Existing Dependencies

- `fs/promises`: File system operations
- `path`: Path manipulation
- `gray-matter`: Frontmatter parsing
- `remark`: Markdown processing

### No New Dependencies Required

The solution uses existing infrastructure and doesn't require additional packages.

## Performance Considerations

### Caching Strategy

- Leverage existing `cacheService` integration
- Maintain cache keys for different content types and languages
- Ensure cache invalidation works properly

### Memory Management

- Avoid loading all content into memory at startup
- Use lazy loading for content requests
- Implement proper cleanup for large content sets

### Response Optimization

- Return only necessary fields for AI consumption
- Minimize JSON payload size
- Use appropriate HTTP caching headers
