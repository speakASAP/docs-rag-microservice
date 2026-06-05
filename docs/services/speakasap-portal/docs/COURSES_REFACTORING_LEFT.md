# Courses → Education: What’s Left to Refactor

**Context:** `courses` is legacy; `education` is the new app. See `courses/LEGACY.md` and `docs/COURSES_TO_EDUCATION.md`.

This doc lists **what still uses the courses app** and should be refactored to use education (or removed).

---

## 1. External apps importing from `courses` (outside `courses/`)

Refactor these to use `education` models and APIs; then remove the legacy usage.

### 1.1 Education app (already depends on courses for bridge)

| File | What it uses from courses | Refactor action |
| ---- | ------------------------- | ---------------- |
| `education/course_product/models.py` | `BaseCourse`, `BaseStudentCourse` | Use education equivalents or keep FK to courses tables until full migration; document as bridge. |
| `education/demo_models.py` | `Course`, `after_demo_from_manager` (tasks) | Move demo task to education.tasks; use education.StudentCourse/Course where possible. |
| `education/api/student/serializers/courses.py` | `courses.serializers.base.TeacherSerializer` | Move TeacherSerializer to education (or shared app) and use from there. |

### 1.2 Certificates

| File | What it uses | Refactor action |
| ---- | ------------ | ---------------- |
| `certificates/models.py` | `Course`, `StudentGroup`, `BaseCourse`, `course_finished` signal | Certificate already uses `education.models.StudentCourse`. Replace cert logic that uses Course/BaseCourse/StudentGroup with education models; switch to education signals where applicable. |
| `certificates/management/commands/generate_course_certificate.py` | `CourseProduct` | Use education course product or equivalent. |

### 1.3 Cabinet (manager / teacher)

| File | What it uses | Refactor action |
| ---- | ------------ | ---------------- |
| `cabinet/manager/forms.py` | `BaseCourse` | Use education equivalent for “base course” selection. |
| `cabinet/manager/views/groups.py` | `GroupTeacherLesson` | Use education.Lesson (group lessons) and related APIs. |

### 1.4 Employees

| File | Function / usage | Refactor action |
| ---- | ---------------- | ---------------- |
| `employees/models/common.py` | `language_for_student()`: `SingleTeacherLesson` + `course__base_course__language__machine_name` | Use education.Lesson and education.StudentCourse (and language from education/course data). |
| `employees/models/common.py` | `paid_after_demo`: `BaseStudentCourse` for “finished demo” compatibility | Use education.StudentCourse and education.Lesson for demo; remove legacy path when no longer needed. |

### 1.5 Notifications

| File | Function / usage | Refactor action |
| ---- | ---------------- | ---------------- |
| `notifications/tasks.py` | Lesson resolution (two places): tries `SingleTeacherLesson` then `education.models.Lesson` | Keep dual lookup until all lessons are in education; then use only Lesson. |

### 1.6 Helpdesk

| File | What it uses | Refactor action |
| ---- | ------------ | ---------------- |
| `helpdesk/views.py` | `BonusStudentCourse` (ticket delete: clear notification_ticket) | Use education model for “bonus student course” if it exists; otherwise keep minimal import until migration. |

### 1.7 Orders

| File | What it uses | Refactor action |
| ---- | ------------ | ---------------- |
| `orders/serializers.py` | `Module`, `Course`, `BaseStudentCourse` | Use education equivalents (education.StudentCourse, course structure from education). |

### 1.8 Other apps

| File | What it uses | Refactor action |
| ---- | ------------ | --------------- |
| `expenses/models.py` | `StudentGroup` | Use education.Group (or equivalent) and update FKs. |
| `products/forms.py` | `SingleTeacherLesson` | Use education.Lesson. |
| `inspinia/api_views.py` | `SingleTeacherLesson`, `Project` | Use education.Lesson and education-related project/course. |

---

## 2. Legacy courses API (still in use)

These live under **`/api/courses/`** (see `rest/urls.py`: `courses.api_urls`, `courses.homework.api_urls`).

### 2.1 API views and serializers (courses app)

- **`courses/api_views/base.py`**  
  - `BaseCourseList`, `BaseCourseRetrieve`, `ModuleList`, `ModuleItem`, `MyCoursesList`, `MyCoursesDetail`, `MyCourseStart`, …  
  - Uses: `Module`, `BaseCourse`, `BaseStudentCourse`, `BaseSingleLesson`, `LessonStart`, `LessonFinish`, `GroupTeacherLesson`, `CourseProduct`.  
  - **Refactor:** Reimplement in education API (manager/student/teacher) using `education.StudentCourse`, `education.Lesson`, `education.Group`, and stop using courses models.

- **`courses/api_views/with_teacher.py`**  
  - Uses: `SingleTeacherLesson`, `GroupTeacherLesson`, `LessonStartChange`.  
  - **Refactor:** Move “change lesson start” (and any other teacher lesson actions) to education API (e.g. `education.api.teacher`).

- **`courses/api_views/exercises.py`**  
  - Uses: `ModuleExercise`, `Module`.  
  - **Refactor:** Move to education (or shared) and use education course/module structure.

