import re

path = "src/modules/billing/ExpensesPage.tsx"
with open(path, "r") as f:
    lines = f.readlines()

fixed_count = 0
out = []
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith("href={e.receiptUrl}") or stripped.startswith("href={viewExpense.receiptUrl}"):
        prev = out[-1] if out else ""
        # If the previous non-blank line doesn't already open an <a, insert one
        # matching this line's indentation.
        indent = line[: len(line) - len(line.lstrip())]
        if "<a" not in prev:
            # Remove a trailing blank line right above, if present, and replace with 
            if out and out[-1].strip() == "":
                out[-1] = indent + "<a\n"
            else:
                out.append(indent + "<a\n")
            fixed_count += 1
    out.append(line)

with open(path, "w") as f:
    f.writelines(out)

print(f"Inserted {fixed_count} missing <a tag(s).")
