import json

path = r'C:\Final Year\Final-year\ai-service\test_final_year.ipynb'
with open(path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = cell['source']
        for i, line in enumerate(source):
            if 'print(f"\\n  Demo Dashboard ➔ {public_url}/demo")' in line:
                source.insert(i, '        print(f"\\n  👉 REACT VITE_AI_SERVICE_URL = {public_url}")\n')
                break
        cell['source'] = source

with open(path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=2, ensure_ascii=False)
