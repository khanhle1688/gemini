# -*- coding: utf-8 -*-
import sys, paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('88.99.102.50', port=22, username='root', password='4N2evi_W?wV9S7', timeout=10)

remote_script = """import urllib.request, urllib.parse, subprocess, os

prompt1 = "cinematic photorealistic, empty dark house, bare wooden floor, atmospheric lighting, 4k"
encoded = urllib.parse.quote(prompt1)
url = "https://image.pollinations.ai/prompt/" + encoded + "?width=1280&height=720&nologo=true"
print("Downloading AI image...")
urllib.request.urlretrieve(url, "/tmp/test_ai.jpg")
print("Image size:", os.path.getsize("/tmp/test_ai.jpg"))

cmd = [
    "ffmpeg", "-y", "-loop", "1", "-i", "/tmp/test_ai.jpg",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-filter_complex",
    "[0:v]scale=8000:-1,zoompan=z='min(zoom+0.0012,1.3)':d=300:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=30,format=yuv420p[v]",
    "-map", "[v]", "-map", "1:a", "-t", "10",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "/tmp/test_scene.mp4"
]
print("Running FFmpeg ZoomPan...")
res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print("Video size:", os.path.getsize("/tmp/test_scene.mp4"))
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_real.py', 'w') as f:
    f.write(remote_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('python3 /tmp/test_real.py')
print(stdout.read().decode())
print(stderr.read().decode())
ssh.close()
