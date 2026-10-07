# -*- coding: utf-8 -*-
import sys, paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('88.99.102.50', port=22, username='root', password='4N2evi_W?wV9S7', timeout=10)

stdin, stdout, stderr = ssh.exec_command('curl -s -I "https://image.pollinations.ai/prompt/cinematic%20empty%20room" | grep -i "content-type"')
print("RESULT:", stdout.read().decode())
ssh.close()
