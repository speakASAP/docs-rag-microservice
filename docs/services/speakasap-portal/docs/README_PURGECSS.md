# PurgeCSS - Удаление неиспользуемого CSS

## Быстрый старт

### Установка

```bash
# Автоматическая установка
./scripts/install_purgecss.sh

# Или вручную
npm install --save-dev --legacy-peer-deps purgecss@^1.1.0
```

### Использование

```bash
# Запустить PurgeCSS
npm run purgecss

# Собрать проект и запустить PurgeCSS
npm run build:purge
```

## На production сервере

Согласно `.cursor/rules/prod.mdc`:

```bash
# 1. Подключиться к серверу
ssh speakasap && cd speakasap-portal

# 2. Установить PurgeCSS (если еще не установлен)
npm install --save-dev --legacy-peer-deps purgecss@^1.1.0

# 3. Запустить PurgeCSS
npm run purgecss

# 4. Проверить результат
ls -lh public/assets/portal.css public/assets/portal.purged.css

# 5. Заменить файл (после тестирования)
mv public/assets/portal.purged.css public/assets/portal.css

# 6. Перезапустить приложение
./deploy.sh
```

## Конфигурация

Конфигурационный файл: `purgecss.config.json`

- Анализирует шаблоны в `templates/` и `speakasap_site/templates/`
- Анализирует JavaScript в `src/`
- Обрабатывает `public/assets/portal.css`
- Сохраняет результат в `public/assets/portal.purged.css`
- Сохраняет классы из safelist (динамически добавляемые через JS)

## Ожидаемые результаты

- Уменьшение размера portal.css с ~377 KB до ~200-250 KB
- Улучшение времени загрузки на ~100-200ms
- Улучшение First Contentful Paint (FCP)

## Подробная документация

См. `docs/CSS_PURGE_INSTRUCTIONS.md` для полной инструкции.
