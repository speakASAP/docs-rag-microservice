# Important! Workflow

[![Super Linter](https://github.com/speakASAP/speakasap-portal/actions/workflows/super-linter.yml/badge.svg)](https://github.com/marketplace/actions/super-linter)
[![Ansible Lint](https://github.com/speakASAP/speakasap-portal/actions/workflows/ansible-lint.yml/badge.svg)](https://github.com/marketplace/actions/ansible-lint)
[![Mega Linter](https://github.com/speakASAP/speakasap-portal/actions/workflows/mega-linter.yml/badge.svg)](https://github.com/marketplace/actions/mega-linter)
[![Code Review](https://github.com/speakASAP/speakasap-portal/actions/workflows/cr.yml/badge.svg)](https://github.com/marketplace/actions/cr)
[![Django CI](https://github.com/speakASAP/speakasap-portal/actions/workflows/django.yml/badge.svg)](https://github.com/marketplace/actions/django)
[![Issue branch](https://github.com/speakASAP/speakasap-portal/actions/workflows/issue-branch.yml/badge.svg)](https://github.com/marketplace/actions/issue-branch)
[![Open Commit](https://github.com/speakASAP/speakasap-portal/actions/workflows/opencommit.yml/badge.svg)](https://github.com/marketplace/actions/open-commit)
[![codecov-test-results](https://github.com/speakASAP/speakasap-portal/actions/workflows/codecov-test-results.yml/badge.svg)](https://github.com/marketplace/actions/codecov-test-results)
[![codecov](https://codecov.io/gh/speakASAP/speakasap-portal/graph/badge.svg?token=VPHLHI16DE)](https://codecov.io/gh/speakASAP/speakasap-portal)

<https://codecov.io/gh/speakASAP/speakasap-portal/graphs/tree.svg?token=VPHLHI16DE>

When starting work on a new feature, branch off from the `pre_release` branch.

```bash
git checkout -b [feature] pre_release
```

Every branch ([feature]) should have name which links to github issue. For example `Issue177_Teacher_lesson update`.

Every commit should have name with hashtag which links to github issue. For example `#177 Teacher lesson update`.

When you ready, create a pull request back to `pre_release` branch. Features should never interact directly with master.

# Back-End

- Clone the project:

    ```bash
    git clone git@github.com:speakASAP/speakasap-portal.git
    ```

- Go to project dir:

    ```bash
    cd speakasap-portal
    ```

- Open hosts file with editor (nano for example):

    ```bash
    nano /etc/hosts
    ```

- Add hostname line to the file:

    ```
    [vagrant_machine_ip or your_local_ip]      speakasap.local
    ```

## Working with vagrant

### Installation

- Create and configure vagrant machine:

    ```bash
    vagrant up
    ```

- Add hostname in `hosts` file:
  - Get vagrant machine ip:

        ```bash
        vagrant ssh -c "hostname -I | cut -d' ' -f2" 2>/dev/null
        ```

### Launching project

- Start up vagrant if it's not already:

    ```bash
    vagrant up
    ```

- SSH to vagrant VM:

    ```bash
    vagrant ssh
    ```

- Go to project directory:

    ```bash
    cd /vagrant
    ```

- Run the server:

    ```bash
    sh run.sh
    ```

- Server is ready and running on [http://speakasap.local:9001](http://speakasap.local:9001)

### Working without vagrant

- Install rabbitmq and management plugin:

    ```bash
    sudo apt-get install rabbitmq-server -y
    sudo rabbitmq-plugins enable rabbitmq_management
    ```

- Setting Up rabbitmq. In case of change user, password or vhost, change also in local settings:

    ```bash
    sudo rabbitmqctl add_user portal password
    sudo rabbitmqctl add_vhost portal
    sudo rabbitmqctl set_permissions -p portal portal ".*" ".*" ".*"
    ```

- Create directories for logs and materials:

    ```bash
    mkdir logs
    mkdir materials
    mkdir materials/certificates
    ```

- Install required packages:

    ```bash
    sudo apt-get install -y libffi-dev python3-lxml python3-psycopg2 libjpeg8-dev libpng12-dev libcairo2-dev libpango1.0-dev postgresql-plpython3-9.5 libssl-dev libav-tools libxml2-dev libxslt1-dev
    curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo apt-get install -y gzip python pkg-config build-essential
    npm install --loglevel warn
    ```

- Create virtual environment:

    ```bash
    virtualenv -p python3 ../env
    ```

- Activate virtual environment:

    ```bash
    . ../env/bin/activate
    ```

- Install required packages to venv:

    ```bash
    pip install -r requirements.txt
    ```

- Create and configure local settings (example stored in portal/local_settings_default.py):

    ```bash
    touch portal/local_settings.py
    ```

    ```bash
    nano portal/local_settins.py
    ```

- Apply migrations, apply fixtures, run other required commands:

    ```bash
    python3 manage.py migrate
    python3 manage.py loaddata languages fix_user seven fix_categories part_payments base_courses courses products
    python3 manage.py createcachetable
    python3 manage.py collectstatic --noinput
    python3 manage.py parse_euro
    ```

- Run server:

    ```bash
    python3 manage.py runserver 0.0.0.0:9001

- Server is ready and running on [http://speakasap.local:9001](http://speakasap.local:9001)

# Front-End

Install yarn package manager from here: <https://yarnpkg.com/lang/en/docs/install/>

## Configuring

Installing modules:

```
yarn
```

## Build bundles for frontend

`yarn build`

# Marathons

Marathon can be added using update `update_marathon` (currently only danish and swedish):

1. Danish - `python3 manage.py update_marathon danish`
2. Swedish – `python3 manage.py update_marathon swedish`

# Update current servers

- For Dev server:

    ```bash
    git pull origin [your_branch_name]
    ```

- For Production server:

    ```bash
    git pull origin release
    ```

- And then:

    ```bash
    yarn build
    python3 manage.py collectstatic
    python3 manage.py migrate
    ```
