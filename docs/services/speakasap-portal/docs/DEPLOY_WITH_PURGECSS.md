# Деплой с PurgeCSS

## Обновленный скрипт деплоя

Скрипт `scripts/deploy.sh` был модифицирован для автоматического запуска PurgeCSS после сборки проекта.

### Порядок выполнения

1. `git pull` - получение изменений
2. `yarn build` - сборка проекта (создает portal.css в `public/assets/` или `static/`)
3. **PurgeCSS** - оптимизация CSS (удаление неиспользуемого CSS)
   - Автоматически находит `portal.css` в `public/assets/` или `static/`
   - Создает резервную копию перед оптимизацией
   - Восстанавливает оригинал при ошибке
4. `collectstatic` - сбор статических файлов Django
5. `supervisorctl restart` - перезапуск приложения

### Как это работает

1. После `yarn build` создается файл `static/portal.css`
2. PurgeCSS анализирует шаблоны и JavaScript файлы
3. Удаляет неиспользуемые CSS правила из `portal.css`
4. Оптимизированный файл сохраняется обратно в `static/portal.css`
5. `collectstatic` копирует оптимизированный файл в финальную директорию

### Требования

- PurgeCSS должен быть установлен в `node_modules` (через `npm install --save-dev --legacy-peer-deps purgecss@^1.1.0`)
- Или PurgeCSS должен быть установлен глобально

### Установка PurgeCSS на production

```bash
ssh speakasap
cd speakasap-portal
npm install --save-dev --legacy-peer-deps purgecss@^1.1.0
```

### Ручной запуск PurgeCSS

Если нужно запустить PurgeCSS вручную:

```bash
./scripts/run_purgecss.sh
```

Или через npm:

```bash
npm run purgecss
```

### Безопасность

- Скрипт создает резервную копию перед оптимизацией
- При ошибке PurgeCSS оригинальный файл восстанавливается
- Если PurgeCSS не найден, деплой продолжается без оптимизации

### Результаты

После оптимизации размер `portal.css` уменьшается с ~370KB до ~96KB (экономия ~74%).
