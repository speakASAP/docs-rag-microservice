# Production Deployment

## Task: Deploy our application on production

## Details needed

Our application consists of 3 microservices in ~/Documents/Github/. Access via ssh alfares.

Initial task: use command: ssh alfares "cd statex && git pull && ./scripts/deploy.sh"
In case there will be local file changes they needs to be checked against github version and git repo should be corrected with working codebase.

nginx-microservice handles blue/green deployments.
Use the same nginx and database setup to manage alfares.cz:
Run: ssh alfares && cd nginx-microservice && ./scripts/blue-green/deploy.sh statex.

database-server is the PostgreSQL database for the app.

Applications are located at /Users/sergiystashok/Documents/GitHub/ (prod: /home/statex).

Configs and logs are in project root folders and ./logs/.
Environment variables are protected and stored within root folder for each project. Use command cat .env to see it

All internal microservices (statex-website, statex-ai, statex-infrastructure, statex-notification, submission service, etc.) deploy as subservices under statex similarly.

This modular architecture improves development and separation of services.

Success is when <https://alfares.cz> is accessible without console or log errors.
