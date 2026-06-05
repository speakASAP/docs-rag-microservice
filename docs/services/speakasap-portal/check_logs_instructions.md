# Instructions to Check Production Logs for Product 286 Issue

## Step 1: Connect to Production Server

```bash
ssh speakasap
cd speakasap-portal
```

## Step 2: Run Diagnostic Script

```bash
python check_product_286.py
```

This will show:

- Whether product 286 exists
- If it's trashed
- Recent log entries related to the issue

## Step 3: Check Application Logs

```bash
# Check recent ExtraLessonsPriceView requests
tail -n 200 logs/app.log | grep -i "ExtraLessonsPriceView" | grep -i "286"

# Check error logs
tail -n 200 logs/app_errors.log | grep -i "286"

# Check all recent API requests for extra_lessons
tail -n 500 logs/app.log | grep -i "extra_lessons.*286"
```

## Step 4: Check Gunicorn Logs

```bash
# Check access log for 404 errors
tail -n 200 /var/log/gunicorn/access_log_speakasap | grep "404" | grep "extra_lessons"

# Check error log
tail -n 200 /var/log/gunicorn/error_log_speakasap | grep -i "286"
```

## Step 5: Check Database Directly

```bash
# Connect to Django shell
python manage.py shell

# Then run:
from education.course_product.models import ExtraLessonsStudentCourseProduct
product = ExtraLessonsStudentCourseProduct.objects.filter(id=286).first()
if product:
    print(f"Product exists: {product.title}")
    print(f"Trashed: {product.trashed}")
    print(f"Language: {product.language.code if product.language else 'None'}")
else:
    print("Product 286 does not exist")

# Check active products
active = ExtraLessonsStudentCourseProduct.objects.filter(trashed=False)
print(f"Active products: {active.count()}")
for p in active[:10]:
    print(f"  - ID {p.id}: {p.title} ({p.language.code if p.language else 'None'})")
```

## Step 6: Check What Products Are Available

```bash
python manage.py shell
```

```python
from education.course_product.models import ExtraLessonsStudentCourseProduct
from language.models import Language

# Get all active products
products = ExtraLessonsStudentCourseProduct.objects.filter(trashed=False)
print(f"Total active products: {products.count()}")
for p in products:
    print(f"ID: {p.id}, Title: {p.title}, Language: {p.language.code if p.language else 'None'}")

# Check if product 286 exists at all (including trashed)
all_286 = ExtraLessonsStudentCourseProduct.objects.filter(id=286)
if all_286.exists():
    p = all_286.first()
    print(f"\nProduct 286 exists:")
    print(f"  Title: {p.title}")
    print(f"  Trashed: {p.trashed}")
    print(f"  Language: {p.language.code if p.language else 'None'}")
```

## Common Issues and Fixes

### Issue 1: Product is Trashed

**Fix:** Untrash the product in Django admin

- Go to `/admin/education/extralessonsstudentcourseproduct/286/change/`
- Uncheck "Trashed" field
- Save

### Issue 2: Product Doesn't Exist

**Fix:** Check what product IDs are actually available and update frontend to use correct IDs

### Issue 3: Frontend Using Wrong Product ID

**Fix:** Check browser console to see which product is selected, verify it matches available products

## Quick Fix Command (if product is trashed)

```bash
python manage.py shell
```

```python
from education.course_product.models import ExtraLessonsStudentCourseProduct
product = ExtraLessonsStudentCourseProduct.objects.filter(id=286).first()
if product and product.trashed:
    product.trashed = False
    product.save()
    print(f"Product {product.id} untrashed successfully")
else:
    print("Product not found or already active")
```
