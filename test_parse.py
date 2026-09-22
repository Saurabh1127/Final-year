import re

with open("Blue_Book_Report.md", "r", encoding="utf-8") as f:
    text = f.read()

# Let's inspect sections
print("Original size:", len(text), "chars, words:", len(text.split()))

# Check chapters
chapters = re.findall(r'<h1[^>]*>(.*?)</h1>', text, re.IGNORECASE)
for c in chapters:
    clean = re.sub(r'<[^>]+>', '', c).strip()
    print("Found H1:", clean)
