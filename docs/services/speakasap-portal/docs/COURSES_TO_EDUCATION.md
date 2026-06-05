# Courses → Education migration

## LEGACY: courses app

**The `courses` app is legacy.** If you need to use something from courses, refactor it to the `education` app and remove the legacy code. Do not add new features to courses. See `courses/LEGACY.md`.

## Design: groups as base

- **We use groups as the base.** A "single" student lesson is a group lesson with only 1 student in the group.
- The target is the `education` app: `education.StudentCourse`, `education.Lesson`, `education.Group`, `education.StudentAccess`. Use **only group lessons**.
- New behaviour (e.g. demo) creates `education.Lesson` and `StudentAccess`; it does not create `courses.SingleTeacherLesson` for the UUID path.
- In the legacy `courses` app, `GroupTeacherLesson` is a view over `SingleTeacherLesson` + `BaseStudentCourse` (group_id not null).

## Current bridge (temporary)

- `SingleTeacherLesson.course_uuid` linked to `education.StudentCourse` for the UUID path; new code creates `education.Lesson` instead for that path.
- `education.StudentCourse.basesinglelesson_set` is a compat property pointing to `singleteacherlesson_set` for any legacy code that still expects it.

## Migration direction

- Move all lesson and course logic into `education`. Use only group lessons.
- Refactor to education and remove legacy from courses whenever you touch courses code.

## Student lesson topic change

- Students can change the topic of an upcoming lesson themselves from the lesson page.
- The UI uses the **additional modules** block rendered inside lesson materials (element with id `additional_modules`).
- The list of available replacement topics comes from `Lesson.get_additional_modules()` and is validated in `LessonAdditionSerializer`.
- When a student selects a new topic and confirms, the backend calls `Lesson.change_lesson_topic()` directly.
- No helpdesk ticket is created for this action; notifications are sent to the student and teacher using existing notification templates.
