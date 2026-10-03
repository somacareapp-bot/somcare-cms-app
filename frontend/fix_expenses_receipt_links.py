import re

path = "src/modules/billing/ExpensesPage.tsx"
with open(path, "r") as f:
    content = f.read()

# Fix #1: table row receipt link (the <a got dropped, leaving a blank line before href=)
broken1 = """                          {e.receiptUrl ? (
                            
                              href={e.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 text-xs font-semibold underline"
                            >
                              View
                            </a>
                          ) : ("""

fixed1 = """                          {e.receiptUrl ? (
                            
                              href={e.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 text-xs font-semibold underline"
                            >
                              View
                            </a>
                          ) : ("""

# Fix #2: modal receipt link
broken2 = """                  ) : (
                    
                      href={viewExpense.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-600 text-sm font-semibold underline inline-flex items-center gap-1"
                    >
                      <Paperclip size={13} /> Open receipt
                    </a>
                  )"""

fixed2 = """                  ) : (
                    
                      href={viewExpense.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-600 text-sm font-semibold underline inline-flex items-center gap-1"
                    >
                      <Paperclip size={13} /> Open receipt
                    </a>
                  )"""

count1 = content.count(broken1)
count2 = content.count(broken2)

if count1 != 1:
    print(f"WARNING: expected 1 match for fix #1, found {count1} — aborting fix #1")
else:
    content = content.replace(broken1, fixed1)
    print("Fix #1 applied (table row receipt link).")

if count2 != 1:
    print(f"WARNING: expected 1 match for fix #2, found {count2} — aborting fix #2")
else:
    content = content.replace(broken2, fixed2)
    print("Fix #2 applied (modal receipt link).")

with open(path, "w") as f:
    f.write(content)

print("Done.")
