# Implementation Plan

- [ ] 1. Create ContentLoader export module
  - Create new file `statex-website/frontend/src/lib/content/ContentLoader.ts` with proper capitalization
  - Export the existing ContentLoader class from contentLoader.ts
  - Export ContentType interface for API route usage
  - _Requirements: 1.1, 1.2_

- [ ] 2. Run build verification
  - Execute `npm run build` to ensure all import errors are resolved
  - Verify no module resolution errors occur during compilation
  - Test both development and production build modes
  - _Requirements: 1.1, 4.1, 4.2, 4.3_

- [ ] 3. Validate API route compatibility
  - Test one AI API route (e.g., pages route) to ensure it can import and use ContentLoader
  - Verify the loadContent method returns data in expected format for AI consumption
  - Check that response structure matches what API routes expect (title, description, content, metadata)
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 4. Test all failing AI routes
  - Test ai/blog/[id]/api/route.ts can import and instantiate ContentLoader
  - Test ai/pages/[page]/route.ts works with new import
  - Test ai/services/[service]/route.ts works with new import
  - Test ai/solutions/[solution]/route.ts works with new import
  - Test ai/legal/[legal]/route.ts works with new import
  - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4_

- [ ] 5. Validate error handling in API routes
  - Test ContentLoader behavior when content files don't exist (should return null)
  - Verify API routes handle null responses correctly (return 404)
  - Test invalid content type handling in API routes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6. Test multi-language support in AI routes
  - Verify AI routes work with different language parameters
  - Test fallback to English when content not available in requested language
  - Validate language-specific content loading for all content types in AI context
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Performance validation
  - Verify caching is working correctly with the new export structure
  - Test that cache keys are properly generated for different content requests
  - Monitor that no performance regression occurs with the new import structure
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  