- **`courses/api_views/questionnaires.py`**  
  - Uses: `SingleTeacherLesson`, pre/post quest serializers.  
  - **Refactor:** Use education.Lesson and education-based serializers.

- **`courses/homework/api_views.py`**  
  - Uses: `Homework`, `SingleTeacherLesson`.  
  - **Refactor:** Education already has `education.api.*.homework`; migrate homework to education.Lesson and deprecate courses homework API.

- **`courses/serializers/base.py`**  
  - Uses: `Module`, `BaseCourse`, `BaseStudentCourse`, `Teacher`, `CourseProduct`.  
  - Used by education’s student serializers (`TeacherSerializer`). Move needed serializers to education (or shared).

### 2.2 Frontend still calling `/api/courses/`

- **inspinia (legacy):**
  - `inspinia/static/.../student/factories/courses.js` (and .ts): `/api/courses/my/`, `/api/courses/my/lessons/`.
  - `inspinia/static/.../products/factories.js`: `/api/courses/course_products.json`.
  - `inspinia/static/.../materials/controllers/exercises.js`: `/api/courses/exercises/`.
  - `inspinia/static/.../course/course.js`: `/api/courses/courses/`, `/api/courses/modules/`.
- **Refactor:** Point these to education (and/or v2) endpoints and then remove or deprecate the corresponding courses API.

---

## 3. Courses app internal (to migrate or remove)

- **Models:** `courses/models/base.py`, `courses/models/with_teacher.py`, `courses/models/demo.py` — core legacy; logic should move to education, with DB tables migrated or kept as legacy tables only.
- **Signals:** `courses.signals` (e.g. `lesson_finished`, `course_finished`) — used by certificates and others; move handlers to education signals and rewire.
- **Admin:** `courses/admin.py` — uses courses models; after migration, either move to education admin or keep read-only for legacy data.
- **Homework:** `courses/homework/` (models, api_views, handlers) — migrate to education homework and education.Lesson.
- **Salary:** `courses/salary/utils.py`, `courses/salary/management/commands/check_lesson_expenses.py` — use `SingleTeacherLesson`, `GroupTeacherLesson`; refactor to use education.Lesson and education-related expense models.
- **Management commands:** e.g. `import_demo_lessons`, `log_codes_of_courses`, `update_course`, `migrate_exercises`, `make_teacher_materials`, `make_course_exercises`, `create_basic_products`, `course_material2pdf`, `course2pdf` — each should be reviewed: either move to education app or adapt to use education models only.
- **Templatetags:** `courses/templatetags/course_tags.py` (`CourseProduct`) — use education product/course and move tag to education or shared.
- **Triggers/tasks:** `courses/triggers`, `courses/tasks` — used by demo and others; move to education.tasks/education.triggers.

**Note:** Do not modify migration files; only add new migrations if needed when moving models.

---

## 4. Summary by “courses” concept

| Concept | Where it’s used | Refactor target |
| ------ | ---------------- | ---------------- |
| **BaseCourse / BaseStudentCourse** | education/course_product, certificates, cabinet/manager/forms, orders/serializers, employees, courses API | education.StudentCourse + base course data in education |
| **SingleTeacherLesson / GroupTeacherLesson** | notifications, employees, products/forms, inspinia, courses API, homework, salary | education.Lesson (group lesson, 1 student = group of 1) |
| **Course, Step, DemoCourse** | certificates, orders, tests, management commands | education.StudentCourse + education demo/course |
| **CourseProduct** | certificates mgmt, courses serializers/templatetags, create_basic_products | education.course_product (or equivalent) |
| **StudentGroup** | certificates, expenses | education.Group |
| **BonusStudentCourse** | helpdesk (ticket delete) | education bonus course model or minimal bridge |
| **Module / ModuleExercise** | orders, courses API (exercises, base), management commands | education course structure / exercises |
| **course_finished signal** | certificates | education signals |
| **TeacherSerializer (courses)** | education student serializers | Move to education or shared |

---

## 5. Suggested order of work

1. **Move TeacherSerializer** from courses to education (or shared) and fix `education/api/student/serializers/courses.py`.
2. **Unify lesson resolution** in notifications to prefer education.Lesson and document deprecation of SingleTeacherLesson for new code.
3. **Migrate cabinet/manager** (forms + groups view) to education models.
4. **Migrate employees** `language_for_student` and `paid_after_demo` to education.
5. **Certificates:** Replace Course/BaseCourse/StudentGroup usage with education models and education signals.
6. **Orders serializers:** Use education.StudentCourse and course structure.
7. **Replace courses API** with education API for my-courses, lessons, exercises, homework, course_products (and update inspinia + any other clients).
8. **Homework:** Full switch to education homework + education.Lesson; remove courses homework API.
9. **Salary and expenses:** Switch to education.Lesson and education.Group.
10. **Demo/bonus:** Move tasks and triggers to education; use education models only.
11. **Management commands:** Move or adapt to education; then remove or deprecate courses commands.
12. **Last:** Remove or slim down courses app to legacy tables only (no new behaviour).

This file can be updated as refactors are completed (e.g. mark items done and add “Completed: …” lines).
