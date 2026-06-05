# Courses app — LEGACY

**The `courses` app is legacy.** Do not extend it for new behaviour.

- **If you need to use something from courses:** refactor that behaviour into the `education` app and remove the legacy code from courses.
- **Target model:** `education` app — use `education.StudentCourse`, `education.Lesson`, `education.Group`, `education.StudentAccess`. Lessons are **group lessons** (single student = group of 1).
- **Do not add new features to courses.** Prefer education and only group lessons.

See `docs/COURSES_TO_EDUCATION.md` for migration design and bridge details.
