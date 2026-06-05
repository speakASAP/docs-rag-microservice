# DateTime Picker Removal Implementation Plan

## Objective

Replace jQuery-based datetime picker components on teacher lesson page with simple manual HTML5 date/time inputs to reduce page size and improve load speed.

## Target Page

- URL: `https://speakasap.com/teacher/students/{student_id}/lessons/{lesson_id}/`
- Component: `LessonStartForm` → `DateTimePicker`
- Template: `cabinet/templates/cabinet/widgets/lesson_start_change.html`

## Implementation Tasks

### ✅ Task 1: Refactor DateTimePicker Component

**File**: `src/incab/common/components/form/DateTimePicker.jsx`

**Changes**:

- Removed all jQuery datepicker and clockpicker plugin dependencies
- Replaced with native HTML5 `<input type="date">` and `<input type="time">` elements
- Simplified component to use React state instead of uncontrolled inputs with jQuery plugins
- Removed `componentDidMount`, `componentWillUnmount`, and `initPickersOnce` methods
- Simplified `componentDidUpdate` to only handle prop changes
- Updated `notifyChange` to work with controlled inputs

**Benefits**:

- No jQuery plugin initialization overhead
- Smaller bundle size
- Faster page load
- Native browser date/time pickers (better UX on mobile)

### ✅ Task 2: Remove CSS and JS Loading

**File**: `templates/incab/index.html`

**Changes**:

- Removed `<link>` tags for:
  - `incab/css/plugins/datapicker/datepicker3.css`
  - `incab/css/plugins/clockpicker/clockpicker.css`
- Removed entire fallback script block that loaded:
  - `bootstrap-datepicker.js`
  - `clockpicker.js`

**Benefits**:

- Reduced HTTP requests
- Smaller page size
- Faster initial page load

### ✅ Task 3: Update Webpack Build Configuration

**Files**:

- `portal/static/incab/build.js`
- `portal/static/incab/package.json`

**Changes**:

- Removed `bootstrap-datepicker` from `plugins-ui` bundle
- Removed `clockpicker.js` from `plugins-optional` bundle
- Removed `bootstrap-datepicker` dependency from `package.json`

**Benefits**:

- Smaller JavaScript bundles
- Faster bundle loading
- Reduced npm dependencies

### ⏳ Task 4: Testing

**Required Actions**:

- Build frontend bundles: `cd portal/static/incab && yarn build`
- Test teacher lesson page date/time input functionality
- Verify form submission still works correctly
- Check browser compatibility (HTML5 date/time inputs)

### 📝 Task 5: Documentation

**Status**: In progress

- This document serves as the implementation plan
- Changes documented with ✅ markers for completed tasks

## Notes

### Components Not Affected

- Manager interface components (`src/incab/manager/components/groups/DatePicker.jsx`) use Ant Design DatePicker, which is separate
- Legacy bundles (`scripts/build-legacy-assets.js`) remain unchanged as they may be used by other parts of the site

### Browser Compatibility

- HTML5 `<input type="date">` and `<input type="time">` are supported in all modern browsers
- Older browsers (IE11) will fall back to text input, which is acceptable for manual entry

## Summary

All code changes have been completed. The datetime picker has been successfully replaced with simple manual inputs, and all related libraries and scripts have been removed from the teacher portal page to improve performance.
