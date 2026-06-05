# Logs analyzer

## Analyze logs

Connect to the prod server use command:
ssh speakasap && cd speakasap-portal && pwd && la -la logs

Check logs for the last week. Find all WARNING, EXCEPTION, ERROR etc.

Group them by issue and make list what kind oif problem it is and hhow to solve all of them.

You should check logs here:

Application errors:
./speakasap-portal/logs/app_errors.log
./speakasap-portal/logs/app.log
./speakasap-portal/logs/helpdesk.log
./speakasap-portal/logs/webpay.log
./speakasap-portal/logs/payment.log
./speakasap-portal/logs/ses.log
./speakasap-portal/discount.log

## Fix found issues

We have Django 1.11.2 and Python 3.4 installed.

Use only python 3.4 with its limitations.

I have sudo rights so ask me when you need to execute sudo commands

To deploy application: ./scripts/deploy.sh

To restart application use command: supervisorctl -c /vagrant/setup/supervisord.conf restart speakasap

If errors or warnings more than 1 week old ignore them - more probably they are fixed already.

Focuse only on recent warnings and errors.

Create action plan which will address all issues found. Ask for plan approval and execute it.
