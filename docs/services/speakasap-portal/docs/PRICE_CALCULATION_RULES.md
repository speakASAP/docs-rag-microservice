# Extra Lessons Price Calculation Rules

## Overview

The price calculation for extra lessons uses volume discounts based on the number of lessons purchased.

## Step-by-Step Calculation Process

### Step 1: Calculate Base Lesson Prices (`set_lessons()` method)

**For Russian Lessons:**

```text
lesson_price = mini_course.price / mini_course.total_hours
```

- If `mini_course` (Product with label='mini' for the language) exists
- `total_hours` is computed from modules (typically 10 for mini courses)
- **Fallback:** `lesson_price = self.price / 10` if mini_course doesn't exist (self.price is total price for 10 lessons)

**For Native Lessons:**

```text
lesson_native_price = native_course.price / native_course.total_hours
```

- If `native_course` (Product with label='native' for the language) exists
- `total_hours` is computed from modules (typically 10 for native courses)
- **Fallback:** `lesson_native_price = self.price / 10` if native_course doesn't exist (self.price is total price for 10 lessons)

### Step 2: Get Volume Discount Coefficient (`coef_russian()` / `coef_native()`)

**Russian Lessons Coefficients:**

| Lessons Count | Coefficient |
| ------------- | ----------- |
| 1-4           | 1.15        |
| 5-9           | 1.05        |
| 10-19         | 1.00        |
| 20-29         | 0.96        |
| 30-39         | 0.94        |
| 40-49         | 0.92        |
| 50+           | 0.90        |

**Native Lessons Coefficients:**

| Lessons Count | Coefficient |
| ------------- | ----------- |
| 1-4           | 1.16        |
| 5-9           | 1.06        |
| 10-19         | 1.00        |
| 20-29         | 0.97        |
| 30-39         | 0.95        |
| 40-49         | 0.93        |
| 50+           | 0.91        |

### Step 3: Calculate Final Price (`get_lessons_price()` method)

**Formula:**

```text
final_price = ceil(coef * lesson_count * lesson_price)
```

Where:

- `coef` = coefficient from Step 2 based on lesson count
- `lesson_count` = number of lessons (russian or native)
- `lesson_price` = base lesson price from Step 1

### Step 4: Calculate Total Price

```text
total_price = price_russian + price_native
```

## Example Calculation

**Scenario:** 4 Russian lessons + 1 Native lesson for German language

1. **Get base prices:**
   - Find mini_course for German (de)
   - `lesson_price = mini_course.price / mini_course.total_hours`
   - Find native_course for German (de)
   - `lesson_native_price = native_course.price / native_course.total_hours`

2. **Get coefficients:**
   - Russian: 4 lessons → coefficient = 1.15
   - Native: 1 lesson → coefficient = 1.16

3. **Calculate prices:**
   - `price_russian = ceil(1.15 * 4 * lesson_price)`
   - `price_native = ceil(1.16 * 1 * lesson_native_price)`

4. **Total:**
   - `total = price_russian + price_native`

## Implementation Flow

1. `ExtraLessonsPriceSerializer.to_representation()` calls:
   - `instance.set_lessons(lessons, lessons_native)` → Sets `lesson_price` and `lesson_native_price`
   - `instance.price_russian(next_lvl_info=True)` → Uses `coef_russian()` and `get_lessons_price()`
   - `instance.price_native(next_lvl_info=True)` → Uses `coef_native()` and `get_lessons_price()`

## Key Methods

- `set_lessons(lessons, lessons_native)` - Calculates base lesson prices
- `coef_russian(count)` - Returns coefficient for Russian lessons based on count
- `coef_native(count)` - Returns coefficient for Native lessons based on count
- `get_lessons_price(coef, count, price)` - Calculates `ceil(coef * count * price)`
- `price_russian(next_lvl_info=False)` - Final Russian price calculation
- `price_native(next_lvl_info=False)` - Final Native price calculation
