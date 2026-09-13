import json

path = r'C:\Final Year\Final-year\ai-service\test_final_year.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = cell['source']
        for i, line in enumerate(source):
            if 'stdout=subprocess.PIPE,' in line:
                source[i] = line.replace('stdout=subprocess.PIPE,', 'stdout=open("uvicorn.log", "w"),')
            if 'line = server.stdout.readline()' in line:
                source[i] = line.replace('line = server.stdout.readline()', 'line = ""')
        cell['source'] = source

with open(path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=2, ensure_ascii=False)
