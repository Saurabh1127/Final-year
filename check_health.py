import urllib.request
import json

# Check the health endpoint to see if the server is still alive
try:
    req = urllib.request.Request("https://2419-35-197-74-182.ngrok-free.app/health")
    with urllib.request.urlopen(req) as response:
        print("Health Check:", response.read().decode())
except Exception as e:
    print("Health Check Failed:", e)
