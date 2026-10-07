# -*- coding: utf-8 -*-
import sys
import os
import tarfile
import paramiko
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOST = '88.99.102.50'
PORT = 22
USER = 'root'
PASS = '4N2evi_W?wV9S7'
DOMAIN = 'gem.nexiq.win'
APP_PORT = 3005

def run_ssh(ssh, cmd):
    print(f"[CMD] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out.strip():
        print(f"[OUT] {out.strip()}")
    if err.strip():
        print(f"[ERR] {err.strip()}")
    return out, err

def create_archive(tar_path):
    root_dir = Path("G:/Google")
    exclude_dirs = {'node_modules', '.git', 'storage', 'data'}
    
    with tarfile.open(tar_path, "w:gz") as tar:
        for item in root_dir.iterdir():
            if item.name in exclude_dirs:
                continue
            tar.add(str(item), arcname=item.name)
    print(f"[+] Da tao file luu tru: {tar_path} ({round(os.path.getsize(tar_path)/1024, 2)} KB)")

def deploy():
    print(f"[*] Dang ket noi toi server {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15)
    print("[+] Ket noi SSH thanh cong!")

    # 1. Kiem tra vhost & webroot
    target_dir = f"/www/wwwroot/{DOMAIN}"
    run_ssh(ssh, f"mkdir -p {target_dir} /usr/local/lsws/conf/vhosts/{DOMAIN}")

    # 2. Upload archive
    tar_local = "G:/Google/deploy_package.tar.gz"
    create_archive(tar_local)

    print("[*] Dang upload ma nguon len server qua SFTP...")
    sftp = ssh.open_sftp()
    tar_remote = f"/tmp/deploy_{DOMAIN}.tar.gz"
    sftp.put(tar_local, tar_remote)
    sftp.close()
    print("[+] Upload ma nguon thanh cong!")

    # 3. Giai nen va cai dat tren server
    run_ssh(ssh, f"tar -xzf {tar_remote} -C {target_dir}")
    run_ssh(ssh, f"rm -f {tar_remote}")
    
    # 4. Tao .env tren server voi PORT 3005
    env_content = f"""PORT={APP_PORT}
JWT_SECRET=gemini-video-20s-prod-nexiq-secure-key
FFMPEG_PATH=/usr/bin/ffmpeg
NODE_ENV=production
"""
    run_ssh(ssh, f"echo '{env_content}' > {target_dir}/.env")

    # 5. Cai dat dependencies & chay PM2
    print("[*] Dang cai dat npm dependencies tren server...")
    run_ssh(ssh, f"cd {target_dir} && npm install --omit=dev")

    print("[*] Dang khoi chay PM2...")
    run_ssh(ssh, f"pm2 delete gemini-video 2>/dev/null || true")
    run_ssh(ssh, f"cd {target_dir} && pm2 start server/server.js --name 'gemini-video'")
    run_ssh(ssh, f"pm2 save")

    # 6. Cau hinh LiteSpeed VHost cho gem.nexiq.win
    vhconf_content = f"""docRoot $VH_ROOT
vhDomain {DOMAIN}
enableGzip 1

extprocessor gemini_proxy {{
  type                    proxy
  address                 127.0.0.1:{APP_PORT}
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             120
  retryTimeout            0
  respBuffer              0
}}

context /.well-known/acme-challenge/ {{
  allowBrowse             1
  location                /var/www/acme/.well-known/acme-challenge/
}}

context / {{
  type                    proxy
  handler                 gemini_proxy
  addDefaultCharset       off
}}

rewrite  {{
  enable                  0
}}

index  {{
  useServer               0
  indexFiles              index.html
}}

errorlog $VH_ROOT/logs/error.log {{
  useServer               0
  logLevel                WARN
  rollingSize             10M
}}

accessLog $VH_ROOT/logs/access.log {{
  useServer               0
  rollingSize             10M
  keepDays                30
  compressArchive         0
  logReferer              1
  logUserAgent            1
}}
"""
    # Ghi file vhconf.conf
    remote_vhconf = f"/usr/local/lsws/conf/vhosts/{DOMAIN}/vhconf.conf"
    sftp = ssh.open_sftp()
    with sftp.file(remote_vhconf, 'w') as f:
        f.write(vhconf_content)
    sftp.close()
    run_ssh(ssh, f"mkdir -p /www/wwwroot/{DOMAIN}/logs && chown -R nogroup:lsadm /usr/local/lsws/conf/vhosts/{DOMAIN}")

    # 7. Kiem tra xem vhost da co trong httpd_config.conf chua
    check_vhost, _ = run_ssh(ssh, f"grep 'vhost {DOMAIN}' /usr/local/lsws/conf/httpd_config.conf || true")
    if not check_vhost.strip():
        print(f"[*] Dang them virtual host {DOMAIN} vao OpenLiteSpeed httpd_config.conf...")
        vhost_block = f"""
virtualhost {DOMAIN} {{
  vhRoot                  /www/wwwroot/{DOMAIN}
  configFile              conf/vhosts/{DOMAIN}/vhconf.conf
  allowSymbolLink         1
  enableScript            1
  restrained              1
  setUIDMode              0
}}
"""
        mapping_block = f"""  map                     {DOMAIN} {DOMAIN}"""
        # Append vhost block
        run_ssh(ssh, f"cat << 'EOF' >> /usr/local/lsws/conf/httpd_config.conf\n{vhost_block}\nEOF")
        # Add mapping to listener
        run_ssh(ssh, f"python3 -c \"\nwith open('/usr/local/lsws/conf/httpd_config.conf', 'r') as f:\n    c = f.read()\n\n# Them mapping vao listener HTTP\nif 'listener HTTP {{' in c:\n    c = c.replace('listener HTTP {{', 'listener HTTP {{\\n  map                     {DOMAIN} {DOMAIN}')\nif 'listener HTTPS {{' in c:\n    c = c.replace('listener HTTPS {{', 'listener HTTPS {{\\n  map                     {DOMAIN} {DOMAIN}')\nwith open('/usr/local/lsws/conf/httpd_config.conf', 'w') as f:\n    f.write(c)\n\"")

    # 8. Reload LiteSpeed
    print("[*] Dang khoi dong lai LiteSpeed Web Server...")
    run_ssh(ssh, "/usr/local/lsws/bin/lswsctrl restart")

    # 9. Test ket noi local tren server
    print("[*] Kiem tra API truc tiep tren server...")
    out_curl, _ = run_ssh(ssh, f"curl -s http://127.0.0.1:{APP_PORT}/api/system/info")
    print(f"[TEST LOCAL] {out_curl}")

    # Don dep file zip local
    if os.path.exists(tar_local):
        try: os.remove(tar_local)
        except: pass

    ssh.close()
    print("\n==========================================================")
    print(f"🎉 TRIEN KHAI LEN SERVER THANH CONG!")
    print(f"🌐 Domain: http://{DOMAIN}")
    print("==========================================================")

if __name__ == '__main__':
    deploy()
