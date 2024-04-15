pipeline {
    agent any
    stages {
        stage('Pull Latest Code') {
            steps {
                checkout scm
            }
        }
        stage('Build Docker Containers') {
            steps {
                sh 'docker-compose build'
            }
        }
        stage('Deploy to Production via Ansible') {
            steps {
                withCredentials([file(credentialsId: 'devops-key-file', variable: 'KEY')]) {
                    sh 'rm -f ./devops-key.pem'
                    sh 'cp $KEY ./devops-key.pem'
                    sh 'chmod 400 ./devops-key.pem'
                    sh 'ansible-playbook -i production_ips.txt install.yml'
                }
            }
        }
    }
}
