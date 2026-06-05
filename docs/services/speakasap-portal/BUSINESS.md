# Business: speakasap-portal
>
> ⚠️ IMMUTABLE BY AI.

## Goal

Django-based education portal for speakasap. Lesson management, teacher/student workflows, lesson recording storage (MinIO).

## Constraints

- Legacy stack: Django 1.11.2 + Python 3.4 — do NOT upgrade without explicit approval
- Do NOT touch supervisord configs without testing in Vagrant first
- Lesson recordings are private — presigned URL access only

## Tech Constraints (Critical)

- Django 1.11.2, Python 3.4
- React 15.4.2, Redux, Webpack 2
- Deploy: `./scripts/deploy.sh` on speakasap server

## Escalation Contact

- Owner Telegram: @sergej_partizan
