# Logs analyzer

## Analyze logs

Connect to the prod server use command:
ssh speakasap && cd speakasap-portal && pwd && la -la logs

Check logs for the last hour. Find all WARNING, EXCEPTION, ERROR etc.

Group them by issue and make list what kind oif problem it is and hhow to solve all of them.

You should check logs here:

Application errors:
./speakasap-portal/logs/app_errors.log
./speakasap-portal/logs/app.log
./speakasap-portal/logs/helpdesk.log
./speakasap-portal/logs/webpay.log
./speakasap-portal/logs/payment.log
./speakasap-portal/logs/ses.log

Page visits:
./speakasap-portal/logs/page_visits.log

Nginx logs
/var/log/nginx/error.log
/var/log/nginx/access.log

Celery keeps logs with running tasks and arguments here:
/var/log/supervisor/
/tmp/speakasap-stderr—-supervisor-arqGEW.log
/tmp/speakasap-stdout—-supervisor-yJR06k.log

Supervisor log:
/tmp/supervisord.log

gunicorn logs:
/var/log/gunicorn/access_log_speakasap
/var/log/gunicorn/error_log_speakasap

Postgre SQL
/var/log/postgresql/postgresql-9.5-main.log

Discounts:
./speakasap-portal/discount.log

## Fix found issues

We have Django 1.11.2 and Python 3.4 installed.

Use only python 3.4 with its limitations.

I have sudo rights so ask me when you need to execute sudo commands

To deploy application: ./scripts/deploy.sh

To restart application use command: supervisorctl -c /vagrant/setup/supervisord.conf restart speakasap
